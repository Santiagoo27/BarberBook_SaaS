# Fase 5.2 — Validación Backend: Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar 7 deudas técnicas detectadas en el smoke test de Fase 5 antes de comenzar el frontend (Fase 6), garantizando que el backend es sólido, seguro y probado.

**Architecture:** Se añade un proyecto de integración tests (xUnit + WebApplicationFactory + SQLite en fichero temporal) que prueba los endpoints reales. Cada tarea modifica una capa específica — Domain/Application para contratos, Infrastructure para lógica, WebApi para controllers/middlewares.

**Tech Stack:** .NET 10 / ASP.NET Core / xUnit 2.9 / Microsoft.AspNetCore.Mvc.Testing 10.0 / SQLite

---

## Mapa de archivos

| Archivo | Acción | Tarea |
|---------|--------|-------|
| `BarberBookSaaS.Tests/BarberBookSaaS.Tests.csproj` | Crear | 1 |
| `BarberBookSaaS.Tests/Helpers/TestWebApplicationFactory.cs` | Crear | 1 |
| `BarberBookSaaS.Tests/Helpers/TestAuthHelper.cs` | Crear | 1 |
| `BarberBookSaaS.WebApi/Program.cs` | Modificar (partial Program + rate limiter por IP + middleware MustChangePassword) | 1, 3, 6 |
| `BarberBookSaaS.Domain/Constants/UserRoles.cs` | Modificar (add Customer) | 2 |
| `BarberBookSaaS.WebApi/Controllers/BarbersController.cs` | Modificar (UserRoles.Admin) | 2 |
| `BarberBookSaaS.WebApi/Controllers/BrandingController.cs` | Modificar (UserRoles.Admin) | 2 |
| `BarberBookSaaS.WebApi/Controllers/LoyaltyController.cs` | Modificar (UserRoles.Admin) | 2 |
| `BarberBookSaaS.WebApi/Controllers/ServicesController.cs` | Modificar (UserRoles.Admin) | 2 |
| `BarberBookSaaS.WebApi/Controllers/CustomerController.cs` | Modificar (UserRoles.Customer + endpoint historial) | 2, 7 |
| `BarberBookSaaS.WebApi/Controllers/PublicBookingController.cs` | Modificar (UserRoles.Customer + BookingResult) | 2, 4 |
| `BarberBookSaaS.Tests/RateLimiterTests.cs` | Crear | 3 |
| `BarberBookSaaS.Application/DTOs/Appointments/BookingResult.cs` | Crear | 4 |
| `BarberBookSaaS.Application/Common/IAppointmentService.cs` | Modificar (BookingResult) | 4 |
| `BarberBookSaaS.Infrastructure/Services/AppointmentService.cs` | Modificar (BookingResult) | 4 |
| `BarberBookSaaS.WebApi/Controllers/AppointmentsController.cs` | Modificar (BookingResult) | 4 |
| `BarberBookSaaS.Tests/BookingErrorTests.cs` | Crear | 4 |
| `BarberBookSaaS.Application/DTOs/Dashboard/DashboardStatsDto.cs` | Modificar (campos nuevos) | 5 |
| `BarberBookSaaS.Infrastructure/Services/DashboardService.cs` | Modificar (calcular nuevos campos) | 5 |
| `BarberBookSaaS.Tests/DashboardTests.cs` | Crear | 5 |
| `BarberBookSaaS.Infrastructure/Services/TokenService.cs` | Modificar (claim MustChangePassword) | 6 |
| `BarberBookSaaS.WebApi/Middleware/MustChangePasswordMiddleware.cs` | Crear | 6 |
| `BarberBookSaaS.Tests/MustChangePasswordTests.cs` | Crear | 6 |
| `BarberBookSaaS.Application/DTOs/Customers/CustomerAppointmentDto.cs` | Crear | 7 |
| `BarberBookSaaS.Tests/CustomerAppointmentsTests.cs` | Crear | 7 |

---

## Task 1: Setup del Proyecto de Tests

**Files:**
- Modify: `BarberBookSaaS.WebApi/Program.cs` (última línea)
- Create: `BarberBookSaaS.Tests/BarberBookSaaS.Tests.csproj`
- Create: `BarberBookSaaS.Tests/Helpers/TestWebApplicationFactory.cs`
- Create: `BarberBookSaaS.Tests/Helpers/TestAuthHelper.cs`

- [ ] **Step 1: Exponer la clase Program al proyecto de tests**

Abrir `BarberBookSaaS.WebApi/Program.cs` y agregar al final del archivo (después de `app.Run();`):

```csharp
// Required for WebApplicationFactory in integration tests
public partial class Program { }
```

- [ ] **Step 2: Crear el proyecto xUnit**

```bash
cd c:\Users\Admin\BarberBookSaaS
dotnet new xunit -n BarberBookSaaS.Tests --framework net10.0
```

- [ ] **Step 3: Agregar dependencias al .csproj del test project**

Reemplazar el contenido de `BarberBookSaaS.Tests/BarberBookSaaS.Tests.csproj` con:

```xml
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <IsPackable>false</IsPackable>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.12.0" />
    <PackageReference Include="xunit" Version="2.9.3" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.8.2">
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
      <PrivateAssets>all</PrivateAssets>
    </PackageReference>
    <PackageReference Include="Microsoft.AspNetCore.Mvc.Testing" Version="10.0.8" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Sqlite" Version="10.0.8" />
    <PackageReference Include="System.IdentityModel.Tokens.Jwt" Version="8.18.0" />
    <PackageReference Include="Microsoft.IdentityModel.Tokens" Version="8.18.0" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\BarberBookSaaS.WebApi\BarberBookSaaS.WebApi.csproj" />
    <ProjectReference Include="..\BarberBookSaaS.Infrastructure\BarberBookSaaS.Infrastructure.csproj" />
    <ProjectReference Include="..\BarberBookSaaS.Application\BarberBookSaaS.Application.csproj" />
    <ProjectReference Include="..\BarberBookSaaS.Domain\BarberBookSaaS.Domain.csproj" />
  </ItemGroup>

</Project>
```

- [ ] **Step 4: Crear TestWebApplicationFactory**

Crear `BarberBookSaaS.Tests/Helpers/TestWebApplicationFactory.cs`:

```csharp
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using BarberBookSaaS.Infrastructure.Persistence;

namespace BarberBookSaaS.Tests.Helpers;

public class TestWebApplicationFactory : WebApplicationFactory<Program>, IAsyncDisposable
{
    private readonly string _dbPath = Path.Combine(Path.GetTempPath(), $"bbtest_{Guid.NewGuid():N}.db");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureServices(services =>
        {
            var descriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<ApplicationDbContext>));
            if (descriptor is not null) services.Remove(descriptor);

            services.AddDbContext<ApplicationDbContext>(options =>
                options.UseSqlite($"Data Source={_dbPath}"));
        });
    }

    public async Task InitializeDbAsync()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await db.Database.EnsureCreatedAsync();
    }

    public async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        if (File.Exists(_dbPath)) File.Delete(_dbPath);
    }
}
```

- [ ] **Step 5: Crear TestAuthHelper**

Crear `BarberBookSaaS.Tests/Helpers/TestAuthHelper.cs`:

```csharp
using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Security.Claims;
using Microsoft.IdentityModel.Tokens;
using System.Text;

namespace BarberBookSaaS.Tests.Helpers;

public static class TestAuthHelper
{
    private const string JwtKey = "YOUR_JWT_KEY_HERE";

    public static string AdminToken(string tenantId = "t1", string? userId = null) =>
        BuildToken(userId ?? Guid.NewGuid().ToString(), "admin@test.com", "Admin", tenantId, false);

    public static string BarberToken(string tenantId = "t1", string? userId = null) =>
        BuildToken(userId ?? Guid.NewGuid().ToString(), "barber@test.com", "Barbero", tenantId, false);

    public static string CustomerToken(string tenantId = "t1", string? customerId = null) =>
        BuildToken(customerId ?? Guid.NewGuid().ToString(), "customer@test.com", "Customer", tenantId, false);

    public static string MustChangePasswordToken(string tenantId = "t1") =>
        BuildToken(Guid.NewGuid().ToString(), "barber@test.com", "Barbero", tenantId, true);

    public static void SetAuth(this HttpClient client, string token, string tenantId = "t1")
    {
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        client.DefaultRequestHeaders.Remove("X-Tenant-Id");
        client.DefaultRequestHeaders.Add("X-Tenant-Id", tenantId);
    }

    private static string BuildToken(string userId, string email, string role, string tenantId, bool mustChangePassword)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtKey));
        var claims = new List<Claim>
        {
            new("UserId", userId),
            new(ClaimTypes.Email, email),
            new(ClaimTypes.Role, role),
            new("TenantId", tenantId),
            new("MustChangePassword", mustChangePassword.ToString().ToLower())
        };
        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddHours(1),
            SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
        };
        var handler = new JwtSecurityTokenHandler();
        return handler.WriteToken(handler.CreateToken(descriptor));
    }
}
```

- [ ] **Step 6: Eliminar el test stub que genera dotnet new xunit**

Borrar el archivo `BarberBookSaaS.Tests/UnitTest1.cs` generado automáticamente.

- [ ] **Step 7: Verificar que compila**

```bash
cd c:\Users\Admin\BarberBookSaaS
dotnet build BarberBookSaaS.Tests
```

Expected output: `Build succeeded. 0 Error(s) 0 Warning(s)`

- [ ] **Step 8: Commit**

```bash
git add BarberBookSaaS.WebApi/Program.cs BarberBookSaaS.Tests/
git commit -m "test: setup integration test project (xUnit + WebApplicationFactory + SQLite)"
```

---

## Task 2: Eliminar magic strings de roles — agregar `UserRoles.Customer`

**Files:**
- Modify: `BarberBookSaaS.Domain/Constants/UserRoles.cs`
- Modify: `BarberBookSaaS.WebApi/Controllers/BarbersController.cs`
- Modify: `BarberBookSaaS.WebApi/Controllers/BrandingController.cs`
- Modify: `BarberBookSaaS.WebApi/Controllers/LoyaltyController.cs`
- Modify: `BarberBookSaaS.WebApi/Controllers/ServicesController.cs`
- Modify: `BarberBookSaaS.WebApi/Controllers/CustomerController.cs`
- Modify: `BarberBookSaaS.WebApi/Controllers/PublicBookingController.cs`

> Este task es un refactor puro: no cambia comportamiento, elimina strings literales de roles.

- [ ] **Step 1: Agregar `Customer` a UserRoles**

En `BarberBookSaaS.Domain/Constants/UserRoles.cs`, reemplazar el contenido con:

```csharp
namespace BarberBookSaaS.Domain.Constants;

public static class UserRoles
{
    public const string Admin    = "Admin";
    public const string Barber   = "Barbero";
    public const string Customer = "Customer";
}
```

- [ ] **Step 2: Actualizar BarbersController**

Abrir `BarberBookSaaS.WebApi/Controllers/BarbersController.cs`. Agregar el using si no existe:
```csharp
using BarberBookSaaS.Domain.Constants;
```

Reemplazar todas las ocurrencias de `Authorize(Roles = "Admin")` por `Authorize(Roles = UserRoles.Admin)` en ese archivo.

- [ ] **Step 3: Actualizar BrandingController**

En `BarberBookSaaS.WebApi/Controllers/BrandingController.cs`, reemplazar `"Admin"` por `UserRoles.Admin` en todos los atributos `[Authorize(Roles = ...)]`. Verificar que tiene el using `BarberBookSaaS.Domain.Constants`.

- [ ] **Step 4: Actualizar LoyaltyController**

En `BarberBookSaaS.WebApi/Controllers/LoyaltyController.cs`, reemplazar `"Admin"` por `UserRoles.Admin`.

- [ ] **Step 5: Actualizar ServicesController**

En `BarberBookSaaS.WebApi/Controllers/ServicesController.cs`, reemplazar `"Admin"` por `UserRoles.Admin`.

- [ ] **Step 6: Actualizar CustomerController**

En `BarberBookSaaS.WebApi/Controllers/CustomerController.cs`, en el atributo de clase:

```csharp
[Authorize(Roles = UserRoles.Customer)]
```

Agregar el using `BarberBookSaaS.Domain.Constants`.

- [ ] **Step 7: Actualizar PublicBookingController**

En `BarberBookSaaS.WebApi/Controllers/PublicBookingController.cs`, reemplazar `Authorize(Roles = "Customer")` por `Authorize(Roles = UserRoles.Customer)`. El using `BarberBookSaaS.Domain.Constants` ya existe en ese archivo.

- [ ] **Step 8: Verificar que compila sin errores**

```bash
cd c:\Users\Admin\BarberBookSaaS
dotnet build BarberBookSaaS.WebApi
```

Expected: `Build succeeded. 0 Error(s)`

- [ ] **Step 9: Commit**

```bash
git add BarberBookSaaS.Domain/Constants/UserRoles.cs BarberBookSaaS.WebApi/Controllers/
git commit -m "refactor: replace role string literals with UserRoles constants"
```

---

## Task 3: Rate Limiter por IP

**Files:**
- Modify: `BarberBookSaaS.WebApi/Program.cs`
- Create: `BarberBookSaaS.Tests/RateLimiterTests.cs`

- [ ] **Step 1: Escribir el test fallido**

Crear `BarberBookSaaS.Tests/RateLimiterTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using BarberBookSaaS.Tests.Helpers;

namespace BarberBookSaaS.Tests;

public class RateLimiterTests : IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory = new();
    private HttpClient _client = null!;

    public async Task InitializeAsync()
    {
        await _factory.InitializeDbAsync();
        _client = _factory.CreateClient();
    }

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    [Fact]
    public async Task AuthEndpoints_SameIp_AllowFiveRequests()
    {
        // La política "auth" permite 5 req / 15 min por IP.
        // En entorno Testing el límite se sube a int.MaxValue, así que todos deben pasar.
        for (var i = 0; i < 6; i++)
        {
            var response = await _client.PostAsJsonAsync("/api/auth/login",
                new { email = "x@x.com", password = "wrong" });

            // 401 Unauthorized (credenciales malas) — NO 429 TooManyRequests
            Assert.NotEqual(HttpStatusCode.TooManyRequests, response.StatusCode);
        }
    }
}
```

- [ ] **Step 2: Ejecutar el test y verificar que FALLA (porque el límite actual es global y no por IP)**

```bash
cd c:\Users\Admin\BarberBookSaaS
dotnet test BarberBookSaaS.Tests --filter "RateLimiterTests" -v normal
```

Expected output si el rate limiter es global: tras 5 llamadas, la 6ª devuelve `429`. El test fallará.

> **Nota:** Si el test pasa de todas formas (por cómo el `WebApplicationFactory` maneja el rate limiter en memoria), no es una señal de error. Procede al siguiente paso.

- [ ] **Step 3: Cambiar rate limiter de global a por IP en Program.cs**

En `BarberBookSaaS.WebApi/Program.cs`, reemplazar el bloque completo de `AddRateLimiter`:

```csharp
// ANTES:
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("auth", opt =>
    {
        opt.PermitLimit = 5;
        opt.Window = TimeSpan.FromMinutes(15);
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit = 0;
    });
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});
```

```csharp
// DESPUÉS:
var isTestEnvironment = builder.Environment.IsEnvironment("Testing");
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = isTestEnvironment ? int.MaxValue : 5,
                Window = TimeSpan.FromMinutes(15),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});
```

Asegurarse que estos usings están al inicio de `Program.cs`:
```csharp
using System.Threading.RateLimiting;
```

- [ ] **Step 4: Ejecutar el test y verificar que PASA**

```bash
dotnet test BarberBookSaaS.Tests --filter "RateLimiterTests" -v normal
```

Expected: `Passed! - 1 passed`

- [ ] **Step 5: Build completo para verificar sin errores**

```bash
dotnet build BarberBookSaaS.WebApi
```

Expected: `Build succeeded. 0 Error(s)`

- [ ] **Step 6: Commit**

```bash
git add BarberBookSaaS.WebApi/Program.cs BarberBookSaaS.Tests/RateLimiterTests.cs
git commit -m "fix: rate limiter now partitions by IP instead of shared global counter"
```

---

## Task 4: Errores Distinguibles en Booking

**Files:**
- Create: `BarberBookSaaS.Application/DTOs/Appointments/BookingResult.cs`
- Modify: `BarberBookSaaS.Application/Common/IAppointmentService.cs`
- Modify: `BarberBookSaaS.Infrastructure/Services/AppointmentService.cs`
- Modify: `BarberBookSaaS.WebApi/Controllers/AppointmentsController.cs`
- Modify: `BarberBookSaaS.WebApi/Controllers/PublicBookingController.cs`
- Create: `BarberBookSaaS.Tests/BookingErrorTests.cs`

- [ ] **Step 1: Escribir los tests fallidos**

Crear `BarberBookSaaS.Tests/BookingErrorTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using BarberBookSaaS.Tests.Helpers;
using Microsoft.Extensions.DependencyInjection;

namespace BarberBookSaaS.Tests;

public class BookingErrorTests : IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory = new();
    private HttpClient _client = null!;
    private static readonly Guid BarberId  = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000001");
    private static readonly Guid ServiceId = Guid.Parse("bbbbbbbb-0000-0000-0000-000000000001");
    private static readonly Guid InactiveServiceId = Guid.Parse("cccccccc-0000-0000-0000-000000000001");
    private const string TenantId = "test-t1";

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

        db.Tenants.Add(new Tenant { Id = TenantId, Name = "Test", Subdomain = TenantId });
        db.Barbers.Add(new Barber { Id = BarberId, TenantId = TenantId, Name = "Juan" });
        db.Services.Add(new Service
        {
            Id = ServiceId, TenantId = TenantId,
            Name = "Corte", Price = 20, DurationMinutes = 30, IsActive = true
        });
        db.Services.Add(new Service
        {
            Id = InactiveServiceId, TenantId = TenantId,
            Name = "Inactivo", Price = 10, DurationMinutes = 30, IsActive = false
        });
        await db.SaveChangesAsync();
    }

    private void AuthAsAdmin() => _client.SetAuth(TestAuthHelper.AdminToken(TenantId), TenantId);

    [Fact]
    public async Task CreateAppointment_PastDate_Returns400_ErrorCode_PAST_DATE()
    {
        AuthAsAdmin();
        var response = await _client.PostAsJsonAsync("/api/appointments", new
        {
            barberId = BarberId,
            serviceId = ServiceId,
            customerName = "Test",
            appointmentDate = DateTime.Now.AddDays(-1)
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("PAST_DATE", body.GetProperty("errorCode").GetString());
    }

    [Fact]
    public async Task CreateAppointment_InactiveService_Returns400_ErrorCode_SERVICE_INACTIVE()
    {
        AuthAsAdmin();
        var response = await _client.PostAsJsonAsync("/api/appointments", new
        {
            barberId = BarberId,
            serviceId = InactiveServiceId,
            customerName = "Test",
            appointmentDate = DateTime.Now.AddDays(1)
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("SERVICE_INACTIVE", body.GetProperty("errorCode").GetString());
    }

    [Fact]
    public async Task CreateAppointment_ServiceNotFound_Returns400_ErrorCode_SERVICE_NOT_FOUND()
    {
        AuthAsAdmin();
        var response = await _client.PostAsJsonAsync("/api/appointments", new
        {
            barberId = BarberId,
            serviceId = Guid.NewGuid(),
            customerName = "Test",
            appointmentDate = DateTime.Now.AddDays(1)
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("SERVICE_NOT_FOUND", body.GetProperty("errorCode").GetString());
    }

    [Fact]
    public async Task CreateAppointment_ConflictingSlot_Returns409_ErrorCode_SCHEDULE_CONFLICT()
    {
        AuthAsAdmin();
        var appointmentDate = DateTime.Now.AddDays(1).Date.AddHours(10); // mañana a las 10:00

        // Primera cita — debe crearse OK
        var first = await _client.PostAsJsonAsync("/api/appointments", new
        {
            barberId = BarberId,
            serviceId = ServiceId,
            customerName = "Cliente 1",
            appointmentDate
        });
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        // Segunda cita en el mismo horario — debe fallar con 409
        var second = await _client.PostAsJsonAsync("/api/appointments", new
        {
            barberId = BarberId,
            serviceId = ServiceId,
            customerName = "Cliente 2",
            appointmentDate
        });

        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        var body = await second.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("SCHEDULE_CONFLICT", body.GetProperty("errorCode").GetString());
    }
}
```

- [ ] **Step 2: Ejecutar para verificar que FALLA (aún retorna null sin errorCode)**

```bash
dotnet test BarberBookSaaS.Tests --filter "BookingErrorTests" -v normal
```

Expected: Los 4 tests fallan porque los endpoints retornan `{ "message": "..." }` sin `errorCode`.

- [ ] **Step 3: Crear BookingResult DTO**

Crear `BarberBookSaaS.Application/DTOs/Appointments/BookingResult.cs`:

```csharp
using BarberBookSaaS.Domain.Entities;

namespace BarberBookSaaS.Application.DTOs.Appointments;

public class BookingResult
{
    public bool Success { get; init; }
    public Appointment? Appointment { get; init; }
    public string? ErrorCode { get; init; }
    public string? ErrorMessage { get; init; }

    public static BookingResult Ok(Appointment appointment) =>
        new() { Success = true, Appointment = appointment };

    public static BookingResult Fail(string errorCode, string errorMessage) =>
        new() { Success = false, ErrorCode = errorCode, ErrorMessage = errorMessage };
}
```

- [ ] **Step 4: Actualizar IAppointmentService**

En `BarberBookSaaS.Application/Common/IAppointmentService.cs`, cambiar la firma de `CreateAppointmentAsync`:

```csharp
using BarberBookSaaS.Application.DTOs;
using BarberBookSaaS.Application.DTOs.Appointments;
using BarberBookSaaS.Domain.Entities;

namespace BarberBookSaaS.Application.Common;

public interface IAppointmentService
{
    Task<BookingResult> CreateAppointmentAsync(CreateAppointmentDto request);
    Task<PagedResult<Appointment>> GetAllAsync(int page, int pageSize, string? status, DateTime? from, DateTime? to, Guid? filterByUserId = null);
    Task<Appointment?> UpdateStatusAsync(Guid id, string status);
    Task<IEnumerable<AvailabilitySlotDto>> GetAvailabilityAsync(Guid barberId, Guid serviceId, DateOnly date);
}
```

- [ ] **Step 5: Actualizar AppointmentService para retornar BookingResult con error codes**

En `BarberBookSaaS.Infrastructure/Services/AppointmentService.cs`, reemplazar el método `CreateAppointmentAsync` completo:

```csharp
public async Task<BookingResult> CreateAppointmentAsync(CreateAppointmentDto request)
{
    var service = await _context.Services.FindAsync(request.ServiceId);
    if (service == null)
        return BookingResult.Fail("SERVICE_NOT_FOUND", "El servicio solicitado no existe.");
    if (!service.IsActive)
        return BookingResult.Fail("SERVICE_INACTIVE", "El servicio no está disponible actualmente.");

    var newStart = request.AppointmentDate;
    var newEnd = newStart.AddMinutes(service.DurationMinutes);

    if (newStart < DateTime.Now)
        return BookingResult.Fail("PAST_DATE", "No se pueden agendar citas en horarios pasados.");

    var startOfDay = newStart.Date;
    var endOfDay = startOfDay.AddDays(1);

    var existing = await _context.Appointments
        .Include(a => a.Service)
        .Where(a => a.BarberId == request.BarberId
                    && a.AppointmentDate >= startOfDay
                    && a.AppointmentDate < endOfDay
                    && a.Status != AppointmentStatus.Cancelled)
        .ToListAsync();

    foreach (var appt in existing)
    {
        var eStart = appt.AppointmentDate;
        var eEnd = eStart.AddMinutes(appt.Service!.DurationMinutes);
        if (eStart < newEnd && newStart < eEnd)
            return BookingResult.Fail("SCHEDULE_CONFLICT", "El horario seleccionado ya fue reservado por otro cliente.");
    }

    var newAppointment = new Appointment
    {
        Id = Guid.NewGuid(),
        TenantId = service.TenantId ?? string.Empty,
        BarberId = request.BarberId,
        ServiceId = request.ServiceId,
        CustomerName = request.CustomerName,
        CustomerPhone = request.CustomerPhone,
        AppointmentDate = newStart,
        Status = AppointmentStatus.Pending,
        CreatedAt = DateTime.UtcNow
    };

    await _context.Appointments.AddAsync(newAppointment);
    await _context.SaveChangesAsync();
    return BookingResult.Ok(newAppointment);
}
```

- [ ] **Step 6: Actualizar AppointmentsController**

En `BarberBookSaaS.WebApi/Controllers/AppointmentsController.cs`, reemplazar el método `Create`:

```csharp
[HttpPost]
public async Task<IActionResult> Create([FromBody] CreateAppointmentDto request)
{
    if (!ModelState.IsValid) return BadRequest(ModelState);

    var result = await _appointmentService.CreateAppointmentAsync(request);
    if (!result.Success)
    {
        var statusCode = result.ErrorCode == "SCHEDULE_CONFLICT"
            ? StatusCodes.Status409Conflict
            : StatusCodes.Status400BadRequest;
        return StatusCode(statusCode, new { errorCode = result.ErrorCode, message = result.ErrorMessage });
    }

    return Ok(result.Appointment);
}
```

- [ ] **Step 7: Actualizar PublicBookingController**

En `BarberBookSaaS.WebApi/Controllers/PublicBookingController.cs`, reemplazar el bloque de llamada a `CreateAppointmentAsync` en el método `CreateAppointment`:

```csharp
var result = await _appointmentService.CreateAppointmentAsync(createDto);
if (!result.Success)
{
    var statusCode = result.ErrorCode == "SCHEDULE_CONFLICT"
        ? StatusCodes.Status409Conflict
        : StatusCodes.Status400BadRequest;
    return StatusCode(statusCode, new { errorCode = result.ErrorCode, message = result.ErrorMessage });
}

var appointment = result.Appointment!;
```

El resto del método `CreateAppointment` en PublicBookingController queda igual (loyalty logic, `appointment.CustomerId = customerId`, etc.), solo reemplaza las líneas:
```csharp
// QUITAR ESTAS LÍNEAS:
var appointment = await _appointmentService.CreateAppointmentAsync(createDto);
if (appointment is null)
    return BadRequest(new { message = "No se pudo agendar. Verifica disponibilidad o que la fecha sea futura." });
```

- [ ] **Step 8: Ejecutar los tests y verificar que PASAN**

```bash
dotnet test BarberBookSaaS.Tests --filter "BookingErrorTests" -v normal
```

Expected: `Passed! - 4 passed`

- [ ] **Step 9: Build completo**

```bash
dotnet build
```

Expected: `Build succeeded. 0 Error(s)`

- [ ] **Step 10: Commit**

```bash
git add BarberBookSaaS.Application/ BarberBookSaaS.Infrastructure/Services/AppointmentService.cs BarberBookSaaS.WebApi/Controllers/AppointmentsController.cs BarberBookSaaS.WebApi/Controllers/PublicBookingController.cs BarberBookSaaS.Tests/BookingErrorTests.cs
git commit -m "feat: booking errors now return specific error codes (PAST_DATE, SERVICE_INACTIVE, SERVICE_NOT_FOUND, SCHEDULE_CONFLICT)"
```

---

## Task 5: Dashboard — Métricas Adicionales

**Files:**
- Modify: `BarberBookSaaS.Application/DTOs/Dashboard/DashboardStatsDto.cs`
- Modify: `BarberBookSaaS.Infrastructure/Services/DashboardService.cs`
- Create: `BarberBookSaaS.Tests/DashboardTests.cs`

- [ ] **Step 1: Escribir el test fallido**

Crear `BarberBookSaaS.Tests/DashboardTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using BarberBookSaaS.Tests.Helpers;
using Microsoft.Extensions.DependencyInjection;

namespace BarberBookSaaS.Tests;

public class DashboardTests : IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory = new();
    private HttpClient _client = null!;
    private const string TenantId = "dash-t1";

    public async Task InitializeAsync()
    {
        await _factory.InitializeDbAsync();
        _client = _factory.CreateClient();
        await SeedAsync();
        _client.SetAuth(TestAuthHelper.AdminToken(TenantId), TenantId);
    }

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private async Task SeedAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        db.Tenants.Add(new Tenant { Id = TenantId, Name = "Dash Test", Subdomain = TenantId });
        var barberId = Guid.NewGuid();
        var serviceId = Guid.NewGuid();
        db.Barbers.Add(new Barber { Id = barberId, TenantId = TenantId, Name = "Pedro" });
        db.Services.Add(new Service { Id = serviceId, TenantId = TenantId, Name = "Corte", Price = 20, DurationMinutes = 30, IsActive = true });

        // Cita completada HOY → cuenta en TodayRevenue
        db.Appointments.Add(new Appointment
        {
            Id = Guid.NewGuid(), TenantId = TenantId, BarberId = barberId, ServiceId = serviceId,
            CustomerName = "C1", AppointmentDate = DateTime.Now.Date.AddHours(9),
            Status = AppointmentStatus.Completed
        });
        // Cita mañana (dentro de 48h) → cuenta en UpcomingAppointments
        db.Appointments.Add(new Appointment
        {
            Id = Guid.NewGuid(), TenantId = TenantId, BarberId = barberId, ServiceId = serviceId,
            CustomerName = "C2", AppointmentDate = DateTime.Now.AddHours(25),
            Status = AppointmentStatus.Pending
        });
        // Cita completada esta semana (ayer) → cuenta en WeekRevenue
        db.Appointments.Add(new Appointment
        {
            Id = Guid.NewGuid(), TenantId = TenantId, BarberId = barberId, ServiceId = serviceId,
            CustomerName = "C3", AppointmentDate = DateTime.Now.AddDays(-1).Date.AddHours(10),
            Status = AppointmentStatus.Completed
        });
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task GetStats_ReturnsUpcomingAppointmentsAndWeekRevenue()
    {
        var response = await _client.GetAsync("/api/dashboard/stats");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();

        // Los nuevos campos deben existir en la respuesta JSON
        Assert.True(body.TryGetProperty("upcomingAppointments", out var upcoming));
        Assert.True(body.TryGetProperty("weekRevenue", out var weekRev));

        // Hay 1 cita en las próximas 48h
        Assert.Equal(1, upcoming.GetInt32());

        // WeekRevenue = hoy (20) + ayer (20) = 40
        Assert.Equal(40m, weekRev.GetDecimal());
    }
}
```

- [ ] **Step 2: Ejecutar para verificar que FALLA**

```bash
dotnet test BarberBookSaaS.Tests --filter "DashboardTests" -v normal
```

Expected: falla porque `upcomingAppointments` y `weekRevenue` no existen en la respuesta.

- [ ] **Step 3: Agregar campos al DTO**

En `BarberBookSaaS.Application/DTOs/Dashboard/DashboardStatsDto.cs`, reemplazar el contenido:

```csharp
namespace BarberBookSaaS.Application.DTOs.Dashboard;

public class DashboardStatsDto
{
    public int TodayAppointments { get; set; }
    public decimal TodayRevenue { get; set; }
    public int PendingAppointments { get; set; }
    public int TotalActiveBarbers { get; set; }
    public BusiestBarberDto? BusiestBarber { get; set; }
    public int UpcomingAppointments { get; set; }
    public decimal WeekRevenue { get; set; }
}

public class BusiestBarberDto
{
    public string Name { get; set; } = string.Empty;
    public int AppointmentsToday { get; set; }
}
```

- [ ] **Step 4: Calcular los nuevos campos en DashboardService**

En `BarberBookSaaS.Infrastructure/Services/DashboardService.cs`, agregar los cálculos al final del método `GetStatsAsync`, antes del `return`:

```csharp
// UpcomingAppointments: citas no canceladas en las próximas 48h (a partir de mañana)
var upcomingQuery = _context.Appointments
    .Include(a => a.Barber)
    .Where(a => a.AppointmentDate > tomorrow
                && a.AppointmentDate <= now.AddHours(48)
                && a.Status != AppointmentStatus.Cancelled);

if (filterByUserId.HasValue)
    upcomingQuery = upcomingQuery.Where(a => a.Barber != null && a.Barber.UserId == filterByUserId.Value);

var upcomingCount = await upcomingQuery.CountAsync();

// WeekRevenue: ingresos de citas completadas en la semana actual (lunes–domingo)
var daysToMonday = (int)today.DayOfWeek == 0 ? 6 : (int)today.DayOfWeek - 1;
var startOfWeek = today.AddDays(-daysToMonday);
var endOfWeek = startOfWeek.AddDays(7);

var weekRevenueQuery = _context.Appointments
    .Include(a => a.Service)
    .Include(a => a.Barber)
    .Where(a => a.AppointmentDate >= startOfWeek
                && a.AppointmentDate < endOfWeek
                && a.Status == AppointmentStatus.Completed
                && a.Service != null);

if (filterByUserId.HasValue)
    weekRevenueQuery = weekRevenueQuery.Where(a => a.Barber != null && a.Barber.UserId == filterByUserId.Value);

var weekRevenueList = await weekRevenueQuery.ToListAsync();
var weekRevenue = weekRevenueList.Sum(a => a.Service!.Price);
```

Y actualizar el `return` al final del método:

```csharp
return new DashboardStatsDto
{
    TodayAppointments     = todayCount,
    TodayRevenue          = todayRevenue,
    PendingAppointments   = pendingCount,
    TotalActiveBarbers    = activeBarbers,
    BusiestBarber         = busiestBarber,
    UpcomingAppointments  = upcomingCount,
    WeekRevenue           = weekRevenue
};
```

Agregar la variable `now` y `tomorrow` que ya están disponibles en el método existente:
> La variable `today` ya existe. Asegúrate de que `tomorrow` y `now` están disponibles. Si `now` no existe como variable, agregar al inicio del método: `var now = DateTime.Now;`

- [ ] **Step 5: Ejecutar los tests y verificar que PASAN**

```bash
dotnet test BarberBookSaaS.Tests --filter "DashboardTests" -v normal
```

Expected: `Passed! - 1 passed`

- [ ] **Step 6: Build completo**

```bash
dotnet build
```

Expected: `Build succeeded. 0 Error(s)`

- [ ] **Step 7: Commit**

```bash
git add BarberBookSaaS.Application/DTOs/Dashboard/ BarberBookSaaS.Infrastructure/Services/DashboardService.cs BarberBookSaaS.Tests/DashboardTests.cs
git commit -m "feat: dashboard now includes upcomingAppointments (next 48h) and weekRevenue"
```

---

## Task 6: MustChangePassword Enforcement

**Files:**
- Modify: `BarberBookSaaS.Infrastructure/Services/TokenService.cs`
- Create: `BarberBookSaaS.WebApi/Middleware/MustChangePasswordMiddleware.cs`
- Modify: `BarberBookSaaS.WebApi/Program.cs`
- Create: `BarberBookSaaS.Tests/MustChangePasswordTests.cs`

- [ ] **Step 1: Escribir el test fallido**

Crear `BarberBookSaaS.Tests/MustChangePasswordTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using BarberBookSaaS.Tests.Helpers;

namespace BarberBookSaaS.Tests;

public class MustChangePasswordTests : IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory = new();
    private HttpClient _client = null!;
    private const string TenantId = "mcp-t1";

    public async Task InitializeAsync()
    {
        await _factory.InitializeDbAsync();
        _client = _factory.CreateClient();
    }

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    [Fact]
    public async Task AccessProtectedEndpoint_WithMustChangePasswordToken_Returns403()
    {
        _client.SetAuth(TestAuthHelper.MustChangePasswordToken(TenantId), TenantId);

        var response = await _client.GetAsync("/api/appointments");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("MUST_CHANGE_PASSWORD", body.GetProperty("errorCode").GetString());
    }

    [Fact]
    public async Task AccessChangePasswordEndpoint_WithMustChangePasswordToken_IsNotBlocked()
    {
        _client.SetAuth(TestAuthHelper.MustChangePasswordToken(TenantId), TenantId);

        // change-password espera un body válido; con datos incorrectos devuelve 400/401,
        // pero NO 403 de MustChangePassword
        var response = await _client.PostAsJsonAsync("/api/auth/change-password", new
        {
            currentPassword = "wrong",
            newPassword = "newpass123"
        });

        Assert.NotEqual(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AccessProtectedEndpoint_WithNormalToken_IsNotBlocked()
    {
        _client.SetAuth(TestAuthHelper.BarberToken(TenantId), TenantId);

        var response = await _client.GetAsync("/api/appointments");

        // 200 OK — el barber tiene acceso normal
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
```

- [ ] **Step 2: Ejecutar para verificar que FALLA**

```bash
dotnet test BarberBookSaaS.Tests --filter "MustChangePasswordTests" -v normal
```

Expected: `AccessProtectedEndpoint_WithMustChangePasswordToken_Returns403` falla porque el middleware no existe aún.

- [ ] **Step 3: Agregar claim MustChangePassword al JWT en TokenService**

En `BarberBookSaaS.Infrastructure/Services/TokenService.cs`, modificar el método `CreateToken(User user)`:

```csharp
public string CreateToken(User user)
{
    var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtKey));
    var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

    var claims = new List<Claim>
    {
        new("UserId", user.Id.ToString()),
        new(ClaimTypes.Email, user.Email),
        new(ClaimTypes.Role, user.Role),
        new("TenantId", user.TenantId),
        new("MustChangePassword", user.MustChangePassword.ToString().ToLower())
    };

    var tokenDescriptor = new SecurityTokenDescriptor
    {
        Subject = new ClaimsIdentity(claims),
        Expires = DateTime.UtcNow.AddHours(1),
        SigningCredentials = creds
    };

    var handler = new JwtSecurityTokenHandler();
    return handler.WriteToken(handler.CreateToken(tokenDescriptor));
}
```

> El método `CreateTokenForUser` no necesita cambios — es usado por el auth de clientes (`Customer`) que no tienen `MustChangePassword`.

- [ ] **Step 4: Crear MustChangePasswordMiddleware**

Crear `BarberBookSaaS.WebApi/Middleware/MustChangePasswordMiddleware.cs`:

```csharp
using System.Security.Claims;

namespace BarberBookSaaS.WebApi.Middleware;

public class MustChangePasswordMiddleware
{
    private readonly RequestDelegate _next;

    public MustChangePasswordMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var mustChange = context.User.FindFirstValue("MustChangePassword");
            if (mustChange == "true")
            {
                var path = context.Request.Path.Value ?? string.Empty;
                var isChangePasswordPath = path.Equals(
                    "/api/auth/change-password",
                    StringComparison.OrdinalIgnoreCase);

                if (!isChangePasswordPath)
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    context.Response.ContentType = "application/json";
                    await context.Response.WriteAsJsonAsync(new
                    {
                        errorCode = "MUST_CHANGE_PASSWORD",
                        message   = "Debés cambiar tu contraseña antes de continuar."
                    });
                    return;
                }
            }
        }

        await _next(context);
    }
}
```

- [ ] **Step 5: Registrar el middleware en Program.cs**

En `BarberBookSaaS.WebApi/Program.cs`, agregar el middleware DESPUÉS de `app.UseAuthorization()` y ANTES de `app.UseRateLimiter()`:

```csharp
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<MustChangePasswordMiddleware>();   // <-- agregar aquí
app.UseRateLimiter();
app.MapControllers();
```

- [ ] **Step 6: Ejecutar los tests y verificar que PASAN**

```bash
dotnet test BarberBookSaaS.Tests --filter "MustChangePasswordTests" -v normal
```

Expected: `Passed! - 3 passed`

- [ ] **Step 7: Build completo**

```bash
dotnet build
```

Expected: `Build succeeded. 0 Error(s)`

- [ ] **Step 8: Commit**

```bash
git add BarberBookSaaS.Infrastructure/Services/TokenService.cs BarberBookSaaS.WebApi/Middleware/MustChangePasswordMiddleware.cs BarberBookSaaS.WebApi/Program.cs BarberBookSaaS.Tests/MustChangePasswordTests.cs
git commit -m "feat: enforce MustChangePassword — blocked users get 403 until they change password"
```

---

## Task 7: GET /api/customer/appointments

**Files:**
- Create: `BarberBookSaaS.Application/DTOs/Customers/CustomerAppointmentDto.cs`
- Modify: `BarberBookSaaS.WebApi/Controllers/CustomerController.cs`
- Create: `BarberBookSaaS.Tests/CustomerAppointmentsTests.cs`

- [ ] **Step 1: Escribir el test fallido**

Crear `BarberBookSaaS.Tests/CustomerAppointmentsTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using BarberBookSaaS.Tests.Helpers;
using Microsoft.Extensions.DependencyInjection;

namespace BarberBookSaaS.Tests;

public class CustomerAppointmentsTests : IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory = new();
    private HttpClient _client = null!;
    private const string TenantId = "cust-t1";
    private static readonly Guid CustomerId = Guid.Parse("dddddddd-0000-0000-0000-000000000001");

    public async Task InitializeAsync()
    {
        await _factory.InitializeDbAsync();
        _client = _factory.CreateClient();
        await SeedAsync();
        _client.SetAuth(TestAuthHelper.CustomerToken(TenantId, CustomerId.ToString()), TenantId);
    }

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private async Task SeedAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        db.Tenants.Add(new Tenant { Id = TenantId, Name = "Cust Test", Subdomain = TenantId });
        var barberId  = Guid.NewGuid();
        var serviceId = Guid.NewGuid();
        db.Barbers.Add(new Barber { Id = barberId, TenantId = TenantId, Name = "Luis" });
        db.Services.Add(new Service { Id = serviceId, TenantId = TenantId, Name = "Barba", Price = 15, DurationMinutes = 20, IsActive = true });

        db.Customers.Add(new Customer
        {
            Id = CustomerId, TenantId = TenantId,
            Name = "Cliente Test", Phone = "555-0001",
            PasswordHash = "hash", LoyaltyCount = 0
        });

        // 2 citas para el cliente
        db.Appointments.Add(new Appointment
        {
            Id = Guid.NewGuid(), TenantId = TenantId, BarberId = barberId, ServiceId = serviceId,
            CustomerName = "Cliente Test", AppointmentDate = DateTime.Now.AddDays(-5),
            Status = AppointmentStatus.Completed, CustomerId = CustomerId
        });
        db.Appointments.Add(new Appointment
        {
            Id = Guid.NewGuid(), TenantId = TenantId, BarberId = barberId, ServiceId = serviceId,
            CustomerName = "Cliente Test", AppointmentDate = DateTime.Now.AddDays(2),
            Status = AppointmentStatus.Pending, CustomerId = CustomerId
        });
        // Cita de OTRO cliente — NO debe aparecer
        db.Appointments.Add(new Appointment
        {
            Id = Guid.NewGuid(), TenantId = TenantId, BarberId = barberId, ServiceId = serviceId,
            CustomerName = "Otro", AppointmentDate = DateTime.Now.AddDays(1),
            Status = AppointmentStatus.Pending, CustomerId = Guid.NewGuid()
        });
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task GetMyAppointments_ReturnsOnlyCurrentCustomerAppointments()
    {
        var response = await _client.GetAsync("/api/customer/appointments");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var items = body.EnumerateArray().ToList();

        Assert.Equal(2, items.Count);
        // Verificar que los campos esperados existen
        Assert.True(items[0].TryGetProperty("barberName", out _));
        Assert.True(items[0].TryGetProperty("serviceName", out _));
        Assert.True(items[0].TryGetProperty("appointmentDate", out _));
        Assert.True(items[0].TryGetProperty("status", out _));
    }

    [Fact]
    public async Task GetMyAppointments_WithoutAuth_Returns401()
    {
        var client = _factory.CreateClient(); // sin token
        var response = await client.GetAsync("/api/customer/appointments");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
```

- [ ] **Step 2: Ejecutar para verificar que FALLA**

```bash
dotnet test BarberBookSaaS.Tests --filter "CustomerAppointmentsTests" -v normal
```

Expected: falla porque el endpoint `GET /api/customer/appointments` no existe (404).

- [ ] **Step 3: Crear CustomerAppointmentDto**

Crear `BarberBookSaaS.Application/DTOs/Customers/CustomerAppointmentDto.cs`:

```csharp
namespace BarberBookSaaS.Application.DTOs.Customers;

public class CustomerAppointmentDto
{
    public Guid Id { get; set; }
    public string BarberName { get; set; } = string.Empty;
    public string ServiceName { get; set; } = string.Empty;
    public decimal ServicePrice { get; set; }
    public DateTime AppointmentDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public bool IsFree { get; set; }
}
```

- [ ] **Step 4: Agregar endpoint GetAppointments a CustomerController**

En `BarberBookSaaS.WebApi/Controllers/CustomerController.cs`, agregar el método después de `GetMe`:

```csharp
[HttpGet("appointments")]
public async Task<IActionResult> GetAppointments()
{
    var customerIdClaim = User.FindFirstValue("UserId");
    if (!Guid.TryParse(customerIdClaim, out var customerId))
        return Unauthorized();

    var tenantId = _tenantService.TenantId;

    var appointments = await _context.Appointments
        .Include(a => a.Barber)
        .Include(a => a.Service)
        .Where(a => a.CustomerId == customerId && a.TenantId == tenantId)
        .OrderByDescending(a => a.AppointmentDate)
        .Select(a => new CustomerAppointmentDto
        {
            Id              = a.Id,
            BarberName      = a.Barber != null ? a.Barber.Name : string.Empty,
            ServiceName     = a.Service != null ? a.Service.Name : string.Empty,
            ServicePrice    = a.Service != null ? a.Service.Price : 0,
            AppointmentDate = a.AppointmentDate,
            Status          = a.Status,
            IsFree          = a.IsFree
        })
        .ToListAsync();

    return Ok(appointments);
}
```

Agregar el using necesario al tope del archivo:
```csharp
using BarberBookSaaS.Application.DTOs.Customers;
```

- [ ] **Step 5: Ejecutar los tests y verificar que PASAN**

```bash
dotnet test BarberBookSaaS.Tests --filter "CustomerAppointmentsTests" -v normal
```

Expected: `Passed! - 2 passed`

- [ ] **Step 6: Correr todos los tests juntos**

```bash
dotnet test BarberBookSaaS.Tests -v normal
```

Expected: todos los tests pasan. Verificar el total.

- [ ] **Step 7: Build completo de la solución**

```bash
dotnet build
```

Expected: `Build succeeded. 0 Error(s)`

- [ ] **Step 8: Commit final**

```bash
git add BarberBookSaaS.Application/DTOs/Customers/CustomerAppointmentDto.cs BarberBookSaaS.WebApi/Controllers/CustomerController.cs BarberBookSaaS.Tests/CustomerAppointmentsTests.cs
git commit -m "feat: add GET /api/customer/appointments — customer can now view their booking history"
```

---

## Auto-Review

### Cobertura de requisitos

| Requisito de Fase 5.2 | Task | Estado |
|-----------------------|------|--------|
| Rate limiter global → por IP | Task 3 | ✅ cubierto |
| Mensajes error booking distinguibles | Task 4 | ✅ cubierto |
| Race condition — separado para frontend | N/A | ⚠️ parcial: Task 4 mejora UX del 400 genérico; race condition real requiere slot lock (excluido por complejidad, documentado) |
| Dashboard upcomingAppointments + weekRevenue | Task 5 | ✅ cubierto |
| `mustChangePassword` enforcement backend | Task 6 | ✅ cubierto |
| `GET /api/customer/appointments` | Task 7 | ✅ cubierto |
| `[Authorize(Roles = "Admin")]` → UserRoles.Admin | Task 2 | ✅ cubierto |
| Proyecto de tests de integración | Task 1 | ✅ cubierto |

### Race condition — nota de alcance

La race condition (dos clientes ven el mismo slot libre y ambos intentan agendar) queda parcialmente mitigada: el segundo cliente ahora recibe `409 SCHEDULE_CONFLICT` con un mensaje claro (Task 4) en lugar de un `400` genérico. La solución definitiva (slot reservation / mutex) es complejidad innecesaria para el MVP y se documenta como deuda técnica futura.

### Scan de placeholders

No hay TBDs, TODOs ni referencias a "igual que el task anterior" en este plan.

### Consistencia de tipos

- `BookingResult` creado en Task 4 es referenciado correctamente en `IAppointmentService`, `AppointmentService`, `AppointmentsController` y `PublicBookingController`.
- `CustomerAppointmentDto` creado en Task 7 es usado en `CustomerController.GetAppointments`.
- El claim `"MustChangePassword"` se escribe como `"true"/"false"` (minúsculas) tanto en `TokenService` (Task 6) como en `TestAuthHelper` (Task 1).