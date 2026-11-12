# Fase 6 — Plan B: Nuevas Features (Customer, Loyalty, Dashboard, Public Booking)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar la capa de funcionalidades nuevas al backend: entidad `Customer` con autenticación por teléfono, sistema de fidelización opcional por tenant, dashboard de métricas, controller de perfil de cliente y endpoints públicos de agendamiento sin JWT para clientes.

**Architecture:** Todas las features nuevas son aditivas: se crean nuevas entidades, interfaces, servicios y controllers sin modificar los existentes salvo agregar campos a Tenant y Appointment. Los endpoints públicos (`/api/public/{subdomain}/*`) usan `IgnoreQueryFilters()` + filtro manual por subdomain para los GET anónimos; para el POST de citas requieren JWT de cliente (`role: Customer`) y el TenantMiddleware existente resuelve el TenantId desde ese JWT.

**Tech Stack:** .NET 10 / ASP.NET Core / EF Core / SQLite / BCrypt.Net-Next / Microsoft.AspNetCore.RateLimiting

**Spec:** `docs/superpowers/specs/2026-05-26-backend-robustness-design.md` (Secciones 2, 3, 4, 5)

**Prerequisite:** Plan A completado y su migración `AgregarRefreshTokenYBarberoVinculado` aplicada. Verificar antes de empezar:
```bash
cd c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi
dotnet build
# Esperado: 0 errores, 0 advertencias
```

---

### Task 1: Customer entity + actualizar Tenant + actualizar Appointment

**Files:**
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Domain\Entities\Customer.cs`
- Modify: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Domain\Entities\Tenant.cs`
- Modify: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Domain\Entities\Appointment.cs`

- [ ] **Step 1: Crear `Customer.cs`**

```csharp
using BarberBookSaaS.Domain.Common;

namespace BarberBookSaaS.Domain.Entities;

public class Customer : IMustHaveTenant
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public int LoyaltyCount { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiresAt { get; set; }
}
```

- [ ] **Step 2: Actualizar `Tenant.cs`** — agregar los dos campos de fidelización al final:

```csharp
namespace BarberBookSaaS.Domain.Entities;

public class Tenant
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Subdomain { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? LogoUrl { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string Theme { get; set; } = "dark-premium";
    public string PrimaryColor { get; set; } = "#D4AF37";
    public string SecondaryColor { get; set; } = "#6366F1";
    public string? LogoBase64 { get; set; }
    public bool LoyaltyEnabled { get; set; } = false;
    public int LoyaltyThreshold { get; set; } = 10;
}
```

- [ ] **Step 3: Actualizar `Appointment.cs`** — agregar `IsFree` y `CustomerId` al final:

```csharp
using BarberBookSaaS.Domain.Common;

namespace BarberBookSaaS.Domain.Entities;

public class Appointment : IMustHaveTenant
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public Guid BarberId { get; set; }
    public Guid ServiceId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string? CustomerPhone { get; set; }
    public DateTime AppointmentDate { get; set; }
    public string Status { get; set; } = "Pendiente";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsFree { get; set; } = false;
    public Guid? CustomerId { get; set; }
    public Barber? Barber { get; set; }
    public Service? Service { get; set; }
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
cd c:\Users\Admin\BarberBookSaaS
git add BarberBookSaaS.Domain/Entities/Customer.cs BarberBookSaaS.Domain/Entities/Tenant.cs BarberBookSaaS.Domain/Entities/Appointment.cs
git commit -m "feat: add Customer entity, loyalty fields to Tenant, IsFree/CustomerId to Appointment"
```

---

### Task 2: Nuevos DTOs (Customer, Dashboard, Loyalty, CustomerMe, PublicAppointment)

**Files:**
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Application\DTOs\Customers\RegisterCustomerDto.cs`
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Application\DTOs\Customers\LoginCustomerDto.cs`
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Application\DTOs\Customers\CustomerAuthResponseDto.cs`
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Application\DTOs\Customers\CustomerMeDto.cs`
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Application\DTOs\Dashboard\DashboardStatsDto.cs`
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Application\DTOs\Tenant\LoyaltyConfigDto.cs`
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Application\DTOs\Tenant\UpdateLoyaltyDto.cs`
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Application\DTOs\Appointments\PublicCreateAppointmentDto.cs`

- [ ] **Step 1: Crear DTOs de Customer**

`RegisterCustomerDto.cs`:
```csharp
using System.ComponentModel.DataAnnotations;

namespace BarberBookSaaS.Application.DTOs.Customers;

public class RegisterCustomerDto
{
    [Required] public string Name { get; set; } = string.Empty;
    [Required] public string Phone { get; set; } = string.Empty;
    [Required][MinLength(6)] public string Password { get; set; } = string.Empty;
}
```

`LoginCustomerDto.cs`:
```csharp
using System.ComponentModel.DataAnnotations;

namespace BarberBookSaaS.Application.DTOs.Customers;

public class LoginCustomerDto
{
    [Required] public string Phone { get; set; } = string.Empty;
    [Required] public string Password { get; set; } = string.Empty;
}
```

`CustomerAuthResponseDto.cs`:
```csharp
namespace BarberBookSaaS.Application.DTOs.Customers;

public class CustomerAuthResponseDto
{
    public string Token { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public string CustomerId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string TenantId { get; set; } = string.Empty;
    public int LoyaltyCount { get; set; }
}
```

`CustomerMeDto.cs`:
```csharp
namespace BarberBookSaaS.Application.DTOs.Customers;

public class CustomerMeDto
{
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public int LoyaltyCount { get; set; }
    public int LoyaltyThreshold { get; set; }
    public bool LoyaltyEnabled { get; set; }
}
```

- [ ] **Step 2: Crear DTOs de Dashboard**

`DashboardStatsDto.cs`:
```csharp
namespace BarberBookSaaS.Application.DTOs.Dashboard;

public class DashboardStatsDto
{
    public int TodayAppointments { get; set; }
    public decimal TodayRevenue { get; set; }
    public int PendingAppointments { get; set; }
    public int TotalActiveBarbers { get; set; }
    public BusiestBarberDto? BusiestBarber { get; set; }
}

public class BusiestBarberDto
{
    public string Name { get; set; } = string.Empty;
    public int AppointmentsToday { get; set; }
}
```

- [ ] **Step 3: Crear DTOs de Loyalty**

`LoyaltyConfigDto.cs`:
```csharp
namespace BarberBookSaaS.Application.DTOs.Tenant;

public class LoyaltyConfigDto
{
    public bool Enabled { get; set; }
    public int Threshold { get; set; }
}
```

`UpdateLoyaltyDto.cs`:
```csharp
using System.ComponentModel.DataAnnotations;

namespace BarberBookSaaS.Application.DTOs.Tenant;

public class UpdateLoyaltyDto
{
    public bool Enabled { get; set; }
    [Range(1, 1000)] public int Threshold { get; set; } = 10;
}
```

- [ ] **Step 4: Crear `PublicCreateAppointmentDto.cs`**

```csharp
namespace BarberBookSaaS.Application.DTOs.Appointments;

public class PublicCreateAppointmentDto
{
    public Guid BarberId { get; set; }
    public Guid ServiceId { get; set; }
    public DateTime AppointmentDate { get; set; }
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
cd c:\Users\Admin\BarberBookSaaS
git add BarberBookSaaS.Application/DTOs/
git commit -m "feat: add DTOs for Customer auth, Dashboard stats, Loyalty config, public booking"
```

---

### Task 3: Actualizar ApplicationDbContext

**Files:**
- Modify: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Infrastructure\Persistence\ApplicationDbContext.cs`

- [ ] **Step 1: Agregar `DbSet<Customer>`, QueryFilter y unique index**

Reemplazar el contenido completo del archivo:
```csharp
using Microsoft.EntityFrameworkCore;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Application.Common;

namespace BarberBookSaaS.Infrastructure.Persistence;

public class ApplicationDbContext : DbContext
{
    private readonly ITenantService _tenantService;

    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options,
        ITenantService tenantService) : base(options)
    {
        _tenantService = tenantService;
    }

    public DbSet<Tenant> Tenants { get; set; }
    public DbSet<User> Users { get; set; }
    public DbSet<Customer> Customers { get; set; }
    public DbSet<Barber> Barbers { get; set; }
    public DbSet<BarberSchedule> BarberSchedules { get; set; }
    public DbSet<Service> Services { get; set; }
    public DbSet<Appointment> Appointments { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Service>().Property(s => s.Price).HasConversion<double>();

        // RELACIONES
        modelBuilder.Entity<Appointment>()
            .HasOne(a => a.Barber).WithMany().HasForeignKey(a => a.BarberId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Appointment>()
            .HasOne(a => a.Service).WithMany().HasForeignKey(a => a.ServiceId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<BarberSchedule>()
            .HasOne(bs => bs.Barber).WithMany().HasForeignKey(bs => bs.BarberId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<BarberSchedule>()
            .HasIndex(bs => new { bs.BarberId, bs.DayOfWeek })
            .IsUnique();

        // Teléfono único por tenant para Customer
        modelBuilder.Entity<Customer>()
            .HasIndex(c => new { c.TenantId, c.Phone })
            .IsUnique();

        // FILTROS GLOBALES MULTI-TENANT
        modelBuilder.Entity<User>().HasQueryFilter(u => u.TenantId == _tenantService.TenantId);
        modelBuilder.Entity<Barber>().HasQueryFilter(b => b.TenantId == _tenantService.TenantId);
        modelBuilder.Entity<BarberSchedule>().HasQueryFilter(bs => bs.TenantId == _tenantService.TenantId);
        modelBuilder.Entity<Service>().HasQueryFilter(s => s.TenantId == _tenantService.TenantId);
        modelBuilder.Entity<Appointment>().HasQueryFilter(a => a.TenantId == _tenantService.TenantId);
        modelBuilder.Entity<Customer>().HasQueryFilter(c => c.TenantId == _tenantService.TenantId);
    }

    public override int SaveChanges()
    {
        ApplyTenantIdToNewEntities();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyTenantIdToNewEntities();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void ApplyTenantIdToNewEntities()
    {
        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.State == EntityState.Added)
            {
                var tenantIdProp = entry.Entity.GetType().GetProperty("TenantId");
                if (tenantIdProp != null)
                {
                    tenantIdProp.SetValue(entry.Entity, _tenantService.TenantId);
                }
            }
        }
    }
}
```

- [ ] **Step 2: Verificar compilación**

```bash
cd c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi
dotnet build
```
Esperado: `0 Errores`

- [ ] **Step 3: Commit**

```bash
cd c:\Users\Admin\BarberBookSaaS
git add BarberBookSaaS.Infrastructure/Persistence/ApplicationDbContext.cs
git commit -m "feat: add Customer DbSet, query filter and unique phone-per-tenant index to DbContext"
```

---

### Task 4: ICustomerAuthService + CustomerAuthService

**Files:**
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Application\Common\ICustomerAuthService.cs`
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Infrastructure\Services\CustomerAuthService.cs`

- [ ] **Step 1: Crear `ICustomerAuthService.cs`**

```csharp
using BarberBookSaaS.Application.DTOs.Customers;

namespace BarberBookSaaS.Application.Common;

public interface ICustomerAuthService
{
    Task<CustomerAuthResponseDto?> RegisterAsync(string subdomain, RegisterCustomerDto dto);
    Task<CustomerAuthResponseDto?> LoginAsync(string subdomain, LoginCustomerDto dto);
    Task<CustomerAuthResponseDto?> RefreshTokenAsync(string refreshToken);
}
```

- [ ] **Step 2: Crear `CustomerAuthService.cs`**

```csharp
using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Customers;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using BCryptNet = BCrypt.Net.BCrypt;

namespace BarberBookSaaS.Infrastructure.Services;

public class CustomerAuthService : ICustomerAuthService
{
    private readonly ApplicationDbContext _context;
    private readonly ITokenService _tokenService;

    public CustomerAuthService(ApplicationDbContext context, ITokenService tokenService)
    {
        _context = context;
        _tokenService = tokenService;
    }

    public async Task<CustomerAuthResponseDto?> RegisterAsync(string subdomain, RegisterCustomerDto dto)
    {
        var tenantExists = await _context.Tenants.AnyAsync(t => t.Id == subdomain);
        if (!tenantExists) return null;

        var phoneExists = await _context.Customers
            .IgnoreQueryFilters()
            .AnyAsync(c => c.TenantId == subdomain && c.Phone == dto.Phone);
        if (phoneExists) return null;

        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            TenantId = subdomain,
            Name = dto.Name,
            Phone = dto.Phone,
            PasswordHash = BCryptNet.HashPassword(dto.Password),
            LoyaltyCount = 0,
            CreatedAt = DateTime.UtcNow
        };

        await _context.Customers.AddAsync(customer);
        await _context.SaveChangesAsync();

        return await BuildResponseAsync(customer);
    }

    public async Task<CustomerAuthResponseDto?> LoginAsync(string subdomain, LoginCustomerDto dto)
    {
        var customer = await _context.Customers
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.TenantId == subdomain && c.Phone == dto.Phone);

        if (customer is null || !BCryptNet.Verify(dto.Password, customer.PasswordHash))
            return null;

        return await BuildResponseAsync(customer);
    }

    public async Task<CustomerAuthResponseDto?> RefreshTokenAsync(string refreshToken)
    {
        var customer = await _context.Customers
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.RefreshToken == refreshToken);

        if (customer is null || customer.RefreshTokenExpiresAt < DateTime.UtcNow)
            return null;

        return await BuildResponseAsync(customer);
    }

    private async Task<CustomerAuthResponseDto> BuildResponseAsync(Customer customer)
    {
        var expiresAt = DateTime.UtcNow.AddHours(1);
        var accessToken = _tokenService.CreateTokenForUser(customer.Id, customer.Phone, "Customer", customer.TenantId);
        var refreshToken = GenerateSecureToken();

        customer.RefreshToken = refreshToken;
        customer.RefreshTokenExpiresAt = DateTime.UtcNow.AddDays(30);
        await _context.SaveChangesAsync();

        return new CustomerAuthResponseDto
        {
            Token = accessToken,
            RefreshToken = refreshToken,
            ExpiresAt = expiresAt,
            CustomerId = customer.Id.ToString(),
            Name = customer.Name,
            Phone = customer.Phone,
            TenantId = customer.TenantId,
            LoyaltyCount = customer.LoyaltyCount
        };
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

**Nota importante:** `RegisterAsync` llama a `_context.Customers.AddAsync(customer)` con `TenantId = subdomain` ya asignado en el objeto. El interceptor `ApplyTenantIdToNewEntities` intentará sobreescribir con `_tenantService.TenantId`, que estará vacío (request anónimo). Para evitar esto, debemos omitir la sobreescritura cuando el valor ya está establecido. Alternativa más simple: establecer `_tenantService.TenantId = subdomain` antes de guardar. Hacerlo así:

Inyectar `ITenantService` en el constructor:
```csharp
private readonly ApplicationDbContext _context;
private readonly ITokenService _tokenService;
private readonly ITenantService _tenantService;

public CustomerAuthService(ApplicationDbContext context, ITokenService tokenService, ITenantService tenantService)
{
    _context = context;
    _tokenService = tokenService;
    _tenantService = tenantService;
}
```

Y en `RegisterAsync`, antes de `AddAsync`, establecer el tenant:
```csharp
_tenantService.TenantId = subdomain;

var customer = new Customer
{
    Id = Guid.NewGuid(),
    // No asignar TenantId aquí — el interceptor lo pone desde _tenantService.TenantId
    Name = dto.Name,
    Phone = dto.Phone,
    PasswordHash = BCryptNet.HashPassword(dto.Password),
    LoyaltyCount = 0,
    CreatedAt = DateTime.UtcNow
};
```

El archivo final completo de `CustomerAuthService.cs` queda:

```csharp
using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Customers;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using BCryptNet = BCrypt.Net.BCrypt;

namespace BarberBookSaaS.Infrastructure.Services;

public class CustomerAuthService : ICustomerAuthService
{
    private readonly ApplicationDbContext _context;
    private readonly ITokenService _tokenService;
    private readonly ITenantService _tenantService;

    public CustomerAuthService(ApplicationDbContext context, ITokenService tokenService, ITenantService tenantService)
    {
        _context = context;
        _tokenService = tokenService;
        _tenantService = tenantService;
    }

    public async Task<CustomerAuthResponseDto?> RegisterAsync(string subdomain, RegisterCustomerDto dto)
    {
        var tenantExists = await _context.Tenants.AnyAsync(t => t.Id == subdomain);
        if (!tenantExists) return null;

        var phoneExists = await _context.Customers
            .IgnoreQueryFilters()
            .AnyAsync(c => c.TenantId == subdomain && c.Phone == dto.Phone);
        if (phoneExists) return null;

        _tenantService.TenantId = subdomain;

        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            Name = dto.Name,
            Phone = dto.Phone,
            PasswordHash = BCryptNet.HashPassword(dto.Password),
            LoyaltyCount = 0,
            CreatedAt = DateTime.UtcNow
        };

        await _context.Customers.AddAsync(customer);
        await _context.SaveChangesAsync();

        return await BuildResponseAsync(customer);
    }

    public async Task<CustomerAuthResponseDto?> LoginAsync(string subdomain, LoginCustomerDto dto)
    {
        var customer = await _context.Customers
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.TenantId == subdomain && c.Phone == dto.Phone);

        if (customer is null || !BCryptNet.Verify(dto.Password, customer.PasswordHash))
            return null;

        return await BuildResponseAsync(customer);
    }

    public async Task<CustomerAuthResponseDto?> RefreshTokenAsync(string refreshToken)
    {
        var customer = await _context.Customers
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.RefreshToken == refreshToken);

        if (customer is null || customer.RefreshTokenExpiresAt < DateTime.UtcNow)
            return null;

        return await BuildResponseAsync(customer);
    }

    private async Task<CustomerAuthResponseDto> BuildResponseAsync(Customer customer)
    {
        var expiresAt = DateTime.UtcNow.AddHours(1);
        var accessToken = _tokenService.CreateTokenForUser(customer.Id, customer.Phone, "Customer", customer.TenantId);
        var refreshToken = GenerateSecureToken();

        customer.RefreshToken = refreshToken;
        customer.RefreshTokenExpiresAt = DateTime.UtcNow.AddDays(30);
        await _context.SaveChangesAsync();

        return new CustomerAuthResponseDto
        {
            Token = accessToken,
            RefreshToken = refreshToken,
            ExpiresAt = expiresAt,
            CustomerId = customer.Id.ToString(),
            Name = customer.Name,
            Phone = customer.Phone,
            TenantId = customer.TenantId,
            LoyaltyCount = customer.LoyaltyCount
        };
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

- [ ] **Step 3: Verificar compilación**

```bash
cd c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi
dotnet build
```
Esperado: `0 Errores`

- [ ] **Step 4: Commit**

```bash
cd c:\Users\Admin\BarberBookSaaS
git add BarberBookSaaS.Application/Common/ICustomerAuthService.cs BarberBookSaaS.Infrastructure/Services/CustomerAuthService.cs
git commit -m "feat: add ICustomerAuthService with phone-based register, login and refresh token"
```

---

### Task 5: IDashboardService + DashboardService + DashboardController

**Files:**
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Application\Common\IDashboardService.cs`
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Infrastructure\Services\DashboardService.cs`
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi\Controllers\DashboardController.cs`

- [ ] **Step 1: Crear `IDashboardService.cs`**

```csharp
using BarberBookSaaS.Application.DTOs.Dashboard;

namespace BarberBookSaaS.Application.Common;

public interface IDashboardService
{
    Task<DashboardStatsDto> GetStatsAsync();
}
```

- [ ] **Step 2: Crear `DashboardService.cs`**

```csharp
using Microsoft.EntityFrameworkCore;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Dashboard;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Infrastructure.Persistence;

namespace BarberBookSaaS.Infrastructure.Services;

public class DashboardService : IDashboardService
{
    private readonly ApplicationDbContext _context;

    public DashboardService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<DashboardStatsDto> GetStatsAsync()
    {
        var today = DateTime.Now.Date;
        var tomorrow = today.AddDays(1);

        var todayAppointments = await _context.Appointments
            .Include(a => a.Service)
            .Include(a => a.Barber)
            .Where(a => a.AppointmentDate >= today && a.AppointmentDate < tomorrow)
            .ToListAsync();

        var todayCount = todayAppointments.Count(a => a.Status != AppointmentStatus.Cancelled);

        var todayRevenue = (decimal)todayAppointments
            .Where(a => a.Status == AppointmentStatus.Completed && a.Service != null)
            .Sum(a => (double)a.Service!.Price);

        var pendingCount = await _context.Appointments
            .CountAsync(a => a.Status == AppointmentStatus.Pending);

        var activeBarbers = await _context.Barbers.CountAsync(b => b.IsActive);

        BusiestBarberDto? busiestBarber = null;
        var topBarber = todayAppointments
            .Where(a => a.Status != AppointmentStatus.Cancelled && a.Barber != null)
            .GroupBy(a => new { a.BarberId, a.Barber!.Name })
            .Select(g => new { g.Key.Name, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .FirstOrDefault();

        if (topBarber is not null)
        {
            busiestBarber = new BusiestBarberDto
            {
                Name = topBarber.Name,
                AppointmentsToday = topBarber.Count
            };
        }

        return new DashboardStatsDto
        {
            TodayAppointments = todayCount,
            TodayRevenue = todayRevenue,
            PendingAppointments = pendingCount,
            TotalActiveBarbers = activeBarbers,
            BusiestBarber = busiestBarber
        };
    }
}
```

- [ ] **Step 3: Crear `DashboardController.cs`**

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BarberBookSaaS.Application.Common;

namespace BarberBookSaaS.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly IDashboardService _dashboardService;

    public DashboardController(IDashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
        => Ok(await _dashboardService.GetStatsAsync());
}
```

- [ ] **Step 4: Registrar `IDashboardService` en `Program.cs`**

Agregar junto a los otros `AddScoped`:
```csharp
builder.Services.AddScoped<IDashboardService, DashboardService>();
```

- [ ] **Step 5: Verificar compilación**

```bash
cd c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi
dotnet build
```
Esperado: `0 Errores`

- [ ] **Step 6: Commit**

```bash
cd c:\Users\Admin\BarberBookSaaS
git add BarberBookSaaS.Application/Common/IDashboardService.cs BarberBookSaaS.Infrastructure/Services/DashboardService.cs BarberBookSaaS.WebApi/Controllers/DashboardController.cs BarberBookSaaS.WebApi/Program.cs
git commit -m "feat: add IDashboardService with today stats, revenue, busiest barber"
```

---

### Task 6: ILoyaltyService + LoyaltyService + LoyaltyController

**Files:**
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Application\Common\ILoyaltyService.cs`
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Infrastructure\Services\LoyaltyService.cs`
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi\Controllers\LoyaltyController.cs`

- [ ] **Step 1: Crear `ILoyaltyService.cs`**

```csharp
using BarberBookSaaS.Application.DTOs.Tenant;

namespace BarberBookSaaS.Application.Common;

public interface ILoyaltyService
{
    Task<LoyaltyConfigDto?> GetLoyaltyConfigAsync();
    Task<bool> UpdateLoyaltyConfigAsync(UpdateLoyaltyDto dto);
}
```

- [ ] **Step 2: Crear `LoyaltyService.cs`**

```csharp
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Tenant;
using BarberBookSaaS.Infrastructure.Persistence;

namespace BarberBookSaaS.Infrastructure.Services;

public class LoyaltyService : ILoyaltyService
{
    private readonly ApplicationDbContext _context;
    private readonly ITenantService _tenantService;

    public LoyaltyService(ApplicationDbContext context, ITenantService tenantService)
    {
        _context = context;
        _tenantService = tenantService;
    }

    public async Task<LoyaltyConfigDto?> GetLoyaltyConfigAsync()
    {
        var tenant = await _context.Tenants.FindAsync(_tenantService.TenantId);
        if (tenant is null) return null;

        return new LoyaltyConfigDto
        {
            Enabled = tenant.LoyaltyEnabled,
            Threshold = tenant.LoyaltyThreshold
        };
    }

    public async Task<bool> UpdateLoyaltyConfigAsync(UpdateLoyaltyDto dto)
    {
        var tenant = await _context.Tenants.FindAsync(_tenantService.TenantId);
        if (tenant is null) return false;

        tenant.LoyaltyEnabled = dto.Enabled;
        tenant.LoyaltyThreshold = dto.Threshold;
        await _context.SaveChangesAsync();
        return true;
    }
}
```

- [ ] **Step 3: Crear `LoyaltyController.cs`**

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Tenant;

namespace BarberBookSaaS.WebApi.Controllers;

[ApiController]
[Route("api/tenant/loyalty")]
public class LoyaltyController : ControllerBase
{
    private readonly ILoyaltyService _loyaltyService;

    public LoyaltyController(ILoyaltyService loyaltyService)
    {
        _loyaltyService = loyaltyService;
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetConfig()
    {
        var config = await _loyaltyService.GetLoyaltyConfigAsync();
        if (config is null) return NotFound();
        return Ok(config);
    }

    [HttpPut]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateConfig([FromBody] UpdateLoyaltyDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var success = await _loyaltyService.UpdateLoyaltyConfigAsync(dto);
        if (!success) return NotFound();
        return NoContent();
    }
}
```

- [ ] **Step 4: Registrar `ILoyaltyService` en `Program.cs`**

```csharp
builder.Services.AddScoped<ILoyaltyService, LoyaltyService>();
```

- [ ] **Step 5: Verificar compilación**

```bash
cd c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi
dotnet build
```
Esperado: `0 Errores`

- [ ] **Step 6: Commit**

```bash
cd c:\Users\Admin\BarberBookSaaS
git add BarberBookSaaS.Application/Common/ILoyaltyService.cs BarberBookSaaS.Infrastructure/Services/LoyaltyService.cs BarberBookSaaS.WebApi/Controllers/LoyaltyController.cs BarberBookSaaS.WebApi/Program.cs
git commit -m "feat: add ILoyaltyService with per-tenant enable/disable and threshold config"
```

---

### Task 7: CustomerController (GET /api/customer/me)

**Files:**
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi\Controllers\CustomerController.cs`

- [ ] **Step 1: Crear `CustomerController.cs`**

```csharp
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BarberBookSaaS.Application.DTOs.Customers;
using BarberBookSaaS.Infrastructure.Persistence;

namespace BarberBookSaaS.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Customer")]
public class CustomerController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public CustomerController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMe()
    {
        var customerIdClaim = User.FindFirstValue("UserId");
        if (!Guid.TryParse(customerIdClaim, out var customerId))
            return Unauthorized();

        // Query filter is active because TenantMiddleware reads TenantId from Customer JWT
        var customer = await _context.Customers.FindAsync(customerId);
        if (customer is null) return NotFound();

        var tenant = await _context.Tenants.FindAsync(customer.TenantId);

        return Ok(new CustomerMeDto
        {
            Name = customer.Name,
            Phone = customer.Phone,
            LoyaltyCount = customer.LoyaltyCount,
            LoyaltyThreshold = tenant?.LoyaltyThreshold ?? 10,
            LoyaltyEnabled = tenant?.LoyaltyEnabled ?? false
        });
    }
}
```

- [ ] **Step 2: Verificar compilación**

```bash
cd c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi
dotnet build
```
Esperado: `0 Errores`

- [ ] **Step 3: Commit**

```bash
cd c:\Users\Admin\BarberBookSaaS
git add BarberBookSaaS.WebApi/Controllers/CustomerController.cs
git commit -m "feat: add CustomerController with GET /api/customer/me endpoint"
```

---

### Task 8: PublicBookingController

**Files:**
- Create: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi\Controllers\PublicBookingController.cs`

- [ ] **Step 1: Crear `PublicBookingController.cs`**

```csharp
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Appointments;
using BarberBookSaaS.Application.DTOs.Customers;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Infrastructure.Persistence;

namespace BarberBookSaaS.WebApi.Controllers;

[ApiController]
[Route("api/public/{subdomain}")]
[AllowAnonymous]
public class PublicBookingController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICustomerAuthService _customerAuthService;
    private readonly IAppointmentService _appointmentService;

    public PublicBookingController(
        ApplicationDbContext context,
        ICustomerAuthService customerAuthService,
        IAppointmentService appointmentService)
    {
        _context = context;
        _customerAuthService = customerAuthService;
        _appointmentService = appointmentService;
    }

    [HttpGet("barbers")]
    public async Task<IActionResult> GetBarbers(string subdomain)
    {
        var tenantExists = await _context.Tenants.AnyAsync(t => t.Id == subdomain);
        if (!tenantExists) return NotFound(new { message = "Barbería no encontrada." });

        var barbers = await _context.Barbers
            .IgnoreQueryFilters()
            .Where(b => b.TenantId == subdomain && b.IsActive)
            .Select(b => new { b.Id, b.Name, b.Specialty })
            .ToListAsync();

        return Ok(barbers);
    }

    [HttpGet("services")]
    public async Task<IActionResult> GetServices(string subdomain)
    {
        var tenantExists = await _context.Tenants.AnyAsync(t => t.Id == subdomain);
        if (!tenantExists) return NotFound(new { message = "Barbería no encontrada." });

        var services = await _context.Services
            .IgnoreQueryFilters()
            .Where(s => s.TenantId == subdomain && s.IsActive)
            .ToListAsync();

        return Ok(services);
    }

    [HttpGet("availability")]
    public async Task<IActionResult> GetAvailability(
        string subdomain,
        [FromQuery] Guid barberId,
        [FromQuery] Guid serviceId,
        [FromQuery] string date)
    {
        if (!DateOnly.TryParse(date, out var parsedDate))
            return BadRequest(new { message = "Formato de fecha inválido. Use YYYY-MM-DD." });

        var service = await _context.Services
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(s => s.Id == serviceId && s.TenantId == subdomain && s.IsActive);

        if (service is null)
            return NotFound(new { message = "Servicio no encontrado." });

        var barberExists = await _context.Barbers
            .IgnoreQueryFilters()
            .AnyAsync(b => b.Id == barberId && b.TenantId == subdomain && b.IsActive);

        if (!barberExists)
            return NotFound(new { message = "Barbero no encontrado." });

        var dayIndex = (int)parsedDate.DayOfWeek;
        var schedule = await _context.BarberSchedules
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(bs => bs.BarberId == barberId
                                       && bs.DayOfWeek == dayIndex
                                       && bs.TenantId == subdomain);

        if (schedule is null)
            return Ok(Array.Empty<object>());

        var dayStart = parsedDate.ToDateTime(TimeOnly.MinValue);
        var dayEnd = dayStart.AddDays(1);

        var existing = await _context.Appointments
            .IgnoreQueryFilters()
            .Include(a => a.Service)
            .Where(a => a.BarberId == barberId
                        && a.TenantId == subdomain
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

            var hasConflict = existing.Any(a =>
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

        return Ok(slots);
    }

    [HttpPost("auth/register")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> RegisterCustomer(string subdomain, [FromBody] RegisterCustomerDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var result = await _customerAuthService.RegisterAsync(subdomain, dto);
        if (result is null)
            return BadRequest(new { message = "El teléfono ya está registrado en esta barbería o la barbería no existe." });

        return Ok(result);
    }

    [HttpPost("auth/login")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> LoginCustomer(string subdomain, [FromBody] LoginCustomerDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var result = await _customerAuthService.LoginAsync(subdomain, dto);
        if (result is null)
            return Unauthorized(new { message = "Teléfono o contraseña incorrectos." });

        return Ok(result);
    }

    [HttpPost("auth/refresh")]
    public async Task<IActionResult> RefreshCustomerToken([FromBody] string refreshToken)
    {
        if (string.IsNullOrEmpty(refreshToken))
            return BadRequest(new { message = "Refresh token requerido." });

        var result = await _customerAuthService.RefreshTokenAsync(refreshToken);
        if (result is null)
            return Unauthorized(new { message = "Refresh token inválido o expirado." });

        return Ok(result);
    }

    [HttpPost("appointments")]
    [Authorize(Roles = "Customer")]
    public async Task<IActionResult> CreateAppointment(
        string subdomain,
        [FromBody] PublicCreateAppointmentDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        // JWT TenantId must match the subdomain in the route
        var jwtTenantId = User.FindFirstValue("TenantId");
        if (jwtTenantId != subdomain)
            return Forbid();

        var customerIdClaim = User.FindFirstValue("UserId");
        if (!Guid.TryParse(customerIdClaim, out var customerId))
            return Unauthorized();

        // TenantMiddleware has set TenantId from the Customer JWT — query filters are active
        var customer = await _context.Customers.FindAsync(customerId);
        if (customer is null)
            return NotFound(new { message = "Cliente no encontrado." });

        var createDto = new CreateAppointmentDto
        {
            BarberId = dto.BarberId,
            ServiceId = dto.ServiceId,
            CustomerName = customer.Name,
            CustomerPhone = customer.Phone,
            AppointmentDate = dto.AppointmentDate
        };

        var appointment = await _appointmentService.CreateAppointmentAsync(createDto);
        if (appointment is null)
            return BadRequest(new { message = "No se pudo agendar. Verifica disponibilidad o que la fecha sea futura." });

        appointment.CustomerId = customerId;

        var tenant = await _context.Tenants.FindAsync(subdomain);
        if (tenant is not null && tenant.LoyaltyEnabled)
        {
            customer.LoyaltyCount += 1;
            if (customer.LoyaltyCount >= tenant.LoyaltyThreshold)
            {
                appointment.IsFree = true;
                customer.LoyaltyCount = 0;
            }
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            appointment,
            loyaltyCount = customer.LoyaltyCount,
            isFree = appointment.IsFree
        });
    }
}
```

- [ ] **Step 2: Verificar compilación**

```bash
cd c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi
dotnet build
```
Esperado: `0 Errores`

- [ ] **Step 3: Commit**

```bash
cd c:\Users\Admin\BarberBookSaaS
git add BarberBookSaaS.WebApi/Controllers/PublicBookingController.cs
git commit -m "feat: add PublicBookingController with anonymous barbers/services/availability and customer booking with loyalty"
```

---

### Task 9: Registrar todos los nuevos servicios en Program.cs

**Files:**
- Modify: `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi\Program.cs`

- [ ] **Step 1: Leer `Program.cs` para conocer el estado actual de los AddScoped**

Leer el archivo para encontrar la sección de registro de servicios. Debería incluir al menos:
- `AddScoped<ITenantService, TenantService>()`
- `AddScoped<ITokenService, TokenService>()`
- `AddScoped<IAuthService, AuthService>()`
- `AddScoped<IAppointmentService, AppointmentService>()`
- `AddScoped<IBrandingService, BrandingService>()`
- (Plan A debería haber agregado `IBarberService`, `IServiceService`, `IDashboardService`)

- [ ] **Step 2: Agregar los servicios nuevos que falten**

Localizar la sección de registro de servicios y asegurarse de que incluye estos tres servicios de Plan B (más el `IDashboardService` si no se agregó en Task 5 de este plan):

```csharp
builder.Services.AddScoped<ICustomerAuthService, CustomerAuthService>();
builder.Services.AddScoped<ILoyaltyService, LoyaltyService>();
```

Si `IDashboardService` no fue registrado aún (puede haber quedado pendiente de Task 5 de este plan):
```csharp
builder.Services.AddScoped<IDashboardService, DashboardService>();
```

- [ ] **Step 3: Verificar compilación final**

```bash
cd c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.WebApi
dotnet build
```
Esperado: `0 Errores`

- [ ] **Step 4: Commit**

```bash
cd c:\Users\Admin\BarberBookSaaS
git add BarberBookSaaS.WebApi/Program.cs
git commit -m "feat: register ICustomerAuthService and ILoyaltyService in DI container"
```

---

### Task 10: Migración AgregarClientesYFidelizacion + verificación final Plan B

**Files:**
- `c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Infrastructure\Persistence\Migrations\` (generado automáticamente)

- [ ] **Step 1: Crear la migración**

```bash
cd c:\Users\Admin\BarberBookSaaS\BarberBookSaaS.Infrastructure
dotnet ef migrations add AgregarClientesYFidelizacion --startup-project ../BarberBookSaaS.WebApi
```

Esperado: `Done. To undo this action, use 'ef migrations remove'`

Verificar que la migración generada incluye:
- Tabla `Customers` (Id, TenantId, Name, Phone, PasswordHash, LoyaltyCount, CreatedAt, RefreshToken, RefreshTokenExpiresAt)
- Índice único en `(TenantId, Phone)` de la tabla `Customers`
- Columnas `IsFree` y `CustomerId` en `Appointments`
- Columnas `LoyaltyEnabled` y `LoyaltyThreshold` en `Tenants`

- [ ] **Step 2: Aplicar la migración**

```bash
dotnet ef database update --startup-project ../BarberBookSaaS.WebApi
```

Esperado: `Done.`

- [ ] **Step 3: Build final de Plan B**

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
1. `POST /api/public/{subdomain}/auth/register` con `{ "name": "Juan", "phone": "3001234567", "password": "miClave123" }` → devuelve `token`, `refreshToken`, `customerId`, `loyaltyCount: 0`
2. `POST /api/public/{subdomain}/auth/login` → devuelve los mismos campos
3. `GET /api/public/{subdomain}/barbers` → lista de barberos activos sin necesidad de JWT
4. `GET /api/public/{subdomain}/services` → lista de servicios activos
5. `GET /api/dashboard/stats` (con Admin JWT) → devuelve `todayAppointments`, `todayRevenue`, `pendingAppointments`, `totalActiveBarbers`, `busiestBarber`
6. `GET /api/tenant/loyalty` (con Admin JWT) → devuelve `{ "enabled": false, "threshold": 10 }`
7. `PUT /api/tenant/loyalty` (con Admin JWT) con `{ "enabled": true, "threshold": 5 }` → 204 No Content
8. `GET /api/customer/me` (con Customer JWT) → devuelve nombre, teléfono, loyaltyCount, loyaltyThreshold, loyaltyEnabled

- [ ] **Step 5: Commit final Plan B**

```bash
cd c:\Users\Admin\BarberBookSaaS
git add BarberBookSaaS.Infrastructure/Persistence/Migrations/
git commit -m "feat: migration AgregarClientesYFidelizacion — Plan B completo"
git push origin main
```

---

## Resumen Plan B

Al completar Plan B, el backend tendrá:

| Feature | Endpoints | Estado |
|---------|-----------|--------|
| Customer entity con auth por teléfono | `POST /api/public/{sub}/auth/register`, `/auth/login`, `/auth/refresh` | ✅ |
| Endpoints públicos anónimos | `GET /api/public/{sub}/barbers`, `/services`, `/availability` | ✅ |
| Agendamiento público con loyalty | `POST /api/public/{sub}/appointments` (Customer JWT) | ✅ |
| Sistema de fidelización opcional | `GET/PUT /api/tenant/loyalty` (Admin JWT) | ✅ |
| Perfil de cliente | `GET /api/customer/me` (Customer JWT) | ✅ |
| Dashboard de métricas reales | `GET /api/dashboard/stats` (Admin/Barbero JWT) | ✅ |
| Migración aplicada | `AgregarClientesYFidelizacion` | ✅ |

**Siguiente: ejecutar Plan A y Plan B en orden. Luego: Fase 5B (frontend — ThemeContext, BrandingPage, CSS Variables).**