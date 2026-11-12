# Spec: Walk-in con Teléfono, Fidelización y WhatsApp en Diagnóstico IA

**Fecha:** 2026-07-03  
**Estado:** Aprobado

---

## Contexto

El registro de clientes sin cita (walk-in) solo captura nombre. Esto impide:

1. Vincular el walk-in a un `Customer` real → los puntos de loyalty nunca acumulan
2. Enviar el diagnóstico IA por WhatsApp → el botón está oculto para todos los walk-ins

El backend (`CreateWalkInDto`, `Appointment.CustomerId`) ya tiene la estructura necesaria; solo falta conectar los puntos.

---

## Objetivo

- Campo teléfono opcional en el formulario walk-in del panel del barbero
- Si se proporciona teléfono: upsert de `Customer` ghost, vínculo en `Appointment.CustomerId`, acumulación de loyalty
- Si el cliente luego se registra en booking con ese número: upgrade transparente del ghost (conserva puntos)
- Botón WhatsApp en `DiagnosisModal` visible cuando `appointment.customerPhone` tiene valor (no solo para no-walk-ins)

---

## Alcance

**Archivos modificados:**

| Archivo | Cambio |
|---------|--------|
| `BarberBookSaaS.Infrastructure/Services/AppointmentService.cs` | upsert Customer ghost + loyalty en `CreateWalkInAsync` |
| `BarberBookSaaS.Infrastructure/Services/CustomerAuthService.cs` | upgrade ghost en `RegisterAsync` |
| `BarberBookSaaS.Web/src/features/barbers/BarberDashboard.tsx` | campo teléfono en `WalkInModal` + condición WhatsApp en `DiagnosisModal` |

**No se toca:**
- `CreateWalkInDto` (ya tiene `CustomerPhone?`)
- `appointmentService.ts` (ya acepta `customerPhone?` en el tipo)
- Migraciones (Customer y Appointment.CustomerId ya existen)

---

## Diseño detallado

### 1. Inyección de `ITenantService` en `AppointmentService`

`AppointmentService` actualmente no recibe `ITenantService`. Se agrega al constructor para poder hacer el lookup de ghost customer con `IgnoreQueryFilters()` usando el `TenantId` activo antes de que el interceptor lo fije.

```csharp
private readonly ITenantService _tenantService;

public AppointmentService(
    ApplicationDbContext context,
    IWhatsAppService whatsAppService,
    ILogger<AppointmentService> logger,
    IBarberService barberService,
    ITenantService tenantService)
{
    _context = context;
    _whatsAppService = whatsAppService;
    _logger = logger;
    _barberService = barberService;
    _tenantService = tenantService;
}
```

El DI container ya resuelve `ITenantService` como scoped — no se requiere registro adicional.

---

### 2. `CreateWalkInAsync` — upsert ghost + loyalty

```csharp
public async Task<BookingResult> CreateWalkInAsync(CreateWalkInDto dto, Guid userId)
{
    var barber = await _barberService.GetByUserIdAsync(userId);
    if (barber is null)
        return BookingResult.Fail("BARBER_NOT_FOUND", "No se encontró un barbero asociado a este usuario.");

    var service = await _context.Services.FirstOrDefaultAsync(s => s.Id == dto.ServiceId);
    if (service is null)
        return BookingResult.Fail("SERVICE_NOT_FOUND", "El servicio solicitado no existe.");
    if (!service.IsActive)
        return BookingResult.Fail("SERVICE_INACTIVE", "El servicio no está disponible actualmente.");

    var appointmentDate = dto.AppointmentDate.HasValue
        ? DateTime.SpecifyKind(dto.AppointmentDate.Value, DateTimeKind.Utc)
        : DateTime.UtcNow;

    var isAiService = service.Name == "Corte + Diagnóstico IA";

    // Upsert ghost Customer si hay teléfono
    Customer? customer = null;
    if (!string.IsNullOrWhiteSpace(dto.CustomerPhone))
    {
        customer = await _context.Customers
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.TenantId == _tenantService.TenantId && c.Phone == dto.CustomerPhone);

        if (customer is null)
        {
            customer = new Customer
            {
                Id = Guid.NewGuid(),
                Name = dto.CustomerName,
                Phone = dto.CustomerPhone,
                PasswordHash = string.Empty,  // ghost — sin contraseña
                LoyaltyCount = 0,
                CreatedAt = DateTime.UtcNow,
            };
            await _context.Customers.AddAsync(customer);
        }
    }

    var appointment = new Appointment
    {
        Id = Guid.NewGuid(),
        BarberId = barber.Id,
        ServiceId = dto.ServiceId,
        CustomerId = customer?.Id,
        CustomerName = dto.CustomerName,
        CustomerPhone = dto.CustomerPhone,
        AppointmentDate = appointmentDate,
        Status = isAiService ? AppointmentStatus.Pending : AppointmentStatus.Completed,
        CreatedAt = DateTime.UtcNow,
        IsWalkIn = true
    };

    await _context.Appointments.AddAsync(appointment);
    await _context.SaveChangesAsync();  // interceptor fija TenantId en ambas entidades

    // Loyalty: walk-ins no pasan por UpdateStatusAsync, se acumula aquí
    if (!isAiService && customer is not null)
    {
        var tenant = await _context.Tenants.FindAsync(appointment.TenantId);
        if (tenant is { LoyaltyEnabled: true })
        {
            customer.LoyaltyCount += 1;
            await _context.SaveChangesAsync();
        }
    }

    var saved = await _context.Appointments
        .Include(a => a.Barber)
        .Include(a => a.Service)
        .FirstAsync(a => a.Id == appointment.Id);

    return BookingResult.Ok(saved);
}
```

**Reglas:**
- Si `CustomerPhone` está vacío: comportamiento idéntico al actual (sin `CustomerId`, sin loyalty)
- Si el teléfono ya tiene un Customer (ghost o real): se reutiliza, no se duplica
- Loyalty solo acumula para servicios no-IA y solo si el tenant lo tiene habilitado

---

### 3. `RegisterAsync` — upgrade de ghost

```csharp
public async Task<CustomerAuthResponseDto?> RegisterAsync(string subdomain, RegisterCustomerDto dto)
{
    if (!EsContrasenaSegura(dto.Password))
        throw new ArgumentException(PasswordRequirementsMessage);

    var tenantExists = await _context.Tenants.AnyAsync(t => t.Id == subdomain);
    if (!tenantExists) return null;

    var existing = await _context.Customers
        .IgnoreQueryFilters()
        .FirstOrDefaultAsync(c => c.TenantId == subdomain && c.Phone == dto.Phone);

    if (existing is not null)
    {
        if (existing.PasswordHash != string.Empty)
            return null;  // conflicto real — teléfono ya registrado con contraseña

        // Ghost → upgrade: conserva LoyaltyCount y historial de citas
        existing.Name = dto.Name;
        existing.PasswordHash = BCryptNet.HashPassword(dto.Password);
        existing.AcceptedTermsAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return await BuildResponseAsync(existing);
    }

    _tenantService.TenantId = subdomain;

    var customer = new Customer
    {
        Id = Guid.NewGuid(),
        Name = dto.Name,
        Phone = dto.Phone,
        PasswordHash = BCryptNet.HashPassword(dto.Password),
        LoyaltyCount = 0,
        CreatedAt = DateTime.UtcNow,
        AcceptedTermsAt = DateTime.UtcNow
    };

    await _context.Customers.AddAsync(customer);
    await _context.SaveChangesAsync();

    return await BuildResponseAsync(customer);
}
```

**Regla crítica:** El upgrade solo procede si `PasswordHash == string.Empty`. Un Customer con contraseña ya establecida es un conflicto real y se rechaza (`return null`).

---

### 4. Frontend — `WalkInModal`

**Estado nuevo:**
```tsx
const [customerPhone, setCustomerPhone] = useState("");
```

**Campo en el formulario** (entre "Nombre" y "Servicio"):
```tsx
<div>
  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
    Teléfono{" "}
    <span style={{ color: "var(--color-text-muted)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
      (opcional · fidelización y WhatsApp)
    </span>
  </label>
  <input
    type="tel"
    value={customerPhone}
    onChange={e => setCustomerPhone(e.target.value)}
    placeholder="Ej: 3001234567"
    maxLength={20}
    style={inputStyle}
    onFocus={e => (e.currentTarget.style.borderColor = "var(--color-primary)")}
    onBlur={e => (e.currentTarget.style.borderColor = "var(--color-border)")}
  />
</div>
```

**`handleSubmit` — pasar teléfono:**
```tsx
await appointmentService.createWalkIn({
  serviceId,
  customerName: customerName.trim(),
  appointmentDate: `${date}T${time}:00`,
  customerPhone: customerPhone.trim() || undefined,
});
```

`undefined` evita enviar `customerPhone: ""` al backend cuando el campo está vacío.

---

### 5. Frontend — `DiagnosisModal` botón WhatsApp

Cambio en la condición del botón WhatsApp (línea ~497 de `BarberDashboard.tsx`):

```tsx
// Antes:
{!appointment.isWalkIn && (
  <button onClick={handleShareWhatsApp} ...>
    <Share2 size={14} /> WhatsApp
  </button>
)}

// Después:
{appointment.customerPhone && (
  <button onClick={handleShareWhatsApp} ...>
    <Share2 size={14} /> WhatsApp
  </button>
)}
```

Esto habilita WhatsApp para cualquier cita (walk-in o no) que tenga teléfono, y lo oculta para walk-ins sin teléfono.

---

## Flujo end-to-end

```
Barbero abre WalkInModal
  → ingresa nombre "Carlos", teléfono "3001234567", servicio "Corte"
  → POST /api/appointments/walk-in { customerName, customerPhone, serviceId, ... }

Backend CreateWalkInAsync:
  → busca Customer con phone="3001234567" en tenant → no existe
  → crea Customer ghost (PasswordHash="", LoyaltyCount=0)
  → crea Appointment (CustomerId=customer.Id, IsWalkIn=true, Status=Completed)
  → SaveChanges → interceptor fija TenantId
  → tenant.LoyaltyEnabled=true → customer.LoyaltyCount=1
  → SaveChanges

Carlos vuelve, esta vez usa la app de booking:
  → RegisterAsync con phone="3001234567"
  → existing != null, PasswordHash == "" → upgrade ghost
  → existing.PasswordHash = hash(password), existing.Name = "Carlos García"
  → SaveChanges → devuelve sesión con LoyaltyCount=1

Barbero abre DiagnosisModal para la cita walk-in de Carlos:
  → appointment.customerPhone = "3001234567" → botón WhatsApp visible
  → genera imagen → comparte por WhatsApp al número de Carlos
```

---

## Tests existentes

No hay tests de `CreateWalkInAsync` actualmente. El plan de implementación debe incluir tests para:
- Walk-in sin teléfono → no crea Customer, no acumula loyalty
- Walk-in con teléfono nuevo → crea ghost Customer, acumula loyalty si habilitado
- Walk-in con teléfono de Customer existente (ghost) → reutiliza, acumula loyalty
- Walk-in con teléfono de Customer existente (real) → reutiliza, acumula loyalty
- Walk-in servicio IA → no acumula loyalty (status queda Pending)
- `RegisterAsync` con teléfono ghost → upgrade exitoso, LoyaltyCount conservado
- `RegisterAsync` con teléfono real → rechazado (return null)
