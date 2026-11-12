# Diseño: Backend Robusto — BarberBook SaaS

**Fecha:** 2026-05-26  
**Actualizado:** 2026-05-26 (v2 — puntos débiles + flujo de barberos)  
**Estado:** Aprobado  
**Objetivo:** Dejar el backend completo, seguro y sin deuda técnica antes de implementar el frontend visualmente. Cubre limpieza de arquitectura, booking público para clientes, sistema de fidelización opcional, métricas de dashboard, seguridad de autenticación y flujo unificado de creación de barberos.

---

## Contexto

El backend actual tiene dos tipos de problemas:

**Deuda técnica existente:**
- `BarbersController` y `ServicesController` aceptan entidades de dominio en el body (riesgo de seguridad: el cliente puede enviar `TenantId` o `Id` arbitrarios)
- Controllers hablan directo a `_context` en vez de pasar por el service layer
- Sin manejo global de excepciones — errores inesperados devuelven stack trace en producción
- Estados de cita (`"Pendiente"`, `"Completada"`, `"Cancelada"`) son strings mágicos — frágiles y sin validación
- Sin rate limiting en endpoints de auth — vulnerables a fuerza bruta
- JWT de 7 días sin refresh token — mala experiencia cuando expira
- `User` y `Barber` son entidades desconectadas — un barbero puede existir sin cuenta de acceso y viceversa

**Features faltantes:**
- Endpoints públicos para que clientes agenden sin JWT
- `Customer` entity con auth por teléfono + contraseña (por tenant)
- Sistema de fidelización opcional (admin activa/configura)
- Dashboard stats endpoint
- Paginación en citas

---

## Sección 1 — Limpieza de arquitectura

### DTOs para inputs

Se crean DTOs dedicados para eliminar el binding directo a entidades de dominio:

**Nuevos archivos en `BarberBookSaaS.Application/DTOs/`:**
- `Barbers/CreateBarberDto.cs` — `Name`, `Email`, `Phone`, `Specialty`
- `Barbers/UpdateBarberDto.cs` — mismos campos
- `Services/CreateServiceDto.cs` — `Name`, `Price`, `DurationMinutes`
- `Services/UpdateServiceDto.cs` — mismos campos

### Service layer consistente

Se crean interfaces e implementaciones para barberos y servicios. Los controllers dejan de acceder a `_context` directamente.

**Nuevas interfaces en `BarberBookSaaS.Application/Common/`:**
- `IBarberService.cs`
- `IServiceService.cs`

**Métodos de `IBarberService`:**
```csharp
Task<IEnumerable<Barber>> GetAllAsync();
Task<Barber> CreateAsync(CreateBarberDto dto);
Task<Barber?> UpdateAsync(Guid id, UpdateBarberDto dto);
Task<bool> DeleteAsync(Guid id);       // soft-delete
Task<bool> ActivateAsync(Guid id);     // reactivar
Task<IEnumerable<BarberSchedule>> GetScheduleAsync(Guid id);
Task UpsertScheduleDayAsync(Guid id, BarberScheduleDto dto);
Task DeleteScheduleDayAsync(Guid id, int day);
```

**Métodos de `IServiceService`:**
```csharp
Task<IEnumerable<Service>> GetAllAsync();
Task<Service> CreateAsync(CreateServiceDto dto);
Task<Service?> UpdateAsync(Guid id, UpdateServiceDto dto);
Task<bool> DeleteAsync(Guid id);       // soft-delete
Task<bool> ActivateAsync(Guid id);     // reactivar
```

**`IAppointmentService` se extiende con:**
```csharp
Task<PagedResult<Appointment>> GetAllAsync(int page, int pageSize, string? status, DateTime? from, DateTime? to);
Task<Appointment?> UpdateStatusAsync(Guid id, string status);
Task<IEnumerable<object>> GetAvailabilityAsync(Guid barberId, Guid serviceId, DateOnly date);
```

### Middleware global de excepciones

**Nuevo archivo:** `BarberBookSaaS.WebApi/Middleware/ExceptionHandlingMiddleware.cs`

Captura cualquier excepción no controlada y devuelve siempre:
```json
{ "error": "Mensaje legible", "statusCode": 500 }
```
En `Development` incluye el detalle de la excepción. En `Production` solo el mensaje genérico.

### Endpoints para reactivar soft-deleted

```
PUT /api/barbers/{id}/activate    — IsActive = true
PUT /api/services/{id}/activate   — IsActive = true
```

---

## Sección 2 — Customer entity + autenticación por teléfono

### Entidad `Customer`

**Archivo:** `BarberBookSaaS.Domain/Entities/Customer.cs`

```csharp
public class Customer : IMustHaveTenant
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;       // único por tenant
    public string PasswordHash { get; set; } = string.Empty;
    public int LoyaltyCount { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
```

El teléfono es único **por tenant** — el mismo número puede registrarse en distintas barberías.

### Endpoints de auth del cliente

Prefijo público, sin JWT requerido:

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/public/{subdomain}/auth/register` | Crea cuenta con nombre, teléfono y contraseña |
| POST | `/api/public/{subdomain}/auth/login` | Login → devuelve JWT de cliente |

**Body register:**
```json
{ "name": "Juan Pérez", "phone": "3001234567", "password": "mi_clave" }
```

**Respuesta login:**
```json
{
  "token": "...",
  "customerId": "...",
  "name": "Juan Pérez",
  "phone": "3001234567",
  "tenantId": "juanpablo",
  "loyaltyCount": 3
}
```

El JWT del cliente incluye claims: `customerId`, `tenantId`, `role: Customer`. El `TenantMiddleware` existente lo resuelve igual que hoy porque `TenantId` está en el claim.

Las contraseñas se hashean con BCrypt, reutilizando la misma lógica que `AuthService`.

### Nueva interfaz

**Archivo:** `BarberBookSaaS.Application/Common/ICustomerAuthService.cs`

```csharp
Task<CustomerAuthResponseDto?> RegisterAsync(string subdomain, RegisterCustomerDto dto);
Task<CustomerAuthResponseDto?> LoginAsync(string subdomain, LoginCustomerDto dto);
```

---

## Sección 3 — Endpoints públicos de agendamiento

Todos bajo `/api/public/{subdomain}`. Los tres primeros son anónimos, el último requiere JWT de cliente.

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/public/{subdomain}/barbers` | No | Lista barberos activos del tenant |
| GET | `/api/public/{subdomain}/services` | No | Lista servicios activos del tenant |
| GET | `/api/public/{subdomain}/availability` | No | Slots disponibles (`?barberId=&serviceId=&date=`) |
| POST | `/api/public/{subdomain}/appointments` | JWT Cliente | Crea cita |

**Body `POST .../appointments`:**
```json
{ "barberId": "...", "serviceId": "...", "appointmentDate": "2026-06-01T10:00:00" }
```

El nombre y teléfono del cliente se toman del JWT — no se reenvían en el body.

**Lógica de agendamiento público:**
1. Valida que el subdomain exista
2. Reutiliza `AppointmentService.CreateAppointmentAsync` (motor de colisiones ya implementado)
3. Si `tenant.LoyaltyEnabled = true`: incrementa `customer.LoyaltyCount += 1`
4. Si `tenant.LoyaltyEnabled = true` y `LoyaltyCount >= LoyaltyThreshold` → marca la cita `IsFree: true` y resetea `LoyaltyCount = 0`
5. Si `tenant.LoyaltyEnabled = false`: no se toca `LoyaltyCount`, `IsFree` siempre es `false`

**Nuevo campo en `Appointment`:**
```csharp
public bool IsFree { get; set; } = false;
```

**Nuevo controlador:** `BarberBookSaaS.WebApi/Controllers/PublicBookingController.cs`

---

## Sección 4 — Sistema de fidelización

### Nuevos campos en `Tenant`

```csharp
public bool LoyaltyEnabled { get; set; } = false;   // false = la feature no existe para este tenant
public int LoyaltyThreshold { get; set; } = 10;      // citas necesarias para el beneficio (configurable)
```

Cuando `LoyaltyEnabled = false` (valor por defecto para todo tenant nuevo):
- El contador `LoyaltyCount` del cliente no se incrementa
- El cliente no recibe información de fidelización en ningún endpoint
- `IsFree` nunca se activa en ninguna cita

El admin activa la feature explícitamente desde el panel. Si la desactiva después de tenerla activa, el contador se congela y se retoma si la vuelve a activar.

### Endpoints de configuración (solo Admin)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/tenant/loyalty` | Obtiene config actual de fidelización |
| PUT | `/api/tenant/loyalty` | Activa/desactiva y define el umbral |

**Body `PUT /api/tenant/loyalty`:**
```json
{ "enabled": true, "threshold": 10 }
```

### Endpoint de perfil del cliente (JWT Cliente)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/customer/me` | Perfil + progreso de fidelización |

**Respuesta:**
```json
{
  "name": "Juan Pérez",
  "phone": "3001234567",
  "loyaltyCount": 7,
  "loyaltyThreshold": 10,
  "loyaltyEnabled": true
}
```

### Nueva interfaz

**Archivo:** `BarberBookSaaS.Application/Common/ILoyaltyService.cs`

```csharp
Task<LoyaltyConfigDto?> GetLoyaltyConfigAsync();
Task<bool> UpdateLoyaltyConfigAsync(UpdateLoyaltyDto dto);
```

`IBrandingService` se mantiene separado — cada interfaz tiene una sola responsabilidad. `BrandingController` sigue usando `IBrandingService`, y se crea un nuevo `LoyaltyController` que usa `ILoyaltyService`.

---

## Sección 5 — Dashboard stats y paginación

### Dashboard stats

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/dashboard/stats` | JWT Admin/Barbero | Métricas del tenant activo |

**Respuesta:**
```json
{
  "todayAppointments": 8,
  "todayRevenue": 320.00,
  "pendingAppointments": 3,
  "totalActiveBarbers": 4,
  "busiestBarber": { "name": "Carlos", "appointmentsToday": 4 }
}
```

- `todayRevenue`: suma de `Service.Price` de citas del día con estado `Completada`
- `busiestBarber`: barbero con más citas no canceladas hoy
- `pendingAppointments`: citas con estado `Pendiente` (todo el tenant, no solo hoy)

**Nueva interfaz:** `IDashboardService` en Application/Common.

### Paginación en citas

`GET /api/appointments?page=1&pageSize=20&status=Pendiente&from=2026-06-01&to=2026-06-30`

**Respuesta:**
```json
{
  "data": [...],
  "total": 150,
  "page": 1,
  "pageSize": 20,
  "totalPages": 8
}
```

**Nuevo DTO genérico:** `BarberBookSaaS.Application/DTOs/PagedResult.cs`

```csharp
public class PagedResult<T>
{
    public IEnumerable<T> Data { get; set; } = [];
    public int Total { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (int)Math.Ceiling((double)Total / PageSize);
}
```

---

## Sección 6 — Flujo unificado de creación de barberos

### Problema actual

Hoy existen dos entidades desconectadas:
- `Barber` — entidad operacional (horarios, citas, especialidad)
- `User` — entidad de autenticación (email, password, rol `Barbero`)

Un admin puede crear un `Barber` sin que ese barbero tenga cuenta para entrar al sistema, y puede crear un `User` con rol `Barbero` sin que esté vinculado a ningún barbero operacional. Esta inconsistencia causa confusión y errores.

### Solución: creación atómica Admin → Barbero

Cuando el admin crea un barbero desde el panel, el sistema crea **en una sola transacción** tanto el `Barber` operacional como su `User` de acceso vinculado.

**Nuevo campo en `Barber`:**
```csharp
public Guid? UserId { get; set; }   // FK hacia User — null si el barbero no tiene cuenta aún
```

**Nuevo campo en `User`:**
```csharp
public bool MustChangePassword { get; set; } = false;
```

**Flujo completo:**
1. Admin llena nombre, email, teléfono y especialidad del barbero
2. `POST /api/barbers` recibe el `CreateBarberDto` (que ahora incluye email obligatorio)
3. `BarberService.CreateAsync` ejecuta en transacción:
   - Crea el `Barber` con los datos operacionales
   - Crea el `User` con rol `Barbero`, email del barbero, contraseña temporal hasheada con BCrypt, y `MustChangePassword = true`
   - Asigna `Barber.UserId = user.Id`
4. El admin ve la contraseña temporal **una sola vez** en la respuesta (no se almacena en texto plano)
5. El admin comparte email + contraseña temporal al barbero
6. Al hacer login por primera vez, el JWT incluye el claim `mustChangePassword: true`
7. El frontend redirige al barbero a cambiar su contraseña antes de poder usar el sistema

**Respuesta de `POST /api/barbers` (solo en creación):**
```json
{
  "barber": { "id": "...", "name": "Carlos", "email": "carlos@barberia.com", ... },
  "temporaryPassword": "Barb3r@2026"   // solo se devuelve esta vez
}
```

**Endpoint para cambio de contraseña obligatorio:**
```
POST /api/auth/change-password
Body: { "currentPassword": "...", "newPassword": "..." }
Auth: JWT (cualquier rol)
```
Después de cambiar contraseña, `MustChangePassword` se pone en `false`.

### Contraseña temporal

La contraseña temporal se genera automáticamente: 12 caracteres alfanuméricos + símbolo. No se almacena — solo se devuelve en el response de creación y se guarda hasheada.

---

## Sección 7 — Seguridad de autenticación

### 7.1 — Estados de cita como constantes

Los strings mágicos `"Pendiente"`, `"Completada"`, `"Cancelada"` se reemplazan por una clase de constantes estática:

**Nuevo archivo:** `BarberBookSaaS.Domain/Constants/AppointmentStatus.cs`

```csharp
namespace BarberBookSaaS.Domain.Constants;

public static class AppointmentStatus
{
    public const string Pending   = "Pendiente";
    public const string Completed = "Completada";
    public const string Cancelled = "Cancelada";

    public static readonly IReadOnlyList<string> All = [Pending, Completed, Cancelled];
    public static bool IsValid(string status) => All.Contains(status);
}
```

`UpdateAppointmentStatusDto` valida que el status sea uno de los valores permitidos antes de llegar al servicio. `AppointmentService` y todos los demás usos de strings de estado se reemplazan por las constantes.

### 7.2 — Rate limiting en endpoints de autenticación

Se usa el middleware nativo de ASP.NET Core 10 (`Microsoft.AspNetCore.RateLimiting`) — sin dependencias externas.

**Configuración en `Program.cs`:**
```csharp
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("auth", opt =>
    {
        opt.PermitLimit = 5;           // máx 5 intentos
        opt.Window = TimeSpan.FromMinutes(15);
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit = 0;
    });
});
```

**Endpoints protegidos con `[EnableRateLimiting("auth")]`:**
- `POST /api/auth/login`
- `POST /api/public/{subdomain}/auth/login`
- `POST /api/public/{subdomain}/auth/register`
- `POST /api/auth/change-password`

Respuesta cuando se supera el límite: `HTTP 429 Too Many Requests`.

### 7.3 — Refresh token

El JWT de acceso pasa de **7 días a 1 hora**. Se agrega un refresh token de **30 días**.

**Nuevo campo en `User`:**
```csharp
public string? RefreshToken { get; set; }
public DateTime? RefreshTokenExpiresAt { get; set; }
```

**Nuevos endpoints:**
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/auth/refresh` | No | Intercambia refresh token por nuevo access token |
| POST | `/api/auth/logout` | JWT | Invalida el refresh token actual |

**Body `POST /api/auth/refresh`:**
```json
{ "refreshToken": "..." }
```

**Respuesta:**
```json
{ "token": "...", "refreshToken": "...", "expiresAt": "2026-06-26T..." }
```

**Flujo:**
1. Login devuelve `token` (1h) + `refreshToken` (30 días)
2. Cuando el `token` expira, el frontend llama a `/api/auth/refresh` con el `refreshToken`
3. Se valida que el `refreshToken` exista en DB y no esté expirado
4. Se devuelve nuevo `token` + nuevo `refreshToken` (rotación)
5. El `refreshToken` anterior queda invalidado en DB
6. `POST /api/auth/logout` pone `RefreshToken = null` en DB

Aplica igualmente para `CustomerAuthService` — misma lógica de refresh para clientes públicos.

**Nueva migración requerida:** `AgregarRefreshTokenYMustChangePassword`
- Columnas `RefreshToken`, `RefreshTokenExpiresAt`, `MustChangePassword` en tabla `Users`
- Columna `UserId` en tabla `Barbers`

---

## Resumen de archivos nuevos y modificados

### Archivos NUEVOS

| Archivo | Propósito |
|---------|-----------|
| `Domain/Entities/Customer.cs` | Entidad cliente con loyalty count |
| `Application/DTOs/Barbers/CreateBarberDto.cs` | DTO creación barbero |
| `Application/DTOs/Barbers/UpdateBarberDto.cs` | DTO actualización barbero |
| `Application/DTOs/Services/CreateServiceDto.cs` | DTO creación servicio |
| `Application/DTOs/Services/UpdateServiceDto.cs` | DTO actualización servicio |
| `Application/DTOs/Customers/RegisterCustomerDto.cs` | DTO registro cliente |
| `Application/DTOs/Customers/LoginCustomerDto.cs` | DTO login cliente |
| `Application/DTOs/Customers/CustomerAuthResponseDto.cs` | DTO respuesta auth cliente |
| `Application/DTOs/PagedResult.cs` | DTO paginación genérico |
| `Application/DTOs/Dashboard/DashboardStatsDto.cs` | DTO métricas dashboard |
| `Application/DTOs/Tenant/LoyaltyConfigDto.cs` | DTO config fidelización |
| `Application/DTOs/Tenant/UpdateLoyaltyDto.cs` | DTO actualizar loyalty |
| `Application/Common/IBarberService.cs` | Interfaz servicio barberos |
| `Application/Common/IServiceService.cs` | Interfaz servicio servicios |
| `Application/Common/ICustomerAuthService.cs` | Interfaz auth clientes |
| `Application/Common/IDashboardService.cs` | Interfaz dashboard |
| `Application/Common/ILoyaltyService.cs` | Interfaz sistema de fidelización (separada de IBrandingService) |
| `Infrastructure/Services/BarberService.cs` | Implementación IBarberService |
| `Infrastructure/Services/ServiceService.cs` | Implementación IServiceService |
| `Infrastructure/Services/CustomerAuthService.cs` | Implementación ICustomerAuthService |
| `Infrastructure/Services/DashboardService.cs` | Implementación IDashboardService |
| `Infrastructure/Services/LoyaltyService.cs` | Implementación ILoyaltyService |
| `WebApi/Controllers/PublicBookingController.cs` | Endpoints públicos cliente |
| `WebApi/Controllers/CustomerController.cs` | GET /api/customer/me |
| `WebApi/Controllers/DashboardController.cs` | GET /api/dashboard/stats |
| `WebApi/Controllers/LoyaltyController.cs` | GET/PUT /api/tenant/loyalty |
| `WebApi/Middleware/ExceptionHandlingMiddleware.cs` | Manejo global de errores |
| `Domain/Constants/AppointmentStatus.cs` | Constantes de estado de cita |
| `Application/DTOs/Auth/ChangePasswordDto.cs` | DTO cambio de contraseña |
| `Application/DTOs/Auth/RefreshTokenDto.cs` | DTO refresh token |
| `Application/DTOs/Auth/RefreshTokenResponseDto.cs` | DTO respuesta refresh |

### Archivos MODIFICADOS

| Archivo | Qué cambia |
|---------|------------|
| `Domain/Entities/Tenant.cs` | +`LoyaltyEnabled`, `LoyaltyThreshold` |
| `Domain/Entities/Appointment.cs` | +`IsFree` |
| `Domain/Entities/Barber.cs` | +`UserId` (FK opcional a User) |
| `Domain/Entities/User.cs` | +`MustChangePassword`, `RefreshToken`, `RefreshTokenExpiresAt` |
| `Application/Common/IAppointmentService.cs` | +`GetAllAsync` paginado, `UpdateStatusAsync`, `GetAvailabilityAsync` |
| `Application/Common/IAuthService.cs` | +`RefreshTokenAsync`, `LogoutAsync`, `ChangePasswordAsync` |
| `Application/DTOs/Auth/AuthResponseDto.cs` | +`refreshToken`, `mustChangePassword` |
| `Infrastructure/Services/AppointmentService.cs` | +métodos nuevos, usa `AppointmentStatus` constantes |
| `Infrastructure/Services/AuthService.cs` | +refresh token, logout, change password, contraseña temporal en creación barbero |
| `Infrastructure/Services/BrandingService.cs` | Sin cambios |
| `WebApi/Controllers/AuthController.cs` | +endpoints refresh, logout, change-password |
| `WebApi/Controllers/BarbersController.cs` | Usa `IBarberService`, DTOs, creación atómica Barber+User |
| `WebApi/Controllers/ServiceController.cs` | Usa `IServiceService`, DTOs en vez de entidades |
| `WebApi/Controllers/AppointmentsController.cs` | Usa `IAppointmentService` para todo, paginación |
| `WebApi/Controllers/BrandingController.cs` | Sin cambios |
| `WebApi/Program.cs` | Rate limiting, registrar todos los servicios nuevos |
| `ApplicationDbContext.cs` | +`DbSet<Customer>`, QueryFilter para Customer |

---

## Migraciones requeridas

### Migración 1: `AgregarClientesYFidelizacion`
- Tabla `Customers` (Id, TenantId, Name, Phone, PasswordHash, LoyaltyCount, CreatedAt)
- Índice único en `(TenantId, Phone)`
- Columna `IsFree` en `Appointments`
- Columnas `LoyaltyEnabled`, `LoyaltyThreshold` en `Tenants`

### Migración 2: `AgregarRefreshTokenYBarberoVinculado`
- Columnas `MustChangePassword`, `RefreshToken`, `RefreshTokenExpiresAt` en tabla `Users`
- Columna `UserId` (nullable) en tabla `Barbers`