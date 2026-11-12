# WhatsApp Meta Fase 2 — Ruta pública `/r/:token` (Reprogramar desde WhatsApp)

## Objetivo

Implementar el consumo del token generado en Fase 1: cuando un cliente toca el botón "Reprogramar" en un mensaje de WhatsApp (plantillas `cita_confirmada`, `cita_reprogramada`, `cita_recordatorio`), debe llegar a una página pública `/r/:token` donde puede elegir un nuevo horario para su cita **sin necesidad de iniciar sesión** — el token HMAC firmado (`IAppointmentTokenService`) prueba que la cita le pertenece.

## Decisiones de diseño

**A. Autenticación = posesión del token (sin login).** El token firmado (`{base64url(payload)}.{base64url(firma)}`, `payload = "{appointmentId:N}|{expiresAtUtc.Ticks}"`, `expiresAtUtc` = fecha de la cita en el momento de envío) es la única prueba de identidad. No se requiere `customer_token` ni sesión de cliente.

**B. El token no contiene el subdominio.** `/r/:token` es una ruta global del frontend (no `/:subdomain/...`). El backend resuelve el tenant a partir de `Appointment.TenantId` (vía `IgnoreQueryFilters()`), y la respuesta del GET incluye el subdominio + branding del tenant para que el frontend pueda aplicar colores/logo y, si hace falta, llamar a `/api/public/{subdomain}/availability`. `TokenAppointmentDto.Subdomain` se llena con `appointment.TenantId` (== `Tenant.Id`, la clave usada en `X-Tenant-Id`/rutas `/api/public/{subdomain}/...`), **no** con `Tenant.Subdomain` (campo informativo separado que puede no coincidir).

**C. Lógica de reprogramación compartida.** La reprogramación "Mis citas" (logueado, `PublicBookingController.RescheduleAppointment`, ya implementada sin commitear) y la reprogramación por token comparten exactamente las mismas reglas de negocio (estado `Pendiente`, ≥1h de antelación, nueva fecha posterior, slot disponible, notificación WhatsApp). Esa lógica se extrae a `IAppointmentService.RescheduleAppointmentAsync(Guid appointmentId, DateTime newAppointmentDate)`. Los controladores solo difieren en cómo prueban la propiedad de la cita (JWT de cliente vs. token firmado).

**D. Errores de token = genéricos, sin contexto de tenant.** `AppointmentTokenService.ValidateToken` devuelve `null` tanto para tokens inválidos/manipulados como expirados (no distingue). Por lo tanto, cuando el token no valida, el GET responde `404` sin información de tenant, y el frontend muestra un mensaje genérico sin branding ("Este enlace no es válido o ha expirado") con un enlace a `/`. No se modifica `AppointmentTokenService` (infraestructura ya completada y testeada en Fase 1).

**E. `canReschedule` se calcula en el GET y se re-valida en el PUT.** El GET informa si la cita todavía es reprogramable (`Status == Pendiente && (AppointmentDate - UtcNow) > 1h`) para que el frontend decida si mostrar el selector de horario o un mensaje. El PUT (`RescheduleAppointmentAsync`) es la fuente de verdad y vuelve a aplicar las mismas reglas — el GET es solo informativo.

---

## Backend

### Nuevo: `RescheduleResult` (DTO de servicio)

`BarberBookSaaS.Application/DTOs/Appointments/RescheduleResult.cs` — mismo patrón que `BookingResult`:

```csharp
public class RescheduleResult
{
    public bool Success { get; init; }
    public Appointment? Appointment { get; init; }
    public string? ErrorCode { get; init; }
    public string? ErrorMessage { get; init; }

    public static RescheduleResult Ok(Appointment appointment) =>
        new() { Success = true, Appointment = appointment };

    public static RescheduleResult Fail(string errorCode, string errorMessage) =>
        new() { Success = false, ErrorCode = errorCode, ErrorMessage = errorMessage };
}
```

Códigos de error: `NOT_FOUND`, `NOT_PENDING`, `TOO_LATE`, `NOT_LATER`, `SCHEDULE_CONFLICT`.

### Modificado: `IAppointmentService` + `AppointmentService`

Nuevo método:

```csharp
Task<RescheduleResult> RescheduleAppointmentAsync(Guid appointmentId, DateTime newAppointmentDate);
```

Implementación — extrae la lógica actual de `PublicBookingController.RescheduleAppointment` (líneas posteriores a las validaciones de auth/ownership):

1. Buscar `Appointment` (con `Include(Barber)`) por `appointmentId` → si no existe, `Fail("NOT_FOUND", ...)`.
2. `Status != Pendiente` → `Fail("NOT_PENDING", "Solo se pueden reprogramar citas en estado Pendiente.")`.
3. `(AppointmentDate - UtcNow).TotalMinutes <= 60` → `Fail("TOO_LATE", "No es posible reprogramar con menos de 1 hora de antelación.")`.
4. `newAppointmentDate <= AppointmentDate` → `Fail("NOT_LATER", "La nueva fecha debe ser posterior a la cita actual.")`.
5. `GetAvailabilityAsync(...)` con `excludeAppointmentId = appointmentId` → si el slot solicitado no está disponible, `Fail("SCHEDULE_CONFLICT", "El horario seleccionado no está disponible.")`.
6. Actualizar `AppointmentDate = newAppointmentDate`, `ReminderSentAt = null`, `SaveChangesAsync()`.
7. Si `Tenant.WhatsAppEnabled` y `CustomerPhone` presente → `_whatsAppService.SendRescheduleAsync(...)` (igual que hoy).
8. `RescheduleResult.Ok(appointment)`.

### Modificado: `PublicBookingController.RescheduleAppointment`

Mantiene las validaciones de auth/ownership existentes (subdomain == JWT tenant, `appointment.CustomerId == customerId`), pero delega el resto a `_appointmentService.RescheduleAppointmentAsync(id, dto.NewAppointmentDate)` y mapea `RescheduleResult` a la misma respuesta HTTP que devuelve hoy (sin cambios visibles para el frontend existente).

### Nuevo: `TokenAppointmentDto`

`BarberBookSaaS.Application/DTOs/Appointments/TokenAppointmentDto.cs`:

```csharp
public class TokenAppointmentDto
{
    public string Subdomain { get; set; } = string.Empty;
    public string? TenantName { get; set; }
    public string Theme { get; set; } = "dark-premium";
    public string PrimaryColor { get; set; } = "#D4AF37";
    public string SecondaryColor { get; set; } = "#6366F1";
    public string? LogoBase64 { get; set; }

    public Guid AppointmentId { get; set; }
    public Guid BarberId { get; set; }
    public Guid ServiceId { get; set; }
    public string BarberName { get; set; } = string.Empty;
    public string ServiceName { get; set; } = string.Empty;
    public DateTime AppointmentDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public bool CanReschedule { get; set; }
}
```

### Nuevo: `AppointmentRescheduleLinkController`

`BarberBookSaaS.WebApi/Controllers/AppointmentRescheduleLinkController.cs`, ruta `api/public/reschedule`:

- **`GET /api/public/reschedule/{token}`** — `[AllowAnonymous]`
  - `var appointmentId = _tokenService.ValidateToken(token);` → `null` ⇒ `404 { message = "Este enlace no es válido o ha expirado." }`.
  - Buscar `Appointment` con `IgnoreQueryFilters()` + `Include(Barber)` + `Include(Service)` por `appointmentId` → `null` ⇒ `404` (mismo mensaje).
  - Buscar `Tenant` por `appointment.TenantId` (tabla `Tenants` no es multi-tenant) → `null` ⇒ `404`.
  - `canReschedule = appointment.Status == Pendiente && (appointment.AppointmentDate - DateTime.UtcNow) > TimeSpan.FromHours(1)`.
  - Devuelve `TokenAppointmentDto` (200).

- **`PUT /api/public/reschedule/{token}`** — `[AllowAnonymous]`, body `RescheduleAppointmentDto { NewAppointmentDate }`
  - Re-valida el token → `null` ⇒ `404`.
  - Busca `Appointment` con `IgnoreQueryFilters()` → `null` ⇒ `404`.
  - `_tenantService.TenantId = appointment.TenantId;` (mismo patrón que `WhatsAppWebhookController`, necesario para que `RescheduleAppointmentAsync` use los QueryFilters/contexto de tenant correctos).
  - `var result = await _appointmentService.RescheduleAppointmentAsync(appointmentId.Value, dto.NewAppointmentDate);`
  - Mapeo de errores: `NOT_FOUND` → 404, `NOT_PENDING`/`TOO_LATE`/`NOT_LATER` → 400, `SCHEDULE_CONFLICT` → 409.
  - Éxito → `200 { appointmentId, appointmentDate, status, message = "Cita reprogramada correctamente." }` (mismo shape que el endpoint de "Mis citas", reutilizable por el frontend).

### Tests

- `BarberBookSaaS.Tests/AppointmentRescheduleLinkTests.cs`:
  - GET con token válido y cita reprogramable → 200 con `canReschedule = true` y datos correctos.
  - GET con token válido pero cita no reprogramable (cancelada / <1h) → 200 con `canReschedule = false`.
  - GET con token inválido/manipulado → 404 genérico.
  - PUT con token válido + slot disponible → 200, `Appointment.AppointmentDate` actualizado, `ReminderSentAt` reseteado.
  - PUT con conflicto de horario → 409 `SCHEDULE_CONFLICT`.
  - PUT con token inválido → 404.
- Si no existen tests para `PublicBookingController.RescheduleAppointment` (la feature "Mis citas" está sin commitear y sin tests), agregar al menos un test de regresión que cubra el camino feliz tras el refactor de `RescheduleAppointmentAsync`.

---

## Frontend

### Extraer `RescheduleForm` de `RescheduleModal`

Nuevo `BarberBookSaaS.Web/src/features/booking/RescheduleForm.tsx` — componente presentacional sin portal/backdrop/header:

```typescript
interface RescheduleFormProps {
  subdomain: string;
  barberId: string;
  serviceId: string;
  appointmentId: string;
  currentAppointmentDate: string; // ISO
  primaryColor: string;
  onSubmit: (newAppointmentDateIso: string) => Promise<void>; // debe rechazar con Error(message) en fallo
}
```

Contiene la lógica actual de `RescheduleModal` (carga de slots vía `bookingService.getAvailability`, selector de fecha, grid de horarios, botón "Confirmar nuevo horario", estado `submitting`/`error`).

`RescheduleModal.tsx` se reduce a: portal + backdrop + panel + título/subtítulo (resumen de la cita) + `<RescheduleForm onSubmit={...}>` (que llama a `bookingService.rescheduleAppointment(subdomain, appointment.id, newDate)` y luego `onRescheduled(); onClose();`) + botón "Cancelar". Sin cambios de comportamiento para "Mis citas".

### Nuevos tipos en `bookingTypes.ts`

```typescript
export interface TokenAppointment {
  subdomain: string;
  tenantName?: string;
  theme: string;
  primaryColor: string;
  secondaryColor: string;
  logoBase64?: string;
  appointmentId: string;
  barberId: string;
  serviceId: string;
  barberName: string;
  serviceName: string;
  appointmentDate: string;
  status: string;
  canReschedule: boolean;
}
```

### Nuevos métodos en `bookingService.ts`

```typescript
getAppointmentByToken: async (token: string): Promise<TokenAppointment> => {
  const r = await publicApiClient.get<TokenAppointment>(`/api/public/reschedule/${token}`);
  return r.data;
},

rescheduleAppointmentByToken: async (
  token: string,
  newAppointmentDate: string
): Promise<RescheduleResult> => {
  const r = await publicApiClient.put<RescheduleResult>(`/api/public/reschedule/${token}`, { newAppointmentDate });
  return r.data;
},
```

### Nueva página `ReschedulePage.tsx`

`BarberBookSaaS.Web/src/features/booking/ReschedulePage.tsx`, montada en `/r/:token`. Estados:

1. **loading** — spinner mientras `getAppointmentByToken(token)` resuelve.
2. **invalid** (404 o error de red) — tarjeta genérica sin branding: "Este enlace no es válido o ha expirado." + botón/enlace a `/`.
3. **loaded, `canReschedule = false`** — tarjeta con branding del tenant (logo/nombre si existen, `--color-primary`/`--color-secondary` aplicados) mostrando resumen de la cita (servicio, barbero, fecha/hora, estado) + mensaje explicando por qué no se puede reprogramar (cita ya cancelada/completada, o falta menos de 1 hora).
4. **loaded, `canReschedule = true`** — misma tarjeta con resumen + `<RescheduleForm subdomain={data.subdomain} barberId={...} serviceId={...} appointmentId={...} currentAppointmentDate={data.appointmentDate} primaryColor={data.primaryColor} onSubmit={...} />`, donde `onSubmit` llama a `rescheduleAppointmentByToken(token, newDate)`.
5. **success** — tras el `onSubmit` exitoso, la tarjeta reemplaza el formulario por una confirmación con la nueva fecha/hora ("¡Listo! Tu cita fue reprogramada para el ...").

Branding: al recibir la respuesta, aplicar `document.documentElement.style.setProperty("--color-primary", data.primaryColor)` (y `--color-secondary`), igual que `BookingPage`. El tema base permanece en el default (`dark-premium`) sin llamar a `applyBranding`.

### Nueva ruta en `App.tsx`

```tsx
<Route path="/r/:token" element={<ReschedulePage />} />
```

Añadida junto a las demás rutas públicas (`/book/:subdomain`, `/review/:subdomain`).

---

## Archivos

**Crear:**
- `BarberBookSaaS.Application/DTOs/Appointments/RescheduleResult.cs`
- `BarberBookSaaS.Application/DTOs/Appointments/TokenAppointmentDto.cs`
- `BarberBookSaaS.WebApi/Controllers/AppointmentRescheduleLinkController.cs`
- `BarberBookSaaS.Tests/AppointmentRescheduleLinkTests.cs`
- `BarberBookSaaS.Web/src/features/booking/RescheduleForm.tsx`
- `BarberBookSaaS.Web/src/features/booking/ReschedulePage.tsx`

**Modificar:**
- `BarberBookSaaS.Application/Common/IAppointmentService.cs` (+`RescheduleAppointmentAsync`)
- `BarberBookSaaS.Infrastructure/Services/AppointmentService.cs` (+implementación)
- `BarberBookSaaS.WebApi/Controllers/PublicBookingController.cs` (`RescheduleAppointment` delega al servicio)
- `BarberBookSaaS.Web/src/features/booking/RescheduleModal.tsx` (usa `RescheduleForm`)
- `BarberBookSaaS.Web/src/features/booking/bookingTypes.ts` (+`TokenAppointment`)
- `BarberBookSaaS.Web/src/features/booking/bookingService.ts` (+`getAppointmentByToken`, `rescheduleAppointmentByToken`)
- `BarberBookSaaS.Web/src/App.tsx` (+ruta `/r/:token`)
- `CLAUDE.md` / `docs/HISTORIAL.md` / `docs/API_REFERENCE.md` / `docs/DECISIONES_DISENO.md` (documentación + marcar Fase 2 como completada en el roadmap)

---

## Fuera de alcance

- No se modifica `AppointmentTokenService` (no distingue "expirado" de "inválido" — limitación aceptada, Decisión D).
- No se agrega rate limiting específico al nuevo controlador (el token HMAC no es adivinable por fuerza bruta).
- No se cambia el comportamiento de `cita_cancelada` (sin botones, Fase 1).
- `api/public/reschedule/{token}` introduce "reschedule" como segmento reservado dentro de `api/public/*` (un tenant con subdominio literal "reschedule" colisionaría con esta ruta). No se agrega validación — limitación aceptada, igual de improbable que otros literales ya usados (`barbers`, `services`, `availability`, `reviews`).
