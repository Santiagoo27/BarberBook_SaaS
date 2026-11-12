# Walk-in con Teléfono, Fidelización y WhatsApp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar campo teléfono opcional al walk-in, vincular el appointment a un Customer ghost (upsert por teléfono), acumular loyalty al crear, permitir upgrade del ghost al registrar, y habilitar el botón WhatsApp en `DiagnosisModal` cuando el appointment tiene teléfono.

**Architecture:** La lógica de upsert ghost vive en `CreateWalkInAsync` (backend, inyectar `ITenantService`); el upgrade de ghost en `RegisterAsync`; los cambios de UI son dos modificaciones en `BarberDashboard.tsx`. Sin migraciones nuevas — `Appointment.CustomerId` y `Customer` ya existen.

**Tech Stack:** .NET 10 / EF Core / SQLite (tests) / xUnit + WebApplicationFactory / React 18 + TypeScript

## Global Constraints

- Solo modificar los archivos listados en cada tarea — no crear nuevos archivos de producción
- `customerPhone` es siempre opcional — walk-in sin teléfono debe funcionar exactamente igual que antes
- Ghost customer: `PasswordHash = string.Empty` (string vacío, no null)
- Upgrade solo si `PasswordHash == string.Empty` — nunca pisar cuenta con contraseña real
- Usar `_tenantService.TenantId` para el lookup del ghost con `IgnoreQueryFilters()` en `CreateWalkInAsync`
- Loyalty solo acumula si `!isAiService && tenant.LoyaltyEnabled == true && customer != null`
- `ITenantService` ya está en namespace `BarberBookSaaS.Application.Common`, que ya está importado en `AppointmentService.cs` — no agregar nuevo using
- Botón WhatsApp: condición `appointment.customerPhone && (...)` — no `!appointment.isWalkIn`
- No agregar paquetes npm ni NuGet nuevos

---

### Task 1: AppointmentService — ghost upsert + loyalty en walk-in

**Files:**
- Modify: `BarberBookSaaS.Infrastructure/Services/AppointmentService.cs`
- Create: `BarberBookSaaS.Tests/WalkInTests.cs`

**Interfaces:**
- Consumes: `ITenantService` del namespace `BarberBookSaaS.Application.Common` (ya en los usings del archivo)
- Consumes: `Customer` entity — campos: `Id`, `TenantId`, `Name`, `Phone`, `PasswordHash`, `LoyaltyCount`, `CreatedAt`
- Consumes: `CreateWalkInDto.CustomerPhone` (ya existe, tipo `string?`)
- Produces: `Appointment.CustomerId` poblado cuando hay teléfono; `Customer.LoyaltyCount += 1` cuando loyalty habilitado y servicio no-IA

- [ ] **Step 1: Crear `WalkInTests.cs` con todos los tests en FAIL**

Crear `BarberBookSaaS.Tests/WalkInTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using BarberBookSaaS.Tests.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using BCryptNet = BCrypt.Net.BCrypt;

namespace BarberBookSaaS.Tests;

public class WalkInTests : IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory = new();
    private HttpClient _client = null!;

    // Tenant con loyalty habilitado
    private const string TenantId = "walkin-t1";
    private static readonly Guid UserId    = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid BarberId  = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static readonly Guid ServiceId    = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static readonly Guid AiServiceId  = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");

    // Tenant con loyalty DESHABILITADO
    private const string TenantId2 = "walkin-t2";
    private static readonly Guid UserId2   = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab");
    private static readonly Guid BarberId2 = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1");
    private static readonly Guid ServiceId2 = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccd");

    public async Task InitializeAsync()
    {
        await _factory.InitializeDbAsync();
        _client = _factory.CreateClient();
        await SeedAsync();
    }

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private async Task SeedAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // Tenant 1 — loyalty enabled
        db.Tenants.Add(new Tenant
        {
            Id = TenantId, Name = "Walk-in Test", Subdomain = TenantId,
            LoyaltyEnabled = true, LoyaltyThreshold = 5
        });
        db.Users.Add(new User
        {
            Id = UserId, TenantId = TenantId, Email = "barber@walkin-t1.com",
            Role = UserRoles.Barber, PasswordHash = "x", IsActive = true, MustChangePassword = false
        });
        db.Barbers.Add(new Barber
        {
            Id = BarberId, TenantId = TenantId, UserId = UserId,
            Name = "Test Barber", IsActive = true
        });
        db.Services.Add(new Service
        {
            Id = ServiceId, TenantId = TenantId,
            Name = "Corte", Price = 20, DurationMinutes = 30, IsActive = true
        });
        db.Services.Add(new Service
        {
            Id = AiServiceId, TenantId = TenantId,
            Name = "Corte + Diagnóstico IA", Price = 30, DurationMinutes = 60, IsActive = true
        });

        // Tenant 2 — loyalty disabled
        db.Tenants.Add(new Tenant
        {
            Id = TenantId2, Name = "No Loyalty Test", Subdomain = TenantId2,
            LoyaltyEnabled = false, LoyaltyThreshold = 5
        });
        db.Users.Add(new User
        {
            Id = UserId2, TenantId = TenantId2, Email = "barber@walkin-t2.com",
            Role = UserRoles.Barber, PasswordHash = "x", IsActive = true, MustChangePassword = false
        });
        db.Barbers.Add(new Barber
        {
            Id = BarberId2, TenantId = TenantId2, UserId = UserId2,
            Name = "Test Barber 2", IsActive = true
        });
        db.Services.Add(new Service
        {
            Id = ServiceId2, TenantId = TenantId2,
            Name = "Corte", Price = 20, DurationMinutes = 30, IsActive = true
        });

        await db.SaveChangesAsync();
    }

    private void AuthAsBarber() =>
        _client.SetAuth(TestAuthHelper.BarberToken(TenantId, UserId.ToString()), TenantId);

    private void AuthAsBarber2() =>
        _client.SetAuth(TestAuthHelper.BarberToken(TenantId2, UserId2.ToString()), TenantId2);

    // ── Tests ───────────────────────────────────────────────────

    [Fact]
    public async Task CreateWalkIn_NoPhone_DoesNotCreateCustomer()
    {
        AuthAsBarber();
        var response = await _client.PostAsJsonAsync("/api/appointments/walk-in", new
        {
            serviceId = ServiceId,
            customerName = "Sin Teléfono",
            appointmentDate = DateTime.UtcNow
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var count = await db.Customers.IgnoreQueryFilters()
            .CountAsync(c => c.TenantId == TenantId);
        Assert.Equal(0, count);
    }

    [Fact]
    public async Task CreateWalkIn_WithNewPhone_CreatesGhostCustomerAndAccruesLoyalty()
    {
        AuthAsBarber();
        var response = await _client.PostAsJsonAsync("/api/appointments/walk-in", new
        {
            serviceId = ServiceId,
            customerName = "Carlos",
            customerPhone = "3001234567",
            appointmentDate = DateTime.UtcNow
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var customer = await db.Customers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.TenantId == TenantId && c.Phone == "3001234567");

        Assert.NotNull(customer);
        Assert.Equal("Carlos", customer.Name);
        Assert.Equal(string.Empty, customer.PasswordHash);
        Assert.Equal(1, customer.LoyaltyCount);
    }

    [Fact]
    public async Task CreateWalkIn_WithPhoneOfExistingGhost_ReusesAndAccruesLoyalty()
    {
        // Seed ghost customer directamente en DB
        using (var seedScope = _factory.Services.CreateScope())
        {
            var db = seedScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Customers.Add(new Customer
            {
                Id = Guid.NewGuid(), TenantId = TenantId,
                Name = "Carlos", Phone = "3009999999",
                PasswordHash = string.Empty, LoyaltyCount = 2, CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        AuthAsBarber();
        var response = await _client.PostAsJsonAsync("/api/appointments/walk-in", new
        {
            serviceId = ServiceId,
            customerName = "Carlos",
            customerPhone = "3009999999",
            appointmentDate = DateTime.UtcNow
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db2 = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var customers = await db2.Customers.IgnoreQueryFilters()
            .Where(c => c.TenantId == TenantId && c.Phone == "3009999999")
            .ToListAsync();

        Assert.Single(customers);                   // no se duplicó
        Assert.Equal(3, customers[0].LoyaltyCount); // 2 + 1
    }

    [Fact]
    public async Task CreateWalkIn_WithPhoneOfRealCustomer_ReusesAndAccruesLoyalty()
    {
        using (var seedScope = _factory.Services.CreateScope())
        {
            var db = seedScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Customers.Add(new Customer
            {
                Id = Guid.NewGuid(), TenantId = TenantId,
                Name = "Ana", Phone = "3008888888",
                PasswordHash = BCryptNet.HashPassword("Pass123!"),
                LoyaltyCount = 0, CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        AuthAsBarber();
        var response = await _client.PostAsJsonAsync("/api/appointments/walk-in", new
        {
            serviceId = ServiceId,
            customerName = "Ana",
            customerPhone = "3008888888",
            appointmentDate = DateTime.UtcNow
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db2 = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var customers = await db2.Customers.IgnoreQueryFilters()
            .Where(c => c.TenantId == TenantId && c.Phone == "3008888888")
            .ToListAsync();

        Assert.Single(customers);
        Assert.Equal(1, customers[0].LoyaltyCount);
    }

    [Fact]
    public async Task CreateWalkIn_AiService_DoesNotAccrueLoyalty()
    {
        AuthAsBarber();
        var response = await _client.PostAsJsonAsync("/api/appointments/walk-in", new
        {
            serviceId = AiServiceId,
            customerName = "Pedro",
            customerPhone = "3007777777",
            appointmentDate = DateTime.UtcNow
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var customer = await db.Customers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.TenantId == TenantId && c.Phone == "3007777777");

        Assert.NotNull(customer);
        Assert.Equal(0, customer.LoyaltyCount); // IA no acumula
    }

    [Fact]
    public async Task CreateWalkIn_LoyaltyDisabledTenant_DoesNotAccrueLoyalty()
    {
        AuthAsBarber2();
        var response = await _client.PostAsJsonAsync("/api/appointments/walk-in", new
        {
            serviceId = ServiceId2,
            customerName = "Luis",
            customerPhone = "3006666666",
            appointmentDate = DateTime.UtcNow
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var customer = await db.Customers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.TenantId == TenantId2 && c.Phone == "3006666666");

        Assert.NotNull(customer);
        Assert.Equal(0, customer.LoyaltyCount); // loyalty disabled
    }
}
```

- [ ] **Step 2: Correr los tests — deben FALLAR**

```bash
cd BarberBookSaaS.Tests && dotnet test --filter "WalkInTests" -v n
```

Salida esperada: varios tests FAIL. `NoPhone_DoesNotCreateCustomer` puede pasar (el código actual no crea customers — correcto). Los de ghost/loyalty deben fallar. Si todos pasan, hay un error en el setup.

- [ ] **Step 3: Agregar `ITenantService` al constructor de `AppointmentService`**

En `BarberBookSaaS.Infrastructure/Services/AppointmentService.cs`, reemplazar los campos privados y el constructor (líneas 14-25):

```csharp
// Antes:
private readonly ApplicationDbContext _context;
private readonly IWhatsAppService _whatsAppService;
private readonly ILogger<AppointmentService> _logger;
private readonly IBarberService _barberService;

public AppointmentService(ApplicationDbContext context, IWhatsAppService whatsAppService, ILogger<AppointmentService> logger, IBarberService barberService)
{
    _context = context;
    _whatsAppService = whatsAppService;
    _logger = logger;
    _barberService = barberService;
}
```

```csharp
// Después:
private readonly ApplicationDbContext _context;
private readonly IWhatsAppService _whatsAppService;
private readonly ILogger<AppointmentService> _logger;
private readonly IBarberService _barberService;
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

No agregar nuevo `using` — `ITenantService` ya está en `BarberBookSaaS.Application.Common` que está importado en la línea 3 del archivo.

- [ ] **Step 4: Reemplazar `CreateWalkInAsync` completo**

Reemplazar el método completo `CreateWalkInAsync` (líneas 443-483):

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
                PasswordHash = string.Empty,
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
    await _context.SaveChangesAsync(); // interceptor fija TenantId en ambas entidades

    // Loyalty: walk-ins quedan Completed directamente — no pasan por UpdateStatusAsync
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

- [ ] **Step 5: Correr los tests — deben PASAR**

```bash
cd BarberBookSaaS.Tests && dotnet test --filter "WalkInTests" -v n
```

Salida esperada: 6 tests PASS. Si alguno falla, leer el mensaje de error antes de continuar.

- [ ] **Step 6: Correr la suite completa — sin regresiones**

```bash
cd BarberBookSaaS.Tests && dotnet test -v n
```

Salida esperada: todos los tests pasan (mínimo 48 existentes + 6 nuevos = 54).

- [ ] **Step 7: Commit**

```bash
git add BarberBookSaaS.Infrastructure/Services/AppointmentService.cs BarberBookSaaS.Tests/WalkInTests.cs
git commit -m "feat: walk-in ghost customer upsert + loyalty accrual"
```

---

### Task 2: CustomerAuthService — upgrade de ghost en RegisterAsync

**Files:**
- Modify: `BarberBookSaaS.Infrastructure/Services/CustomerAuthService.cs`
- Modify: `BarberBookSaaS.Tests/CustomerRegistrationTests.cs`

**Interfaces:**
- Consumes: `Customer.PasswordHash == string.Empty` como señal de ghost (producido por Task 1)
- Produces: `RegisterAsync` devuelve respuesta válida si ghost con ese teléfono; `null` si teléfono ya tiene contraseña real

- [ ] **Step 1: Agregar dos tests al archivo existente `CustomerRegistrationTests.cs`**

Abrir `BarberBookSaaS.Tests/CustomerRegistrationTests.cs`. Agregar el using de `Microsoft.EntityFrameworkCore` al principio si no está, y luego agregar estos dos tests después del último test existente `Register_ValidPhoneFormat_Returns200`:

```csharp
using Microsoft.EntityFrameworkCore;
```

```csharp
[Fact]
public async Task Register_WithPhoneOfGhostCustomer_UpgradesGhostAndReturnsOk()
{
    // Seed ghost customer directamente en DB
    using (var seedScope = _factory.Services.CreateScope())
    {
        var db = seedScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.Customers.Add(new Customer
        {
            Id = Guid.NewGuid(), TenantId = TenantId,
            Name = "Ghost Name", Phone = "3005550001",
            PasswordHash = string.Empty,
            LoyaltyCount = 3, CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
    }

    // Registrar con ese teléfono
    var response = await _client.PostAsJsonAsync($"/api/public/{TenantId}/auth/register", new
    {
        name = "Real Name",
        phone = "3005550001",
        password = "Password123!"
    });

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);

    // Verificar que el Customer tiene contraseña y LoyaltyCount preservado
    using var verifyScope = _factory.Services.CreateScope();
    var db2 = verifyScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    var customer = await db2.Customers
        .IgnoreQueryFilters()
        .FirstAsync(c => c.TenantId == TenantId && c.Phone == "3005550001");

    Assert.NotEqual(string.Empty, customer.PasswordHash);
    Assert.Equal("Real Name", customer.Name);
    Assert.Equal(3, customer.LoyaltyCount); // puntos de walk-ins previos conservados
}

[Fact]
public async Task Register_WithPhoneOfRealCustomer_ReturnsBadRequest()
{
    // Primer registro
    var first = await _client.PostAsJsonAsync($"/api/public/{TenantId}/auth/register", new
    {
        name = "Primero",
        phone = "3005550002",
        password = "Password123!"
    });
    Assert.Equal(HttpStatusCode.OK, first.StatusCode);

    // Segundo intento con el mismo teléfono
    var second = await _client.PostAsJsonAsync($"/api/public/{TenantId}/auth/register", new
    {
        name = "Segundo",
        phone = "3005550002",
        password = "OtherPassword123!"
    });

    Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
}
```

Verificar que `BarberBookSaaS.Domain.Entities` y `BarberBookSaaS.Infrastructure.Persistence` ya están en los usings del archivo (ya están — ver líneas 3-4 del archivo original).

- [ ] **Step 2: Correr los tests — deben FALLAR**

```bash
cd BarberBookSaaS.Tests && dotnet test --filter "Register_WithPhoneOfGhostCustomer_UpgradesGhostAndReturnsOk|Register_WithPhoneOfRealCustomer_ReturnsBadRequest" -v n
```

Salida esperada: `UpgradesGhost` FAIL (actualmente devuelve 400 porque trata el ghost como conflicto). `ReturnsBadRequest` puede pasar — está bien.

- [ ] **Step 3: Implementar ghost upgrade en `CustomerAuthService.RegisterAsync`**

En `BarberBookSaaS.Infrastructure/Services/CustomerAuthService.cs`, reemplazar las líneas 47-50:

```csharp
// Antes:
var phoneExists = await _context.Customers
    .IgnoreQueryFilters()
    .AnyAsync(c => c.TenantId == subdomain && c.Phone == dto.Phone);
if (phoneExists) return null;
```

```csharp
// Después:
var existing = await _context.Customers
    .IgnoreQueryFilters()
    .FirstOrDefaultAsync(c => c.TenantId == subdomain && c.Phone == dto.Phone);

if (existing is not null)
{
    if (existing.PasswordHash != string.Empty)
        return null; // teléfono ya registrado con contraseña real

    // Ghost → upgrade: conserva LoyaltyCount e historial de citas
    existing.Name = dto.Name;
    existing.PasswordHash = BCryptNet.HashPassword(dto.Password);
    existing.AcceptedTermsAt = DateTime.UtcNow;
    await _context.SaveChangesAsync();
    return await BuildResponseAsync(existing);
}
```

- [ ] **Step 4: Correr los tests — deben PASAR**

```bash
cd BarberBookSaaS.Tests && dotnet test --filter "Register_WithPhoneOfGhostCustomer_UpgradesGhostAndReturnsOk|Register_WithPhoneOfRealCustomer_ReturnsBadRequest" -v n
```

Salida esperada: ambos PASS.

- [ ] **Step 5: Correr la suite completa — sin regresiones**

```bash
cd BarberBookSaaS.Tests && dotnet test -v n
```

Salida esperada: todos PASS (mínimo 54 + 2 = 56 tests).

- [ ] **Step 6: Commit**

```bash
git add BarberBookSaaS.Infrastructure/Services/CustomerAuthService.cs BarberBookSaaS.Tests/CustomerRegistrationTests.cs
git commit -m "feat: upgrade ghost customer on registration, preserve loyalty count"
```

---

### Task 3: Frontend — campo teléfono en WalkInModal + condición WhatsApp en DiagnosisModal

**Files:**
- Modify: `BarberBookSaaS.Web/src/features/barbers/BarberDashboard.tsx`

**Interfaces:**
- Consumes: `appointmentService.createWalkIn({ serviceId, customerName, appointmentDate, customerPhone? })` — el tipo en `appointmentService.ts` ya acepta `customerPhone?: string`
- Consumes: `appointment.customerPhone` — campo `string?` ya en el tipo `Appointment`

- [ ] **Step 1: Agregar estado `customerPhone` a `WalkInModal`**

En `BarberDashboard.tsx`, dentro de `WalkInModal` (alrededor de línea 530), localizar:

```tsx
  const [error, setError] = useState<string | null>(null);
```

Reemplazar con:

```tsx
  const [error, setError] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState("");
```

- [ ] **Step 2: Agregar campo teléfono en el JSX del formulario**

Localizar el bloque del campo "Nombre" seguido del comentario `{/* Servicio */}`:

```tsx
          {/* Nombre */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              Nombre del cliente *
            </label>
            <input
              type="text"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder="Ej: Carlos García"
              maxLength={100}
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = "var(--color-primary)")}
              onBlur={e => (e.currentTarget.style.borderColor = "var(--color-border)")}
              autoFocus
            />
          </div>

          {/* Servicio */}
```

Reemplazar con:

```tsx
          {/* Nombre */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              Nombre del cliente *
            </label>
            <input
              type="text"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder="Ej: Carlos García"
              maxLength={100}
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = "var(--color-primary)")}
              onBlur={e => (e.currentTarget.style.borderColor = "var(--color-border)")}
              autoFocus
            />
          </div>

          {/* Teléfono */}
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

          {/* Servicio */}
```

- [ ] **Step 3: Pasar `customerPhone` en `handleSubmit`**

Localizar el bloque `handleSubmit` con `appointmentService.createWalkIn` (alrededor de línea 568):

```tsx
      await appointmentService.createWalkIn({
        serviceId,
        customerName: customerName.trim(),
        appointmentDate: `${date}T${time}:00`,
      });
```

Reemplazar con:

```tsx
      await appointmentService.createWalkIn({
        serviceId,
        customerName: customerName.trim(),
        appointmentDate: `${date}T${time}:00`,
        customerPhone: customerPhone.trim() || undefined,
      });
```

`|| undefined` evita enviar `customerPhone: ""` al backend cuando el campo está vacío.

- [ ] **Step 4: Cambiar condición del botón WhatsApp en `DiagnosisModal`**

Localizar alrededor de línea 497:

```tsx
                  {!appointment.isWalkIn && (
                    <button
                      onClick={handleShareWhatsApp}
                      style={{ flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#25D366", color: "#fff", border: "none", cursor: "pointer" }}
                    >
                      <Share2 size={14} /> WhatsApp
                    </button>
                  )}
```

Reemplazar con:

```tsx
                  {appointment.customerPhone && (
                    <button
                      onClick={handleShareWhatsApp}
                      style={{ flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#25D366", color: "#fff", border: "none", cursor: "pointer" }}
                    >
                      <Share2 size={14} /> WhatsApp
                    </button>
                  )}
```

- [ ] **Step 5: Verificar TypeScript sin errores**

```bash
cd BarberBookSaaS.Web && npx tsc --noEmit
```

Salida esperada: sin output, exit code 0. Si hay errores de tipo, corregirlos antes de continuar.

- [ ] **Step 6: Commit**

```bash
git add BarberBookSaaS.Web/src/features/barbers/BarberDashboard.tsx
git commit -m "feat: phone field in WalkInModal + WhatsApp for walk-ins with phone"
```

---

## After all tasks

```bash
git push origin main
```

---

## Self-Review

**Spec coverage:**
- Walk-in sin teléfono → no Customer, no loyalty ✓ Task 1 `NoPhone_DoesNotCreateCustomer`
- Walk-in con teléfono nuevo → ghost Customer, loyalty ✓ Task 1 `WithNewPhone_CreatesGhostCustomerAndAccruesLoyalty`
- Walk-in con ghost existente → reutiliza, acumula ✓ Task 1 `WithPhoneOfExistingGhost_ReusesAndAccruesLoyalty`
- Walk-in con real existente → reutiliza, acumula ✓ Task 1 `WithPhoneOfRealCustomer_ReusesAndAccruesLoyalty`
- Walk-in IA → no acumula loyalty ✓ Task 1 `AiService_DoesNotAccrueLoyalty`
- Tenant sin loyalty → no acumula ✓ Task 1 `LoyaltyDisabledTenant_DoesNotAccrueLoyalty`
- RegisterAsync ghost → upgrade, puntos preservados ✓ Task 2 `UpgradesGhostAndReturnsOk`
- RegisterAsync real → rechazado ✓ Task 2 `ReturnsBadRequest`
- Campo teléfono en WalkInModal ✓ Task 3 Steps 1-3
- Botón WhatsApp condición ✓ Task 3 Step 4
