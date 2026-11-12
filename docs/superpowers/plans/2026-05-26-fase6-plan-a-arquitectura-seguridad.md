# Fase 6 — Plan A: Arquitectura Limpia + Seguridad

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactorizar el backend existente para tener service layer consistente, DTOs seguros, estados tipados, flujo unificado de creación de barberos y seguridad de auth robusta (refresh tokens + rate limiting).

**Architecture:** Los controllers dejan de acceder a `_context` directamente — toda la lógica pasa por interfaces de servicio. Los DTOs reemplazan las entidades de dominio en los request bodies. La autenticación se refuerza con JWT de 1h + refresh token de 30 días y rate limiting nativo de ASP.NET Core.

**Tech Stack:** .NET 10 / ASP.NET Core / EF Core / SQLite / BCrypt.Net-Next / Microsoft.AspNetCore.RateLimiting (incluido en .NET 7+, sin NuGet extra)

**Spec:** `docs/superpowers/specs/2026-05-26-backend-robustness-design.md` (Secciones 1, 6, 7)

**Prerequisite:** Build limpio. Verificar antes de empezar:
```bash
cd c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi
dotnet build
# Esperado: 0 errores, 0 advertencias
```

---

### Task 1: AppointmentStatus constants + DTOs de paginación y disponibilidad

**Files:**
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Domain\Constants\AppointmentStatus.cs`
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Application\DTOs\PagedResult.cs`
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Application\DTOs\Appointments\AvailabilitySlotDto.cs`

- [ ] **Step 1: Crear `AppointmentStatus.cs`**

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

- [ ] **Step 2: Crear `PagedResult.cs`**

```csharp
namespace BarberBookSaaS.Application.DTOs;

public class PagedResult<T>
{
    public IEnumerable<T> Data { get; set; } = [];
    public int Total { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => PageSize > 0 ? (int)Math.Ceiling((double)Total / PageSize) : 0;
}
```

- [ ] **Step 3: Crear `AvailabilitySlotDto.cs`**

```csharp
namespace BarberBookSaaS.Application.DTOs.Appointments;

public class AvailabilitySlotDto
{
    public string Time { get; set; } = string.Empty;
    public bool Available { get; set; }
}
```

- [ ] **Step 4: Verificar compilación**

```bash
cd c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi
dotnet build
```
Esperado: `0 Errores`

- [ ] **Step 5: Commit**

```bash
git add BarberBookSaaS.Domain/Constants/AppointmentStatus.cs BarberBookSaaS.Application/DTOs/PagedResult.cs BarberBookSaaS.Application/DTOs/Appointments/AvailabilitySlotDto.cs
git commit -m "feat: add AppointmentStatus constants and paged/availability DTOs"
```

---

### Task 2: DTOs para Barberos, Servicios y Auth

**Files:**
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Application\DTOs\Barbers\CreateBarberDto.cs`
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Application\DTOs\Barbers\UpdateBarberDto.cs`
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Application\DTOs\Barbers\CreateBarberResponseDto.cs`
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Application\DTOs\Services\CreateServiceDto.cs`
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Application\DTOs\Services\UpdateServiceDto.cs`
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Application\DTOs\Auth\ChangePasswordDto.cs`
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Application\DTOs\Auth\RefreshTokenRequestDto.cs`
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Application\DTOs\Auth\RefreshTokenResponseDto.cs`
- Modify: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Application\DTOs\Auth\AuthResponseDto.cs`

- [ ] **Step 1: Crear DTOs de barberos**

`CreateBarberDto.cs`:
```csharp
using System.ComponentModel.DataAnnotations;

namespace BarberBookSaaS.Application.DTOs.Barbers;

public class CreateBarberDto
{
    [Required] public string Name { get; set; } = string.Empty;
    [Required][EmailAddress] public string Email { get; set; } = string.Empty;
    [Required] public string Phone { get; set; } = string.Empty;
    public string Specialty { get; set; } = string.Empty;
}
```

`UpdateBarberDto.cs`:
```csharp
using System.ComponentModel.DataAnnotations;

namespace BarberBookSaaS.Application.DTOs.Barbers;

public class UpdateBarberDto
{
    [Required] public string Name { get; set; } = string.Empty;
    [Required][EmailAddress] public string Email { get; set; } = string.Empty;
    [Required] public string Phone { get; set; } = string.Empty;
    public string Specialty { get; set; } = string.Empty;
}
```

`CreateBarberResponseDto.cs`:
```csharp
using BarberBookSaaS.Domain.Entities;

namespace BarberBookSaaS.Application.DTOs.Barbers;

public class CreateBarberResponseDto
{
    public Barber Barber { get; set; } = null!;
    public string TemporaryPassword { get; set; } = string.Empty;
}
```

- [ ] **Step 2: Crear DTOs de servicios**

`CreateServiceDto.cs`:
```csharp
using System.ComponentModel.DataAnnotations;

namespace BarberBookSaaS.Application.DTOs.Services;

public class CreateServiceDto
{
    [Required] public string Name { get; set; } = string.Empty;
    [Range(0.01, double.MaxValue)] public decimal Price { get; set; }
    [Range(1, 480)] public int DurationMinutes { get; set; }
}
```

`UpdateServiceDto.cs`:
```csharp
using System.ComponentModel.DataAnnotations;

namespace BarberBookSaaS.Application.DTOs.Services;

public class UpdateServiceDto
{
    [Required] public string Name { get; set; } = string.Empty;
    [Range(0.01, double.MaxValue)] public decimal Price { get; set; }
    [Range(1, 480)] public int DurationMinutes { get; set; }
}
```

- [ ] **Step 3: Crear DTOs de auth**

`ChangePasswordDto.cs`:
```csharp
using System.ComponentModel.DataAnnotations;

namespace BarberBookSaaS.Application.DTOs.Auth;

public class ChangePasswordDto
{
    [Required] public string CurrentPassword { get; set; } = string.Empty;
    [Required][MinLength(6)] public string NewPassword { get; set; } = string.Empty;
}
```

`RefreshTokenRequestDto.cs`:
```csharp
using System.ComponentModel.DataAnnotations;

namespace BarberBookSaaS.Application.DTOs.Auth;

public class RefreshTokenRequestDto
{
    [Required] public string RefreshToken { get; set; } = string.Empty;
}
```

`RefreshTokenResponseDto.cs`:
```csharp
namespace BarberBookSaaS.Application.DTOs.Auth;

public class RefreshTokenResponseDto
{
    public string Token { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
}
```

- [ ] **Step 4: Actualizar `AuthResponseDto.cs`**

Reemplazar el contenido completo del archivo:
```csharp
namespace BarberBookSaaS.Application.DTOs.Auth;

public class AuthResponseDto
{
    public string Token { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string TenantId { get; set; } = string.Empty;
    public bool MustChangePassword { get; set; }
}
```

- [ ] **Step 5: Verificar compilación**

```bash
cd c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi
dotnet build
```
Esperado: `0 Errores`

- [ ] **Step 6: Commit**

```bash
git add BarberBookSaaS.Application/DTOs/
git commit -m "feat: add DTOs for barbers, services, auth (refresh token, change password)"
```

---

### Task 3: ExceptionHandlingMiddleware

**Files:**
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi\Middleware\ExceptionHandlingMiddleware.cs`
- Modify: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi\Program.cs`

- [ ] **Step 1: Crear el middleware**

```csharp
using System.Net;
using System.Text.Json;

namespace BarberBookSaaS.WebApi.Middleware;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;
    private readonly IHostEnvironment _env;

    public ExceptionHandlingMiddleware(RequestDelegate next,
        ILogger<ExceptionHandlingMiddleware> logger,
        IHostEnvironment env)
    {
        _next = next;
        _logger = logger;
        _env = env;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception: {Message}", ex.Message);
            await HandleExceptionAsync(context, ex);
        }
    }

    private Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";
        context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;

        var response = _env.IsDevelopment()
            ? new { error = exception.Message, detail = exception.StackTrace, statusCode = 500 }
            : new { error = "Ocurrió un error interno. Por favor intenta más tarde.", detail = (string?)null, statusCode = 500 };

        var json = JsonSerializer.Serialize(response, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        return context.Response.WriteAsync(json);
    }
}
```

- [ ] **Step 2: Registrar el middleware en `Program.cs`**

Agregar esta línea **antes** de `app.UseHttpsRedirection()`:
```csharp
app.UseMiddleware<ExceptionHandlingMiddleware>();
```

El bloque de middlewares debe quedar así:
```csharp
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseHttpsRedirection();
app.UseCors("BarberBookCorsPolicy");
app.UseMiddleware<TenantMiddleware>();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
```

- [ ] **Step 3: Verificar compilación**

```bash
cd c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi
dotnet build
```
Esperado: `0 Errores`

- [ ] **Step 4: Commit**

```bash
git add BarberBookSaaS.WebApi/Middleware/ExceptionHandlingMiddleware.cs BarberBookSaaS.WebApi/Program.cs
git commit -m "feat: add global exception handling middleware"
```

---

### Task 4: Actualizar entidades User y Barber + TokenService

**Files:**
- Modify: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Domain\Entities\User.cs`
- Modify: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Domain\Entities\Barber.cs`
- Modify: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Infrastructure\Services\TokenService.cs`
- Modify: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Application\Common\ITokenService.cs`

- [ ] **Step 1: Actualizar `User.cs`** — agregar los 3 nuevos campos al final de la clase:

```csharp
using BarberBookSaaS.Domain.Common;

namespace BarberBookSaaS.Domain.Entities;

public class User : IMustHaveTenant
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool MustChangePassword { get; set; } = false;
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiresAt { get; set; }
}
```

- [ ] **Step 2: Actualizar `Barber.cs`** — agregar `UserId` al final:

```csharp
using BarberBookSaaS.Domain.Common;

namespace BarberBookSaaS.Domain.Entities;

public class Barber : IMustHaveTenant
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Specialty { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public Guid? UserId { get; set; }
}
```

- [ ] **Step 3: Actualizar `ITokenService.cs`** — agregar método para Customer (se usará en Plan B) y UserID claim:

```csharp
using BarberBookSaaS.Domain.Entities;

namespace BarberBookSaaS.Application.Common;

public interface ITokenService
{
    string CreateToken(User user);
    string CreateTokenForUser(Guid userId, string email, string role, string tenantId);
}
```

- [ ] **Step 4: Actualizar `TokenService.cs`** — JWT a 1h, agregar UserId claim, implementar nuevo método:

```csharp
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Domain.Entities;

namespace BarberBookSaaS.Infrastructure.Services;

public class TokenService : ITokenService
{
    private readonly string _jwtKey;

    public TokenService(IConfiguration configuration)
    {
        _jwtKey = configuration["Jwt:Key"]
            ?? throw new InvalidOperationException("JWT key 'Jwt:Key' is not configured.");
    }

    public string CreateToken(User user)
        => CreateTokenForUser(user.Id, user.Email, user.Role, user.TenantId);

    public string CreateTokenForUser(Guid userId, string email, string role, string tenantId)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new("UserId", userId.ToString()),
            new(ClaimTypes.Email, email),
            new(ClaimTypes.Role, role),
            new("TenantId", tenantId)
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
}
```

- [ ] **Step 5: Verificar compilación**

```bash
cd c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi
dotnet build
```
Esperado: `0 Errores`

- [ ] **Step 6: Commit**

```bash
git add BarberBookSaaS.Domain/Entities/User.cs BarberBookSaaS.Domain/Entities/Barber.cs BarberBookSaaS.Application/Common/ITokenService.cs BarberBookSaaS.Infrastructure/Services/TokenService.cs
git commit -m "feat: add refresh token fields to User, UserId to Barber, JWT expires in 1h"
```

---

### Task 5: IBarberService + BarberService

**Files:**
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Application\Common\IBarberService.cs`
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Infrastructure\Services\BarberService.cs`

- [ ] **Step 1: Crear `IBarberService.cs`**

```csharp
using BarberBookSaaS.Application.DTOs.Barbers;
using BarberBookSaaS.Domain.Entities;

namespace BarberBookSaaS.Application.Common;

public interface IBarberService
{
    Task<IEnumerable<Barber>> GetAllAsync();
    Task<CreateBarberResponseDto> CreateAsync(CreateBarberDto dto);
    Task<Barber?> UpdateAsync(Guid id, UpdateBarberDto dto);
    Task<bool> DeleteAsync(Guid id);
    Task<bool> ActivateAsync(Guid id);
    Task<IEnumerable<BarberSchedule>> GetScheduleAsync(Guid id);
    Task UpsertScheduleDayAsync(Guid id, BarberScheduleDto dto);
    Task DeleteScheduleDayAsync(Guid id, int day);
}
```

Nota: `BarberScheduleDto` ya existe en `BarberBookSaaS.Application.DTOs.Barbers`.

- [ ] **Step 2: Crear `BarberService.cs`**

```csharp
using System.Security.Cryptography;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Barbers;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using BCryptNet = BCrypt.Net.BCrypt;

namespace BarberBookSaaS.Infrastructure.Services;

public class BarberService : IBarberService
{
    private readonly ApplicationDbContext _context;

    public BarberService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<Barber>> GetAllAsync()
        => await _context.Barbers.Where(b => b.IsActive).ToListAsync();

    public async Task<CreateBarberResponseDto> CreateAsync(CreateBarberDto dto)
    {
        using var transaction = await _context.Database.BeginTransactionAsync();

        var tempPassword = GenerateTemporaryPassword();

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = dto.Email.ToLower(),
            Role = "Barbero",
            PasswordHash = BCryptNet.HashPassword(tempPassword),
            IsActive = true,
            MustChangePassword = true
        };

        var barber = new Barber
        {
            Id = Guid.NewGuid(),
            Name = dto.Name,
            Email = dto.Email.ToLower(),
            Phone = dto.Phone,
            Specialty = dto.Specialty,
            IsActive = true,
            UserId = user.Id
        };

        await _context.Users.AddAsync(user);
        await _context.Barbers.AddAsync(barber);
        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        return new CreateBarberResponseDto
        {
            Barber = barber,
            TemporaryPassword = tempPassword
        };
    }

    public async Task<Barber?> UpdateAsync(Guid id, UpdateBarberDto dto)
    {
        var barber = await _context.Barbers.FindAsync(id);
        if (barber is null) return null;

        barber.Name = dto.Name;
        barber.Email = dto.Email.ToLower();
        barber.Phone = dto.Phone;
        barber.Specialty = dto.Specialty;

        await _context.SaveChangesAsync();
        return barber;
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var barber = await _context.Barbers.FindAsync(id);
        if (barber is null) return false;

        barber.IsActive = false;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ActivateAsync(Guid id)
    {
        var barber = await _context.Barbers
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(b => b.Id == id && b.TenantId == _context.GetTenantId());
        if (barber is null) return false;

        barber.IsActive = true;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<IEnumerable<BarberSchedule>> GetScheduleAsync(Guid id)
        => await _context.BarberSchedules
            .Where(bs => bs.BarberId == id)
            .OrderBy(bs => bs.DayOfWeek)
            .ToListAsync();

    public async Task UpsertScheduleDayAsync(Guid id, BarberScheduleDto request)
    {
        var existing = await _context.BarberSchedules
            .FirstOrDefaultAsync(bs => bs.BarberId == id && bs.DayOfWeek == request.DayOfWeek);

        if (existing is not null)
        {
            existing.StartHour = request.StartHour;
            existing.StartMinute = request.StartMinute;
            existing.EndHour = request.EndHour;
            existing.EndMinute = request.EndMinute;
        }
        else
        {
            await _context.BarberSchedules.AddAsync(new BarberSchedule
            {
                Id = Guid.NewGuid(),
                BarberId = id,
                DayOfWeek = request.DayOfWeek,
                StartHour = request.StartHour,
                StartMinute = request.StartMinute,
                EndHour = request.EndHour,
                EndMinute = request.EndMinute
            });
        }

        await _context.SaveChangesAsync();
    }

    public async Task DeleteScheduleDayAsync(Guid id, int day)
    {
        var existing = await _context.BarberSchedules
            .FirstOrDefaultAsync(bs => bs.BarberId == id && bs.DayOfWeek == day);

        if (existing is not null)
        {
            _context.BarberSchedules.Remove(existing);
            await _context.SaveChangesAsync();
        }
    }

    private static string GenerateTemporaryPassword()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
        const string symbols = "!@#$%&*";
        using var rng = RandomNumberGenerator.Create();
        var bytes = new byte[11];
        rng.GetBytes(bytes);
        var password = new string(bytes.Select(b => chars[b % chars.Length]).ToArray());
        var symbolByte = new byte[1];
        rng.GetBytes(symbolByte);
        return password + symbols[symbolByte[0] % symbols.Length];
    }
}
```

**Nota importante:** `ActivateAsync` usa `_context.GetTenantId()`. Necesitamos agregar ese método de extensión o pasar `ITenantService`. La forma más simple: inyectar `ITenantService` en el constructor:

Actualizar el constructor y `ActivateAsync`:
```csharp
private readonly ApplicationDbContext _context;
private readonly ITenantService _tenantService;

public BarberService(ApplicationDbContext context, ITenantService tenantService)
{
    _context = context;
    _tenantService = tenantService;
}

public async Task<bool> ActivateAsync(Guid id)
{
    var barber = await _context.Barbers
        .IgnoreQueryFilters()
        .FirstOrDefaultAsync(b => b.Id == id && b.TenantId == _tenantService.TenantId);
    if (barber is null) return false;

    barber.IsActive = true;
    await _context.SaveChangesAsync();
    return true;
}
```

- [ ] **Step 3: Verificar compilación**

```bash
cd c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi
dotnet build
```
Esperado: `0 Errores`

- [ ] **Step 4: Commit**

```bash
git add BarberBookSaaS.Application/Common/IBarberService.cs BarberBookSaaS.Infrastructure/Services/BarberService.cs
git commit -m "feat: add IBarberService with unified Barber+User creation and activate endpoint"
```

---

### Task 6: Actualizar BarbersController + registrar IBarberService

**Files:**
- Modify: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi\Controllers\BarbersController.cs`
- Modify: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi\Program.cs`

- [ ] **Step 1: Reemplazar `BarbersController.cs` completo**

```csharp
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Barbers;

namespace BarberBookSaaS.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BarbersController : ControllerBase
{
    private readonly IBarberService _barberService;

    public BarbersController(IBarberService barberService)
    {
        _barberService = barberService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
        => Ok(await _barberService.GetAllAsync());

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] CreateBarberDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var result = await _barberService.CreateAsync(dto);
        return Ok(result);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateBarberDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var result = await _barberService.UpdateAsync(id, dto);
        if (result is null) return NotFound(new { message = "Barbero no encontrado." });
        return Ok(result);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var success = await _barberService.DeleteAsync(id);
        if (!success) return NotFound(new { message = "Barbero no encontrado." });
        return NoContent();
    }

    [HttpPut("{id}/activate")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Activate(Guid id)
    {
        var success = await _barberService.ActivateAsync(id);
        if (!success) return NotFound(new { message = "Barbero no encontrado." });
        return NoContent();
    }

    [HttpGet("{id}/schedule")]
    public async Task<IActionResult> GetSchedule(Guid id)
        => Ok(await _barberService.GetScheduleAsync(id));

    [HttpPost("{id}/schedule")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpsertScheduleDay(Guid id, [FromBody] BarberScheduleDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        await _barberService.UpsertScheduleDayAsync(id, dto);
        return Ok();
    }

    [HttpDelete("{id}/schedule/{day}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteScheduleDay(Guid id, int day)
    {
        await _barberService.DeleteScheduleDayAsync(id, day);
        return NoContent();
    }
}
```

- [ ] **Step 2: Registrar `IBarberService` en `Program.cs`**

Agregar junto a los otros `AddScoped`:
```csharp
builder.Services.AddScoped<IBarberService, BarberService>();
```

- [ ] **Step 3: Verificar compilación**

```bash
cd c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi
dotnet build
```
Esperado: `0 Errores`

- [ ] **Step 4: Commit**

```bash
git add BarberBookSaaS.WebApi/Controllers/BarbersController.cs BarberBookSaaS.WebApi/Program.cs
git commit -m "refactor: BarbersController uses IBarberService with DTOs, adds activate endpoint"
```

---

### Task 7: IServiceService + ServiceService + actualizar ServicesController

**Files:**
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Application\Common\IServiceService.cs`
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Infrastructure\Services\ServiceService.cs`
- Modify: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi\Controllers\ServiceController.cs`
- Modify: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi\Program.cs`

- [ ] **Step 1: Crear `IServiceService.cs`**

```csharp
using BarberBookSaaS.Application.DTOs.Services;
using BarberBookSaaS.Domain.Entities;

namespace BarberBookSaaS.Application.Common;

public interface IServiceService
{
    Task<IEnumerable<Service>> GetAllAsync();
    Task<Service> CreateAsync(CreateServiceDto dto);
    Task<Service?> UpdateAsync(Guid id, UpdateServiceDto dto);
    Task<bool> DeleteAsync(Guid id);
    Task<bool> ActivateAsync(Guid id);
}
```

- [ ] **Step 2: Crear `ServiceService.cs`**

```csharp
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Services;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BarberBookSaaS.Infrastructure.Services;

public class ServiceService : IServiceService
{
    private readonly ApplicationDbContext _context;
    private readonly ITenantService _tenantService;

    public ServiceService(ApplicationDbContext context, ITenantService tenantService)
    {
        _context = context;
        _tenantService = tenantService;
    }

    public async Task<IEnumerable<Service>> GetAllAsync()
        => await _context.Services.Where(s => s.IsActive).ToListAsync();

    public async Task<Service> CreateAsync(CreateServiceDto dto)
    {
        var service = new Service
        {
            Id = Guid.NewGuid(),
            Name = dto.Name,
            Price = dto.Price,
            DurationMinutes = dto.DurationMinutes,
            IsActive = true
        };
        await _context.Services.AddAsync(service);
        await _context.SaveChangesAsync();
        return service;
    }

    public async Task<Service?> UpdateAsync(Guid id, UpdateServiceDto dto)
    {
        var service = await _context.Services.FindAsync(id);
        if (service is null) return null;

        service.Name = dto.Name;
        service.Price = dto.Price;
        service.DurationMinutes = dto.DurationMinutes;

        await _context.SaveChangesAsync();
        return service;
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var service = await _context.Services.FindAsync(id);
        if (service is null) return false;

        service.IsActive = false;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ActivateAsync(Guid id)
    {
        var service = await _context.Services
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(s => s.Id == id && s.TenantId == _tenantService.TenantId);
        if (service is null) return false;

        service.IsActive = true;
        await _context.SaveChangesAsync();
        return true;
    }
}
```

- [ ] **Step 3: Reemplazar `ServiceController.cs` completo**

```csharp
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Services;

namespace BarberBookSaaS.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ServicesController : ControllerBase
{
    private readonly IServiceService _serviceService;

    public ServicesController(IServiceService serviceService)
    {
        _serviceService = serviceService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
        => Ok(await _serviceService.GetAllAsync());

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] CreateServiceDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var result = await _serviceService.CreateAsync(dto);
        return Ok(result);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateServiceDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var result = await _serviceService.UpdateAsync(id, dto);
        if (result is null) return NotFound(new { message = "Servicio no encontrado." });
        return Ok(result);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var success = await _serviceService.DeleteAsync(id);
        if (!success) return NotFound(new { message = "Servicio no encontrado." });
        return NoContent();
    }

    [HttpPut("{id}/activate")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Activate(Guid id)
    {
        var success = await _serviceService.ActivateAsync(id);
        if (!success) return NotFound(new { message = "Servicio no encontrado." });
        return NoContent();
    }
}
```

- [ ] **Step 4: Registrar `IServiceService` en `Program.cs`**

```csharp
builder.Services.AddScoped<IServiceService, ServiceService>();
```

- [ ] **Step 5: Verificar compilación**

```bash
cd c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi
dotnet build
```
Esperado: `0 Errores`

- [ ] **Step 6: Commit**

```bash
git add BarberBookSaaS.Application/Common/IServiceService.cs BarberBookSaaS.Infrastructure/Services/ServiceService.cs BarberBookSaaS.WebApi/Controllers/ServiceController.cs BarberBookSaaS.WebApi/Program.cs
git commit -m "refactor: ServicesController uses IServiceService with DTOs, adds activate endpoint"
```

---

### Task 8: Extender IAppointmentService + AppointmentService + actualizar AppointmentsController

**Files:**
- Modify: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Application\Common\IAppointmentService.cs`
- Modify: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Infrastructure\Services\AppointmentService.cs`
- Modify: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi\Controllers\AppointmentsController.cs`

- [ ] **Step 1: Actualizar `IAppointmentService.cs`**

```csharp
using BarberBookSaaS.Application.DTOs;
using BarberBookSaaS.Application.DTOs.Appointments;
using BarberBookSaaS.Domain.Entities;

namespace BarberBookSaaS.Application.Common;

public interface IAppointmentService
{
    Task<Appointment?> CreateAppointmentAsync(CreateAppointmentDto request);
    Task<PagedResult<Appointment>> GetAllAsync(int page, int pageSize, string? status, DateTime? from, DateTime? to);
    Task<Appointment?> UpdateStatusAsync(Guid id, string status);
    Task<IEnumerable<AvailabilitySlotDto>> GetAvailabilityAsync(Guid barberId, Guid serviceId, DateOnly date);
}
```

- [ ] **Step 2: Actualizar `AppointmentService.cs`** — agregar los 3 nuevos métodos y usar AppointmentStatus:

```csharp
using Microsoft.EntityFrameworkCore;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs;
using BarberBookSaaS.Application.DTOs.Appointments;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;

namespace BarberBookSaaS.Infrastructure.Services;

public class AppointmentService : IAppointmentService
{
    private readonly ApplicationDbContext _context;

    public AppointmentService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Appointment?> CreateAppointmentAsync(CreateAppointmentDto request)
    {
        var service = await _context.Services.FindAsync(request.ServiceId);
        if (service == null || !service.IsActive) return null;

        var newStart = request.AppointmentDate;
        var newEnd = newStart.AddMinutes(service.DurationMinutes);

        if (newStart < DateTime.Now) return null;

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
            if (eStart < newEnd && newStart < eEnd) return null;
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
        return newAppointment;
    }

    public async Task<PagedResult<Appointment>> GetAllAsync(
        int page, int pageSize, string? status, DateTime? from, DateTime? to)
    {
        var query = _context.Appointments
            .Include(a => a.Barber)
            .Include(a => a.Service)
            .AsQueryable();

        if (!string.IsNullOrEmpty(status))
            query = query.Where(a => a.Status == status);

        if (from.HasValue)
            query = query.Where(a => a.AppointmentDate >= from.Value);

        if (to.HasValue)
            query = query.Where(a => a.AppointmentDate <= to.Value);

        var total = await query.CountAsync();

        var data = await query
            .OrderByDescending(a => a.AppointmentDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResult<Appointment>
        {
            Data = data,
            Total = total,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<Appointment?> UpdateStatusAsync(Guid id, string status)
    {
        if (!AppointmentStatus.IsValid(status)) return null;

        var appointment = await _context.Appointments
            .Include(a => a.Barber)
            .Include(a => a.Service)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (appointment is null) return null;

        appointment.Status = status;
        await _context.SaveChangesAsync();
        return appointment;
    }

    public async Task<IEnumerable<AvailabilitySlotDto>> GetAvailabilityAsync(
        Guid barberId, Guid serviceId, DateOnly date)
    {
        var service = await _context.Services.FindAsync(serviceId);
        if (service is null) return [];

        var dayIndex = (int)date.DayOfWeek;
        var schedule = await _context.BarberSchedules
            .FirstOrDefaultAsync(bs => bs.BarberId == barberId && bs.DayOfWeek == dayIndex);

        if (schedule is null) return [];

        var dayStart = date.ToDateTime(TimeOnly.MinValue);
        var dayEnd = dayStart.AddDays(1);

        var existingAppointments = await _context.Appointments
            .Include(a => a.Service)
            .Where(a => a.BarberId == barberId
                        && a.AppointmentDate >= dayStart
                        && a.AppointmentDate < dayEnd
                        && a.Status != AppointmentStatus.Cancelled)
            .ToListAsync();

        var slots = new List<AvailabilitySlotDto>();
        var duration = TimeSpan.FromMinutes(service.DurationMinutes);
        var scheduleEnd = new TimeSpan(schedule.EndHour, schedule.EndMinute, 0);
        var current = new TimeSpan(schedule.StartHour, schedule.StartMinute, 0);

        while (current.Add(duration) <= scheduleEnd)
        {
            var slotStart = dayStart.Add(current);
            var slotEnd = slotStart.Add(duration);

            var hasConflict = existingAppointments.Any(a =>
            {
                var aStart = a.AppointmentDate;
                var aEnd = aStart.AddMinutes(a.Service!.DurationMinutes);
                return aStart < slotEnd && slotStart < aEnd;
            });

            slots.Add(new AvailabilitySlotDto
            {
                Time = $"{current.Hours:D2}:{current.Minutes:D2}",
                Available = !hasConflict
            });

            current = current.Add(TimeSpan.FromMinutes(30));
        }

        return slots;
    }
}
```

- [ ] **Step 3: Reemplazar `AppointmentsController.cs` completo**

```csharp
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Appointments;
using BarberBookSaaS.Domain.Constants;

namespace BarberBookSaaS.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AppointmentsController : ControllerBase
{
    private readonly IAppointmentService _appointmentService;

    public AppointmentsController(IAppointmentService appointmentService)
    {
        _appointmentService = appointmentService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? status = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null)
    {
        if (status is not null && !AppointmentStatus.IsValid(status))
            return BadRequest(new { message = $"Estado inválido. Valores permitidos: {string.Join(", ", AppointmentStatus.All)}" });

        var result = await _appointmentService.GetAllAsync(page, pageSize, status, from, to);
        return Ok(result);
    }

    [HttpGet("availability")]
    public async Task<IActionResult> GetAvailability(
        [FromQuery] Guid barberId,
        [FromQuery] Guid serviceId,
        [FromQuery] string date)
    {
        if (!DateOnly.TryParse(date, out var parsedDate))
            return BadRequest(new { message = "Formato de fecha inválido. Use YYYY-MM-DD." });

        var slots = await _appointmentService.GetAvailabilityAsync(barberId, serviceId, parsedDate);
        return Ok(slots);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateAppointmentDto request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var appointment = await _appointmentService.CreateAppointmentAsync(request);
        if (appointment is null)
            return BadRequest(new { message = "No se pudo agendar la cita. Verifica la disponibilidad o que la fecha sea futura." });

        return Ok(appointment);
    }

    [HttpPut("{id}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateAppointmentStatusDto request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var appointment = await _appointmentService.UpdateStatusAsync(id, request.Status);
        if (appointment is null)
            return BadRequest(new { message = "Cita no encontrada o estado inválido." });

        return Ok(appointment);
    }
}
```

- [ ] **Step 4: Verificar compilación**

```bash
cd c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi
dotnet build
```
Esperado: `0 Errores`

- [ ] **Step 5: Commit**

```bash
git add BarberBookSaaS.Application/Common/IAppointmentService.cs BarberBookSaaS.Infrastructure/Services/AppointmentService.cs BarberBookSaaS.WebApi/Controllers/AppointmentsController.cs
git commit -m "refactor: AppointmentService uses typed status constants, adds pagination and availability"
```

---

### Task 9: Refresh tokens + logout + change-password

**Files:**
- Modify: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Application\Common\IAuthService.cs`
- Modify: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Infrastructure\Services\AuthService.cs`
- Modify: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi\Controllers\AuthController.cs`

- [ ] **Step 1: Actualizar `IAuthService.cs`**

```csharp
using BarberBookSaaS.Application.DTOs.Auth;

namespace BarberBookSaaS.Application.Common;

public interface IAuthService
{
    Task<bool> RegisterTenantAsync(RegisterTenantDto request);
    Task<AuthResponseDto?> LoginAsync(LoginDto request);
    Task<RefreshTokenResponseDto?> RefreshTokenAsync(string refreshToken);
    Task<bool> LogoutAsync(Guid userId);
    Task<bool> ChangePasswordAsync(Guid userId, ChangePasswordDto dto);
}
```

- [ ] **Step 2: Reemplazar `AuthService.cs` completo**

```csharp
using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Auth;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using BCryptNet = BCrypt.Net.BCrypt;

namespace BarberBookSaaS.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly ApplicationDbContext _context;
    private readonly ITokenService _tokenService;

    public AuthService(ApplicationDbContext context, ITokenService tokenService)
    {
        _context = context;
        _tokenService = tokenService;
    }

    public async Task<bool> RegisterTenantAsync(RegisterTenantDto request)
    {
        var exists = await _context.Tenants
            .AnyAsync(t => t.Subdomain == request.Subdomain.ToLower());
        if (exists) return false;

        var newTenant = new Tenant
        {
            Id = request.Subdomain.ToLower(),
            Name = request.BarberiaName,
            Subdomain = request.Subdomain.ToLower(),
            Phone = request.Phone,
            Address = request.Address
        };

        var newAdmin = new User
        {
            Id = Guid.NewGuid(),
            TenantId = newTenant.Id,
            Email = request.AdminEmail.ToLower(),
            Role = "Admin",
            PasswordHash = BCryptNet.HashPassword(request.AdminPassword),
            IsActive = true
        };

        await _context.Tenants.AddAsync(newTenant);
        await _context.Users.AddAsync(newAdmin);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<AuthResponseDto?> LoginAsync(LoginDto request)
    {
        var user = await _context.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Email == request.Email.ToLower());

        if (user is null || !BCryptNet.Verify(request.Password, user.PasswordHash) || !user.IsActive)
            return null;

        var (accessToken, refreshToken, expiresAt) = await GenerateTokensAsync(user);

        return new AuthResponseDto
        {
            Token = accessToken,
            RefreshToken = refreshToken,
            ExpiresAt = expiresAt,
            UserId = user.Id.ToString(),
            Email = user.Email,
            Role = user.Role,
            TenantId = user.TenantId,
            MustChangePassword = user.MustChangePassword
        };
    }

    public async Task<RefreshTokenResponseDto?> RefreshTokenAsync(string refreshToken)
    {
        var user = await _context.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.RefreshToken == refreshToken);

        if (user is null || user.RefreshTokenExpiresAt < DateTime.UtcNow)
            return null;

        var (accessToken, newRefreshToken, expiresAt) = await GenerateTokensAsync(user);

        return new RefreshTokenResponseDto
        {
            Token = accessToken,
            RefreshToken = newRefreshToken,
            ExpiresAt = expiresAt
        };
    }

    public async Task<bool> LogoutAsync(Guid userId)
    {
        var user = await _context.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user is null) return false;

        user.RefreshToken = null;
        user.RefreshTokenExpiresAt = null;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ChangePasswordAsync(Guid userId, ChangePasswordDto dto)
    {
        var user = await _context.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user is null || !BCryptNet.Verify(dto.CurrentPassword, user.PasswordHash))
            return false;

        user.PasswordHash = BCryptNet.HashPassword(dto.NewPassword);
        user.MustChangePassword = false;
        await _context.SaveChangesAsync();
        return true;
    }

    private async Task<(string accessToken, string refreshToken, DateTime expiresAt)> GenerateTokensAsync(User user)
    {
        var expiresAt = DateTime.UtcNow.AddHours(1);
        var accessToken = _tokenService.CreateToken(user);
        var refreshToken = GenerateSecureToken();

        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiresAt = DateTime.UtcNow.AddDays(30);
        await _context.SaveChangesAsync();

        return (accessToken, refreshToken, expiresAt);
    }

    private static string GenerateSecureToken()
    {
        var bytes = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(bytes);
        return Convert.ToBase64String(bytes);
    }
}
```

- [ ] **Step 3: Reemplazar `AuthController.cs` completo**

```csharp
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Auth;

namespace BarberBookSaaS.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterTenantDto request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var result = await _authService.RegisterTenantAsync(request);
        if (!result)
            return BadRequest(new { message = "El subdominio ya está registrado." });

        return Ok(new { message = "Barbería y cuenta admin creadas exitosamente." });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var response = await _authService.LoginAsync(request);
        if (response is null)
            return Unauthorized(new { message = "Credenciales incorrectas." });

        return Ok(response);
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshTokenRequestDto request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var response = await _authService.RefreshTokenAsync(request.RefreshToken);
        if (response is null)
            return Unauthorized(new { message = "Refresh token inválido o expirado." });

        return Ok(response);
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        var userIdClaim = User.FindFirstValue("UserId");
        if (userIdClaim is null || !Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        await _authService.LogoutAsync(userId);
        return NoContent();
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var userIdClaim = User.FindFirstValue("UserId");
        if (userIdClaim is null || !Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        var success = await _authService.ChangePasswordAsync(userId, request);
        if (!success)
            return BadRequest(new { message = "Contraseña actual incorrecta." });

        return NoContent();
    }
}
```

- [ ] **Step 4: Verificar compilación**

```bash
cd c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi
dotnet build
```
Esperado: `0 Errores`

- [ ] **Step 5: Commit**

```bash
git add BarberBookSaaS.Application/Common/IAuthService.cs BarberBookSaaS.Infrastructure/Services/AuthService.cs BarberBookSaaS.WebApi/Controllers/AuthController.cs
git commit -m "feat: add refresh tokens, logout and change-password to auth flow"
```

---

### Task 10: Rate limiting en Program.cs

**Files:**
- Modify: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi\Program.cs`

- [ ] **Step 1: Agregar `using` y configurar rate limiter en la sección de servicios**

Agregar el `using` al inicio del archivo:
```csharp
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
```

Agregar la configuración del rate limiter junto a los otros servicios (antes de `var app = builder.Build()`):
```csharp
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

- [ ] **Step 2: Habilitar el middleware de rate limiting en el pipeline**

Agregar `app.UseRateLimiter();` después de `app.UseAuthorization()`:
```csharp
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.MapControllers();
```

- [ ] **Step 3: Aplicar `[EnableRateLimiting("auth")]` en `AuthController.cs`**

Agregar el atributo en los endpoints que necesitan protección:
```csharp
using Microsoft.AspNetCore.RateLimiting;

// En el controller, decorar los endpoints:
[HttpPost("login")]
[EnableRateLimiting("auth")]
public async Task<IActionResult> Login(...)

[HttpPost("refresh")]
[EnableRateLimiting("auth")]
public async Task<IActionResult> Refresh(...)

[HttpPost("change-password")]
[Authorize]
[EnableRateLimiting("auth")]
public async Task<IActionResult> ChangePassword(...)
```

- [ ] **Step 4: Verificar compilación**

```bash
cd c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi
dotnet build
```
Esperado: `0 Errores`

- [ ] **Step 5: Commit**

```bash
git add BarberBookSaaS.WebApi/Program.cs BarberBookSaaS.WebApi/Controllers/AuthController.cs
git commit -m "feat: add rate limiting on auth endpoints (5 requests per 15 minutes)"
```

---

### Task 11: Migración + verificación final Plan A

**Files:**
- `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Infrastructure\Persistence\Migrations\` (generado automáticamente)

- [ ] **Step 1: Crear la migración**

```bash
cd c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Infrastructure
dotnet ef migrations add AgregarRefreshTokenYBarberoVinculado --startup-project ../BarberBookSaaS.WebApi
```

Esperado: `Done. To undo this action, use 'ef migrations remove'`

Verificar que la migración generada incluye:
- Columnas `MustChangePassword`, `RefreshToken`, `RefreshTokenExpiresAt` en tabla `Users`
- Columna `UserId` en tabla `Barbers`

- [ ] **Step 2: Aplicar la migración**

```bash
dotnet ef database update --startup-project ../BarberBookSaaS.WebApi
```

Esperado: `Done.`

- [ ] **Step 3: Build final de Plan A**

```bash
cd c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi
dotnet build
```

Esperado: `Compilación correcta. 0 Advertencias. 0 Errores.`

- [ ] **Step 4: Smoke test manual** (opcional pero recomendado)

```bash
cd c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi
dotnet run
```

Abrir `http://localhost:5299/swagger` y verificar:
1. `POST /api/auth/login` → devuelve `token`, `refreshToken`, `expiresAt`
2. `POST /api/auth/refresh` con el refreshToken → devuelve nuevos tokens
3. `GET /api/appointments?page=1&pageSize=5` → devuelve `{ data, total, page, pageSize, totalPages }`
4. `POST /api/barbers` con `{ name, email, phone, specialty }` → devuelve barber + temporaryPassword
5. `PUT /api/barbers/{id}/activate` → reactiva un barbero soft-deleted

- [ ] **Step 5: Commit final Plan A**

```bash
cd c:\Users\Admin\BarberBookSaaS
git add BarberBookSaaS.Infrastructure/Persistence/Migrations/
git commit -m "feat: migration AgregarRefreshTokenYBarberoVinculado — Plan A completo"
git push origin main
```

---

## Resumen Plan A

Al completar Plan A, el backend tendrá:

| Mejora | Estado |
|--------|--------|
| Estados de cita como constantes (`AppointmentStatus`) | ✅ |
| DTOs propios para Barbers y Services (sin binding a entidades) | ✅ |
| ExceptionHandlingMiddleware (errores con formato JSON) | ✅ |
| IBarberService + IServiceService (service layer completo) | ✅ |
| Creación atómica Barber+User con contraseña temporal | ✅ |
| Endpoint `PUT /activate` para reactivar soft-deleted | ✅ |
| JWT de 1h + refresh token de 30 días | ✅ |
| Endpoints `/refresh`, `/logout`, `/change-password` | ✅ |
| Rate limiting en auth (5 intentos / 15 min) | ✅ |
| Paginación en `GET /api/appointments` | ✅ |

Siguiente: ejecutar **Plan B** (`2026-05-26-fase6-plan-b-nuevas-features.md`)