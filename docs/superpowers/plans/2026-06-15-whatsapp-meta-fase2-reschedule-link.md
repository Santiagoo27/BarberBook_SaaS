# WhatsApp Meta Fase 2 — `/r/:token` Reschedule Link — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consume the HMAC reschedule token from Fase 1 WhatsApp buttons via a public `/r/:token` page where customers can rebook without logging in.

**Architecture:** Token identifies the appointment; `AppointmentRescheduleLinkController` resolves tenant via `IgnoreQueryFilters()`, returns branding in the GET response, and delegates rescheduling to a new shared `IAppointmentService.RescheduleAppointmentAsync`. The same service method is used by the existing authenticated "Mis citas" flow after refactoring `PublicBookingController.RescheduleAppointment`. Frontend extracts `RescheduleForm` (shared between `RescheduleModal` and new `ReschedulePage`), mounts `ReschedulePage` at `/r/:token`.

**Tech Stack:** .NET 10 / ASP.NET Core / EF Core / SQLite · xUnit · React 18 / Vite / TypeScript / Tailwind

---

## File Map

**Create:**
- `BarberBookSaaS.Application/DTOs/Appointments/RescheduleResult.cs`
- `BarberBookSaaS.Application/DTOs/Appointments/TokenAppointmentDto.cs`
- `BarberBookSaaS.WebApi/Controllers/AppointmentRescheduleLinkController.cs`
- `BarberBookSaaS.Tests/AppointmentRescheduleLinkTests.cs`
- `BarberBookSaaS.Web/src/features/booking/RescheduleForm.tsx`
- `BarberBookSaaS.Web/src/features/booking/ReschedulePage.tsx`

**Modify:**
- `BarberBookSaaS.Application/Common/IAppointmentService.cs`
- `BarberBookSaaS.Infrastructure/Services/AppointmentService.cs`
- `BarberBookSaaS.WebApi/Controllers/PublicBookingController.cs`
- `BarberBookSaaS.Web/src/features/booking/RescheduleModal.tsx`
- `BarberBookSaaS.Web/src/features/booking/bookingTypes.ts`
- `BarberBookSaaS.Web/src/features/booking/bookingService.ts`
- `BarberBookSaaS.Web/src/App.tsx`
- `CLAUDE.md` / `docs/HISTORIAL.md` / `docs/API_REFERENCE.md` / `docs/DECISIONES_DISENO.md`

---

## Task 1: Create DTOs

**Files:**
- Create: `BarberBookSaaS.Application/DTOs/Appointments/RescheduleResult.cs`
- Create: `BarberBookSaaS.Application/DTOs/Appointments/TokenAppointmentDto.cs`

- [ ] **Step 1.1: Create `RescheduleResult.cs`**

```csharp
using BarberBookSaaS.Domain.Entities;

namespace BarberBookSaaS.Application.DTOs.Appointments;

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

Error codes used by `RescheduleAppointmentAsync`: `NOT_FOUND`, `NOT_PENDING`, `TOO_LATE`, `NOT_LATER`, `SCHEDULE_CONFLICT`.

- [ ] **Step 1.2: Create `TokenAppointmentDto.cs`**

```csharp
namespace BarberBookSaaS.Application.DTOs.Appointments;

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

- [ ] **Step 1.3: Build**

```
cd BarberBookSaaS.WebApi && dotnet build
```

Expected: 0 errors.

- [ ] **Step 1.4: Commit**

```
git add BarberBookSaaS.Application/DTOs/Appointments/RescheduleResult.cs BarberBookSaaS.Application/DTOs/Appointments/TokenAppointmentDto.cs
git commit -m "feat: agrega RescheduleResult y TokenAppointmentDto para Fase 2 WhatsApp"
```

---

## Task 2: Add `RescheduleAppointmentAsync` to `IAppointmentService` + implement

**Files:**
- Modify: `BarberBookSaaS.Application/Common/IAppointmentService.cs`
- Modify: `BarberBookSaaS.Infrastructure/Services/AppointmentService.cs`

- [ ] **Step 2.1: Add method signature to `IAppointmentService`**

Add after the existing `GetAvailabilityAsync` declaration:

```csharp
Task<RescheduleResult> RescheduleAppointmentAsync(Guid appointmentId, DateTime newAppointmentDate);
```

Full updated file (`BarberBookSaaS.Application/Common/IAppointmentService.cs`):

```csharp
using BarberBookSaaS.Application.DTOs;
using BarberBookSaaS.Application.DTOs.Appointments;
using BarberBookSaaS.Domain.Entities;

namespace BarberBookSaaS.Application.Common;

public interface IAppointmentService
{
    Task<BookingResult> CreateAppointmentAsync(CreateAppointmentDto request);
    Task<PagedResult<Appointment>> GetAllAsync(int page, int pageSize, string? status, DateTime? from, DateTime? to, Guid? filterByUserId = null);
    Task<Appointment?> UpdateStatusAsync(Guid id, string status, string? cancelledBy = null);
    Task<bool> DeleteAsync(Guid id);
    Task<IEnumerable<AvailabilitySlotDto>> GetAvailabilityAsync(Guid barberId, Guid serviceId, DateOnly date, int minimumLeadHours = 0, Guid? excludeAppointmentId = null);
    Task<RescheduleResult> RescheduleAppointmentAsync(Guid appointmentId, DateTime newAppointmentDate);
}
```

- [ ] **Step 2.2: Implement `RescheduleAppointmentAsync` in `AppointmentService`**

Add this method at the end of the `AppointmentService` class (before the closing `}`), in `BarberBookSaaS.Infrastructure/Services/AppointmentService.cs`:

```csharp
public async Task<RescheduleResult> RescheduleAppointmentAsync(Guid appointmentId, DateTime newAppointmentDate)
{
    var appointment = await _context.Appointments
        .Include(a => a.Barber)
        .FirstOrDefaultAsync(a => a.Id == appointmentId);

    if (appointment is null)
        return RescheduleResult.Fail("NOT_FOUND", "Cita no encontrada.");

    if (appointment.Status != AppointmentStatus.Pending)
        return RescheduleResult.Fail("NOT_PENDING", "Solo se pueden reprogramar citas en estado Pendiente.");

    if ((appointment.AppointmentDate - DateTime.UtcNow).TotalMinutes <= 60)
        return RescheduleResult.Fail("TOO_LATE", "No es posible reprogramar con menos de 1 hora de antelación.");

    if (newAppointmentDate <= appointment.AppointmentDate)
        return RescheduleResult.Fail("NOT_LATER", "La nueva fecha debe ser posterior a la cita actual.");

    var slots = await GetAvailabilityAsync(
        appointment.BarberId, appointment.ServiceId,
        DateOnly.FromDateTime(newAppointmentDate),
        minimumLeadHours: 3,
        excludeAppointmentId: appointmentId);

    var requestedTime = newAppointmentDate.ToString("HH:mm");
    var slot = slots.FirstOrDefault(s => s.Time == requestedTime);
    if (slot is null || !slot.Available)
        return RescheduleResult.Fail("SCHEDULE_CONFLICT", "El horario seleccionado no está disponible.");

    appointment.AppointmentDate = newAppointmentDate;
    appointment.ReminderSentAt = null;
    await _context.SaveChangesAsync();

    var tenant = await _context.Tenants.FindAsync(appointment.TenantId);
    if (tenant is { WhatsAppEnabled: true } && !string.IsNullOrWhiteSpace(appointment.CustomerPhone))
    {
        await _whatsAppService.SendRescheduleAsync(
            appointmentId: appointment.Id,
            toPhone: appointment.CustomerPhone!,
            customerName: appointment.CustomerName,
            tenantName: tenant.Name,
            newAppointmentDate: appointment.AppointmentDate,
            barberName: appointment.Barber?.Name ?? "tu barbero",
            metaPhoneNumberId: tenant.MetaPhoneNumberId
        );
    }

    return RescheduleResult.Ok(appointment);
}
```

You also need to add the `using` for the new DTO at the top of the file — add `using BarberBookSaaS.Application.DTOs.Appointments;` if not already present.

- [ ] **Step 2.3: Build and run all tests**

```
cd BarberBookSaaS.WebApi && dotnet build
cd .. && dotnet test BarberBookSaaS.Tests
```

Expected: 0 build errors, 34 tests pass.

- [ ] **Step 2.4: Commit**

```
git add BarberBookSaaS.Application/Common/IAppointmentService.cs BarberBookSaaS.Infrastructure/Services/AppointmentService.cs
git commit -m "feat: extrae RescheduleAppointmentAsync a IAppointmentService + AppointmentService"
```

---

## Task 3: Regression test + refactor `PublicBookingController.RescheduleAppointment`

**Files:**
- Create: `BarberBookSaaS.Tests/AppointmentRescheduleLinkTests.cs` (first test class only)
- Modify: `BarberBookSaaS.WebApi/Controllers/PublicBookingController.cs`

- [ ] **Step 3.1: Create test file with `PublicRescheduleRegressionTests` class**

Create `BarberBookSaaS.Tests/AppointmentRescheduleLinkTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using BarberBookSaaS.Infrastructure.Services;
using BarberBookSaaS.Tests.Helpers;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BarberBookSaaS.Tests;

/// <summary>
/// Verifies that PublicBookingController.RescheduleAppointment still works correctly
/// after delegating to AppointmentService.RescheduleAppointmentAsync.
/// </summary>
public class PublicRescheduleRegressionTests : IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory = new();
    private HttpClient _client = null!;
    private const string TenantId = "reschedule-r1";
    private static readonly Guid CustomerId  = Guid.Parse("eeee1000-0000-0000-0000-000000000001");
    private static readonly Guid BarberId    = Guid.Parse("ffff1000-0000-0000-0000-000000000001");
    private static readonly Guid ServiceId   = Guid.Parse("aaaa2000-0000-0000-0000-000000000001");

    private Guid _appointmentId;
    private DateTime _newAppointmentDate;

    public async Task InitializeAsync()
    {
        await _factory.InitializeDbAsync();
        _client = _factory.CreateClient();
        _client.SetAuth(TestAuthHelper.CustomerToken(TenantId, CustomerId.ToString()), TenantId);
        await SeedAsync();
    }

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private async Task SeedAsync()
    {
        // Appointment at day+3 09:00; new target at day+4 10:00
        var appointmentDate  = DateTime.UtcNow.AddDays(3).Date.AddHours(9);
        _newAppointmentDate  = DateTime.UtcNow.AddDays(4).Date.AddHours(10);
        var newDateDayOfWeek = (int)DateOnly.FromDateTime(_newAppointmentDate).DayOfWeek;

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        db.Tenants.Add(new Tenant { Id = TenantId, Name = "Regresión Test", Subdomain = TenantId });
        db.Barbers.Add(new Barber { Id = BarberId, TenantId = TenantId, Name = "Barbero Reg" });
        db.Services.Add(new Service
        {
            Id = ServiceId, TenantId = TenantId, Name = "Corte",
            Price = 20, DurationMinutes = 30, IsActive = true
        });
        db.BarberSchedules.Add(new BarberSchedule
        {
            Id = Guid.NewGuid(), TenantId = TenantId, BarberId = BarberId,
            DayOfWeek = newDateDayOfWeek, StartHour = 8, StartMinute = 0, EndHour = 18, EndMinute = 0
        });
        db.Customers.Add(new Customer
        {
            Id = CustomerId, TenantId = TenantId,
            Name = "Cliente Reg", Phone = "3001234567",
            PasswordHash = "hash", LoyaltyCount = 0
        });
        var appointment = new Appointment
        {
            Id = Guid.NewGuid(), TenantId = TenantId, BarberId = BarberId, ServiceId = ServiceId,
            CustomerName = "Cliente Reg", CustomerPhone = "3001234567",
            AppointmentDate = appointmentDate,
            Status = AppointmentStatus.Pending, CustomerId = CustomerId
        };
        db.Appointments.Add(appointment);
        _appointmentId = appointment.Id;
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task RescheduleAppointment_HappyPath_Returns200()
    {
        var response = await _client.PutAsJsonAsync(
            $"/api/public/{TenantId}/appointments/{_appointmentId}/reschedule",
            new { newAppointmentDate = _newAppointmentDate });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(_appointmentId.ToString(), body.GetProperty("appointmentId").GetString());
        Assert.Equal("Pendiente", body.GetProperty("status").GetString());
        Assert.Equal("Cita reprogramada correctamente.", body.GetProperty("message").GetString());
    }
}
```

- [ ] **Step 3.2: Run regression test — verify it PASSES before refactoring**

```
dotnet test BarberBookSaaS.Tests --filter "PublicRescheduleRegressionTests"
```

Expected: 1 PASS. (The current controller works correctly; this establishes the baseline.)

- [ ] **Step 3.3: Refactor `PublicBookingController.RescheduleAppointment`**

Replace the entire `RescheduleAppointment` method in `PublicBookingController.cs` (lines 293–362) with:

```csharp
[HttpPut("appointments/{id:guid}/reschedule")]
[Authorize(Roles = UserRoles.Customer)]
public async Task<IActionResult> RescheduleAppointment(string subdomain, Guid id, [FromBody] RescheduleAppointmentDto dto)
{
    if (!ModelState.IsValid) return BadRequest(ModelState);

    var jwtTenantId = User.FindFirstValue("TenantId");
    if (jwtTenantId != subdomain)
        return Forbid();

    var customerIdClaim = User.FindFirstValue("UserId");
    if (!Guid.TryParse(customerIdClaim, out var customerId))
        return Unauthorized();

    var appointment = await _context.Appointments
        .IgnoreQueryFilters()
        .FirstOrDefaultAsync(a => a.Id == id && a.TenantId == subdomain);

    if (appointment is null)
        return NotFound(new { message = "Cita no encontrada." });

    if (appointment.CustomerId != customerId)
        return Forbid();

    _tenantService.TenantId = subdomain;
    var result = await _appointmentService.RescheduleAppointmentAsync(id, dto.NewAppointmentDate);

    if (!result.Success)
    {
        return result.ErrorCode switch
        {
            "NOT_FOUND" => NotFound(new { message = result.ErrorMessage }),
            "SCHEDULE_CONFLICT" => StatusCode(StatusCodes.Status409Conflict,
                new { errorCode = result.ErrorCode, message = result.ErrorMessage }),
            _ => BadRequest(new { errorCode = result.ErrorCode, message = result.ErrorMessage }),
        };
    }

    return Ok(new
    {
        appointmentId = result.Appointment!.Id,
        appointmentDate = result.Appointment.AppointmentDate,
        status = result.Appointment.Status,
        message = "Cita reprogramada correctamente."
    });
}
```

Note: The controller no longer needs `using BarberBookSaaS.Application.DTOs.Appointments` for `RescheduleAppointmentDto`  — that using is already present. It also no longer uses `_whatsAppService` directly in this method (the service handles it). Keep all existing `using` declarations in the file, but you can add `using BarberBookSaaS.Application.DTOs.Appointments;` if the `RescheduleResult` type is needed — it is NOT needed in the controller since we use `result.ErrorCode` (string). All existing usings are sufficient.

- [ ] **Step 3.4: Run all tests — verify regression test still PASSES**

```
dotnet test BarberBookSaaS.Tests
```

Expected: 35 tests pass (34 original + 1 new regression test).

- [ ] **Step 3.5: Commit**

```
git add BarberBookSaaS.Tests/AppointmentRescheduleLinkTests.cs BarberBookSaaS.WebApi/Controllers/PublicBookingController.cs
git commit -m "refactor: PublicBookingController.RescheduleAppointment delega a RescheduleAppointmentAsync"
```

---

## Task 4: Write failing integration tests for `AppointmentRescheduleLinkController`

**Files:**
- Modify: `BarberBookSaaS.Tests/AppointmentRescheduleLinkTests.cs` (add second test class)

- [ ] **Step 4.1: Append `AppointmentRescheduleLinkTests` class to the test file**

Open `BarberBookSaaS.Tests/AppointmentRescheduleLinkTests.cs` and append this class after the closing `}` of `PublicRescheduleRegressionTests`:

```csharp
/// <summary>
/// Integration tests for GET and PUT /api/public/reschedule/{token}.
/// Token generation uses the same Jwt:Key as appsettings.json so the controller accepts them.
/// </summary>
public class AppointmentRescheduleLinkTests : IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory = new();
    private HttpClient _client = null!;
    private const string TenantId = "link-t1";
    private static readonly Guid BarberId  = Guid.Parse("cccc1000-0000-0000-0000-000000000001");
    private static readonly Guid ServiceId = Guid.Parse("dddd1000-0000-0000-0000-000000000001");

    // Appointment A: Pending — used for GET canReschedule=true + PUT success
    private Guid _pendingId;
    private string _validToken = null!;

    // Appointment B: Cancelled — used for GET canReschedule=false
    private Guid _cancelledId;
    private string _cancelledToken = null!;

    // Appointment C: Pending — used for PUT conflict test (different from A)
    private Guid _conflictSourceId;
    private string _conflictSourceToken = null!;

    // Target dates for PUT tests — both on day+4 to use the same BarberSchedule entry
    private DateTime _putSuccessDate;   // day+4 at 10:00 — no conflict
    private DateTime _putConflictDate;  // day+4 at 11:00 — blocked by Appointment D

    public async Task InitializeAsync()
    {
        await _factory.InitializeDbAsync();
        _client = _factory.CreateClient();
        await SeedAsync();
    }

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private static AppointmentTokenService CreateTokenService() =>
        new(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "YOUR_JWT_KEY_HERE"
            })
            .Build());

    private async Task SeedAsync()
    {
        _putSuccessDate  = DateTime.UtcNow.AddDays(4).Date.AddHours(10);
        _putConflictDate = DateTime.UtcNow.AddDays(4).Date.AddHours(11);
        var scheduleDayOfWeek = (int)DateOnly.FromDateTime(_putSuccessDate).DayOfWeek;

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        db.Tenants.Add(new Tenant { Id = TenantId, Name = "Link Test", Subdomain = TenantId });
        db.Barbers.Add(new Barber { Id = BarberId, TenantId = TenantId, Name = "Barbero Link" });
        db.Services.Add(new Service
        {
            Id = ServiceId, TenantId = TenantId, Name = "Corte",
            Price = 20, DurationMinutes = 30, IsActive = true
        });

        // Schedule for the day of the PUT target dates
        db.BarberSchedules.Add(new BarberSchedule
        {
            Id = Guid.NewGuid(), TenantId = TenantId, BarberId = BarberId,
            DayOfWeek = scheduleDayOfWeek, StartHour = 8, StartMinute = 0, EndHour = 18, EndMinute = 0
        });

        // Appointment D: blocks the 11:00 slot on day+4 (for conflict test)
        db.Appointments.Add(new Appointment
        {
            Id = Guid.NewGuid(), TenantId = TenantId, BarberId = BarberId, ServiceId = ServiceId,
            CustomerName = "Bloqueador",
            AppointmentDate = _putConflictDate,
            Status = AppointmentStatus.Pending
        });

        // Appointment A: Pending at day+3 09:00
        var pendingAppt = new Appointment
        {
            Id = Guid.NewGuid(), TenantId = TenantId, BarberId = BarberId, ServiceId = ServiceId,
            CustomerName = "Cliente Link",
            AppointmentDate = DateTime.UtcNow.AddDays(3).Date.AddHours(9),
            Status = AppointmentStatus.Pending
        };
        db.Appointments.Add(pendingAppt);
        _pendingId = pendingAppt.Id;

        // Appointment B: Cancelled at day+5 09:00
        var cancelledAppt = new Appointment
        {
            Id = Guid.NewGuid(), TenantId = TenantId, BarberId = BarberId, ServiceId = ServiceId,
            CustomerName = "Cliente Cancelado",
            AppointmentDate = DateTime.UtcNow.AddDays(5).Date.AddHours(9),
            Status = AppointmentStatus.Cancelled
        };
        db.Appointments.Add(cancelledAppt);
        _cancelledId = cancelledAppt.Id;

        // Appointment C: Pending at day+3 08:00 (for PUT conflict test)
        var conflictSourceAppt = new Appointment
        {
            Id = Guid.NewGuid(), TenantId = TenantId, BarberId = BarberId, ServiceId = ServiceId,
            CustomerName = "Cliente Conflicto",
            AppointmentDate = DateTime.UtcNow.AddDays(3).Date.AddHours(8),
            Status = AppointmentStatus.Pending
        };
        db.Appointments.Add(conflictSourceAppt);
        _conflictSourceId = conflictSourceAppt.Id;

        await db.SaveChangesAsync();

        var ts = CreateTokenService();
        _validToken        = ts.GenerateToken(_pendingId,        pendingAppt.AppointmentDate);
        _cancelledToken    = ts.GenerateToken(_cancelledId,      cancelledAppt.AppointmentDate);
        _conflictSourceToken = ts.GenerateToken(_conflictSourceId, conflictSourceAppt.AppointmentDate);
    }

    // ---- GET tests ----

    [Fact]
    public async Task Get_ValidToken_PendingFuture_Returns200WithCanRescheduleTrue()
    {
        var response = await _client.GetAsync($"/api/public/reschedule/{_validToken}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(_pendingId.ToString(), body.GetProperty("appointmentId").GetString());
        Assert.Equal(TenantId, body.GetProperty("subdomain").GetString());
        Assert.True(body.GetProperty("canReschedule").GetBoolean());
    }

    [Fact]
    public async Task Get_ValidToken_CancelledAppointment_Returns200WithCanRescheduleFalse()
    {
        var response = await _client.GetAsync($"/api/public/reschedule/{_cancelledToken}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(_cancelledId.ToString(), body.GetProperty("appointmentId").GetString());
        Assert.False(body.GetProperty("canReschedule").GetBoolean());
    }

    [Fact]
    public async Task Get_InvalidToken_Returns404()
    {
        var response = await _client.GetAsync("/api/public/reschedule/invalid.token");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ---- PUT tests ----

    [Fact]
    public async Task Put_ValidToken_AvailableSlot_Returns200AndUpdatesDate()
    {
        var response = await _client.PutAsJsonAsync(
            $"/api/public/reschedule/{_validToken}",
            new { newAppointmentDate = _putSuccessDate });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(_pendingId.ToString(), body.GetProperty("appointmentId").GetString());
        Assert.Equal("Cita reprogramada correctamente.", body.GetProperty("message").GetString());

        // Verify the appointment was actually updated in the DB
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var updated = await db.Appointments.FindAsync(_pendingId);
        Assert.NotNull(updated);
        Assert.Null(updated!.ReminderSentAt);
    }

    [Fact]
    public async Task Put_ValidToken_ConflictingSlot_Returns409()
    {
        var response = await _client.PutAsJsonAsync(
            $"/api/public/reschedule/{_conflictSourceToken}",
            new { newAppointmentDate = _putConflictDate });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("SCHEDULE_CONFLICT", body.GetProperty("errorCode").GetString());
    }

    [Fact]
    public async Task Put_InvalidToken_Returns404()
    {
        var response = await _client.PutAsJsonAsync(
            "/api/public/reschedule/bad.token",
            new { newAppointmentDate = DateTime.UtcNow.AddDays(4) });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
```

- [ ] **Step 4.2: Run new tests — verify they ALL FAIL**

```
dotnet test BarberBookSaaS.Tests --filter "AppointmentRescheduleLinkTests"
```

Expected: 6 FAIL (the controller doesn't exist yet). Do NOT commit.

---

## Task 5: Create `AppointmentRescheduleLinkController`

**Files:**
- Create: `BarberBookSaaS.WebApi/Controllers/AppointmentRescheduleLinkController.cs`

- [ ] **Step 5.1: Create the controller**

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Appointments;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Infrastructure.Persistence;

namespace BarberBookSaaS.WebApi.Controllers;

[ApiController]
[Route("api/public/reschedule")]
public class AppointmentRescheduleLinkController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IAppointmentTokenService _tokenService;
    private readonly IAppointmentService _appointmentService;
    private readonly ITenantService _tenantService;

    public AppointmentRescheduleLinkController(
        ApplicationDbContext context,
        IAppointmentTokenService tokenService,
        IAppointmentService appointmentService,
        ITenantService tenantService)
    {
        _context = context;
        _tokenService = tokenService;
        _appointmentService = appointmentService;
        _tenantService = tenantService;
    }

    [HttpGet("{token}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetAppointment(string token)
    {
        var appointmentId = _tokenService.ValidateToken(token);
        if (appointmentId is null)
            return NotFound(new { message = "Este enlace no es válido o ha expirado." });

        var appointment = await _context.Appointments
            .IgnoreQueryFilters()
            .Include(a => a.Barber)
            .Include(a => a.Service)
            .FirstOrDefaultAsync(a => a.Id == appointmentId.Value);

        if (appointment is null)
            return NotFound(new { message = "Este enlace no es válido o ha expirado." });

        var tenant = await _context.Tenants.FindAsync(appointment.TenantId);
        if (tenant is null)
            return NotFound(new { message = "Este enlace no es válido o ha expirado." });

        var canReschedule = appointment.Status == AppointmentStatus.Pending
            && (appointment.AppointmentDate - DateTime.UtcNow) > TimeSpan.FromHours(1);

        return Ok(new TokenAppointmentDto
        {
            Subdomain      = appointment.TenantId,
            TenantName     = tenant.Name,
            Theme          = tenant.Theme,
            PrimaryColor   = tenant.PrimaryColor,
            SecondaryColor = tenant.SecondaryColor,
            LogoBase64     = tenant.LogoBase64,
            AppointmentId  = appointment.Id,
            BarberId       = appointment.BarberId,
            ServiceId      = appointment.ServiceId,
            BarberName     = appointment.Barber?.Name ?? string.Empty,
            ServiceName    = appointment.Service?.Name ?? string.Empty,
            AppointmentDate = appointment.AppointmentDate,
            Status         = appointment.Status,
            CanReschedule  = canReschedule
        });
    }

    [HttpPut("{token}")]
    [AllowAnonymous]
    public async Task<IActionResult> RescheduleAppointment(string token, [FromBody] RescheduleAppointmentDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var appointmentId = _tokenService.ValidateToken(token);
        if (appointmentId is null)
            return NotFound(new { message = "Este enlace no es válido o ha expirado." });

        var appointment = await _context.Appointments
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(a => a.Id == appointmentId.Value);

        if (appointment is null)
            return NotFound(new { message = "Este enlace no es válido o ha expirado." });

        // Set tenant context so that AppointmentService QueryFilters and GetAvailabilityAsync work correctly
        _tenantService.TenantId = appointment.TenantId;

        var result = await _appointmentService.RescheduleAppointmentAsync(appointmentId.Value, dto.NewAppointmentDate);

        if (!result.Success)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => NotFound(new { message = result.ErrorMessage }),
                "SCHEDULE_CONFLICT" => StatusCode(StatusCodes.Status409Conflict,
                    new { errorCode = result.ErrorCode, message = result.ErrorMessage }),
                _ => BadRequest(new { errorCode = result.ErrorCode, message = result.ErrorMessage }),
            };
        }

        return Ok(new
        {
            appointmentId = result.Appointment!.Id,
            appointmentDate = result.Appointment.AppointmentDate,
            status = result.Appointment.Status,
            message = "Cita reprogramada correctamente."
        });
    }
}
```

`IAppointmentTokenService` is already registered as a singleton in `Program.cs` (line 59). No changes to `Program.cs` required.

- [ ] **Step 5.2: Build**

```
cd BarberBookSaaS.WebApi && dotnet build
```

Expected: 0 errors.

- [ ] **Step 5.3: Run all tests — verify 41 pass**

```
dotnet test BarberBookSaaS.Tests
```

Expected: 41 pass (35 from Tasks 1–3 + 6 new = 41).

- [ ] **Step 5.4: Commit**

```
git add BarberBookSaaS.Tests/AppointmentRescheduleLinkTests.cs BarberBookSaaS.WebApi/Controllers/AppointmentRescheduleLinkController.cs
git commit -m "feat: agrega AppointmentRescheduleLinkController (GET+PUT /api/public/reschedule/{token})"
```

---

## Task 6: Add `TokenAppointment` type to `bookingTypes.ts`

**Files:**
- Modify: `BarberBookSaaS.Web/src/features/booking/bookingTypes.ts`

- [ ] **Step 6.1: Add `TokenAppointment` interface**

Append to the end of `bookingTypes.ts` (after the existing `CustomerProfile` interface):

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
  appointmentDate: string; // ISO 8601
  status: string;
  canReschedule: boolean;
}
```

`RescheduleResult` already exists in this file and will be reused for the PUT token response. No duplicate needed.

- [ ] **Step 6.2: Build**

```
cd BarberBookSaaS.Web && npm run build
```

Expected: 0 TypeScript errors.

- [ ] **Step 6.3: Commit**

```
git add BarberBookSaaS.Web/src/features/booking/bookingTypes.ts
git commit -m "feat: agrega TokenAppointment type para /r/:token"
```

---

## Task 7: Add token-based service methods to `bookingService.ts`

**Files:**
- Modify: `BarberBookSaaS.Web/src/features/booking/bookingService.ts`

- [ ] **Step 7.1: Add `getAppointmentByToken` and `rescheduleAppointmentByToken`**

Add the `TokenAppointment` import to the import block at the top of `bookingService.ts`:

```typescript
import type {
  AvailabilitySlot,
  BookingConfirmation,
  CustomerAppointment,
  CustomerAuth,
  CustomerProfile,
  PublicBarber,
  PublicBranding,
  PublicService,
  RescheduleResult,
  TokenAppointment,      // ← add this
} from "./bookingTypes";
```

Then append two methods to the `bookingService` object (after `resetPasswordCustomer`):

```typescript
  getAppointmentByToken: async (token: string): Promise<TokenAppointment> => {
    const r = await publicApiClient.get<TokenAppointment>(`/api/public/reschedule/${token}`);
    return r.data;
  },

  rescheduleAppointmentByToken: async (
    token: string,
    newAppointmentDate: string
  ): Promise<RescheduleResult> => {
    const r = await publicApiClient.put<RescheduleResult>(
      `/api/public/reschedule/${token}`,
      { newAppointmentDate }
    );
    return r.data;
  },
```

- [ ] **Step 7.2: Build**

```
npm run build
```

Expected: 0 errors.

- [ ] **Step 7.3: Commit**

```
git add BarberBookSaaS.Web/src/features/booking/bookingService.ts
git commit -m "feat: agrega getAppointmentByToken y rescheduleAppointmentByToken a bookingService"
```

---

## Task 8: Extract `RescheduleForm` from `RescheduleModal`

**Files:**
- Create: `BarberBookSaaS.Web/src/features/booking/RescheduleForm.tsx`
- Modify: `BarberBookSaaS.Web/src/features/booking/RescheduleModal.tsx`

- [ ] **Step 8.1: Create `RescheduleForm.tsx`**

This component is presentational — no portal, no backdrop. It owns the date/slot selection UI and the confirm button. It calls `onSubmit(isoString)` which must reject with `new Error(message)` on failure. If `onCancel` is provided, a cancel button is rendered inline.

```tsx
import { useEffect, useState } from "react";
import { bookingService } from "./bookingService";
import type { AvailabilitySlot } from "./bookingTypes";

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const pad = (n: number) => String(n).padStart(2, "0");
const dateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export interface RescheduleFormProps {
  subdomain: string;
  barberId: string;
  serviceId: string;
  appointmentId: string;
  currentAppointmentDate: string; // ISO 8601
  primaryColor: string;
  /** Must reject with `new Error(userFacingMessage)` on failure */
  onSubmit: (newAppointmentDateIso: string) => Promise<void>;
  /** If provided, renders a "Cancelar" button alongside "Confirmar" */
  onCancel?: () => void;
}

export const RescheduleForm: React.FC<RescheduleFormProps> = ({
  subdomain, barberId, serviceId, appointmentId,
  currentAppointmentDate, primaryColor, onSubmit, onCancel,
}) => {
  const currentDate    = new Date(currentAppointmentDate);
  const minDateStr     = dateStr(currentDate);
  const currentTimeStr = timeStr(currentDate);

  const [selectedDate, setSelectedDate] = useState(minDateStr);
  const [slots, setSlots]               = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState("");

  useEffect(() => {
    let cancelled = false;
    setSlotsLoading(true);
    setSelectedSlot("");
    bookingService
      .getAvailability(subdomain, barberId, serviceId, selectedDate, appointmentId)
      .then((data) => {
        if (cancelled) return;
        const filtered = selectedDate === minDateStr
          ? data.filter((s) => s.time > currentTimeStr)
          : data;
        setSlots(filtered);
      })
      .catch(() => { if (!cancelled) setSlots([]); })
      .finally(() => { if (!cancelled) setSlotsLoading(false); });
    return () => { cancelled = true; };
  }, [subdomain, barberId, serviceId, appointmentId, selectedDate, minDateStr, currentTimeStr]);

  const handleConfirm = async () => {
    if (!selectedSlot) return;
    setSubmitting(true);
    setError("");
    try {
      await onSubmit(`${selectedDate}T${selectedSlot}:00`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo reprogramar la cita.");
    } finally {
      setSubmitting(false);
    }
  };

  const dayName = DAY_NAMES[new Date(`${selectedDate}T12:00:00`).getDay()];

  return (
    <>
      {error && (
        <div style={{
          marginBottom: "16px", borderRadius: "10px", padding: "12px",
          fontSize: "12px", lineHeight: 1.5,
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", color: "#f87171",
        }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-text-muted)", marginBottom: 8 }}>
          Nueva fecha
        </label>
        <input
          type="date"
          min={minDateStr}
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="input-theme"
          style={{ width: "100%", borderRadius: 8, padding: "10px 12px", fontSize: 14 }}
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-muted)", marginBottom: 12 }}>
          {slotsLoading ? "Cargando horarios…" : `Horarios disponibles — ${dayName}`}
        </p>
        {slotsLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              border: "2px solid var(--color-glass-border)",
              borderTopColor: primaryColor,
              animation: "booking-spin 0.8s linear infinite",
            }} />
            <style>{`@keyframes booking-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : slots.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", fontStyle: "italic" }}>
            No hay horarios disponibles para este día.
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {slots.map((slot) => {
              const isSelected = selectedSlot === slot.time;
              return (
                <button
                  key={slot.time}
                  disabled={!slot.available}
                  onClick={() => setSelectedSlot(slot.time)}
                  style={{
                    padding: "9px 4px", borderRadius: 8,
                    fontSize: 13, fontWeight: isSelected ? 600 : 500,
                    cursor: slot.available ? "pointer" : "not-allowed",
                    transition: "all 150ms ease",
                    background: isSelected ? primaryColor : "var(--color-surface)",
                    border: `1.5px solid ${isSelected ? primaryColor : "var(--color-border)"}`,
                    color: isSelected ? "#000" : slot.available ? "var(--color-text)" : "var(--color-text-muted)",
                    opacity: slot.available ? 1 : 0.3,
                  }}
                >
                  {slot.time}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: "12px" }}>
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={submitting}
            className="btn-ghost"
            style={{ flex: 1, padding: "10px 0", borderRadius: "10px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
          >
            Cancelar
          </button>
        )}
        <button
          onClick={handleConfirm}
          disabled={!selectedSlot || submitting}
          className="btn-primary"
          style={{
            flex: 1, padding: "10px 0", borderRadius: "10px",
            fontSize: "13px", fontWeight: 700, border: "none",
            cursor: !selectedSlot || submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Reprogramando…" : "Confirmar nuevo horario"}
        </button>
      </div>
    </>
  );
};
```

- [ ] **Step 8.2: Rewrite `RescheduleModal.tsx` to use `RescheduleForm`**

Replace the entire contents of `RescheduleModal.tsx`:

```tsx
import { createPortal } from "react-dom";
import { bookingService } from "./bookingService";
import { RescheduleForm } from "./RescheduleForm";
import type { CustomerAppointment } from "./bookingTypes";

const BACKDROP_SCROLL: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 9999,
  backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", overflowY: "auto",
};
const PANEL: React.CSSProperties = {
  background: "var(--color-glass-surface)",
  border: "1px solid var(--color-glass-border)",
  backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
  boxShadow: "0 40px 100px rgba(0,0,0,0.70)", borderRadius: "20px",
};

interface RescheduleModalProps {
  subdomain: string;
  appointment: CustomerAppointment;
  primaryColor: string;
  onClose: () => void;
  onRescheduled: () => void;
}

export const RescheduleModal: React.FC<RescheduleModalProps> = ({
  subdomain, appointment, primaryColor, onClose, onRescheduled,
}) => {
  return createPortal(
    <div style={BACKDROP_SCROLL}>
      <div style={{ display: "flex", minHeight: "100%", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
        <div className="fade-up" style={{ ...PANEL, width: "100%", maxWidth: "420px", padding: "28px" }}>
          <h3 style={{ color: "var(--color-text)", fontSize: "20px", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "4px" }}>
            Reprogramar cita
          </h3>
          <p style={{ color: "var(--color-text-muted)", fontSize: "12px", marginBottom: "20px" }}>
            {appointment.serviceName} con {appointment.barberName}
          </p>
          <RescheduleForm
            subdomain={subdomain}
            barberId={appointment.barberId}
            serviceId={appointment.serviceId}
            appointmentId={appointment.id}
            currentAppointmentDate={appointment.appointmentDate}
            primaryColor={primaryColor}
            onCancel={onClose}
            onSubmit={async (newDateIso) => {
              try {
                await bookingService.rescheduleAppointment(subdomain, appointment.id, newDateIso);
                onRescheduled();
                onClose();
              } catch (e: unknown) {
                const err = e as { response?: { data?: { message?: string } } };
                throw new Error(err?.response?.data?.message ?? "No se pudo reprogramar la cita.");
              }
            }}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};
```

- [ ] **Step 8.3: Build**

```
npm run build
```

Expected: 0 TypeScript errors. Behavior of `BookingPage` is unchanged — `RescheduleModal` still receives the same props and works identically.

- [ ] **Step 8.4: Commit**

```
git add BarberBookSaaS.Web/src/features/booking/RescheduleForm.tsx BarberBookSaaS.Web/src/features/booking/RescheduleModal.tsx
git commit -m "refactor: extrae RescheduleForm de RescheduleModal para reutilizar en ReschedulePage"
```

---

## Task 9: Create `ReschedulePage.tsx`

**Files:**
- Create: `BarberBookSaaS.Web/src/features/booking/ReschedulePage.tsx`

- [ ] **Step 9.1: Create `ReschedulePage.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { bookingService } from "./bookingService";
import { RescheduleForm } from "./RescheduleForm";
import type { TokenAppointment, RescheduleResult } from "./bookingTypes";

const pad = (n: number) => String(n).padStart(2, "0");

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day  = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"][d.getDay()];
  return `${day} ${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} a las ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusLabel(status: string): string {
  if (status === "Pendiente")  return "Pendiente";
  if (status === "Cancelada")  return "Cancelada";
  if (status === "Completada") return "Completada";
  return status;
}

function notReschedulableReason(data: TokenAppointment): string {
  if (data.status !== "Pendiente")
    return "Esta cita ya no puede reprogramarse porque está " + statusLabel(data.status).toLowerCase() + ".";
  return "No es posible reprogramar con menos de 1 hora de antelación.";
}

const CARD: React.CSSProperties = {
  width: "100%", maxWidth: "440px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: "20px",
  padding: "32px",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
};

export const ReschedulePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  const [pageState, setPageState] = useState<"loading" | "invalid" | "loaded" | "success">("loading");
  const [data, setData]               = useState<TokenAppointment | null>(null);
  const [successResult, setSuccessResult] = useState<RescheduleResult | null>(null);

  // Apply tenant branding CSS vars when data arrives
  useEffect(() => {
    if (data) {
      document.documentElement.style.setProperty("--color-primary", data.primaryColor);
      document.documentElement.style.setProperty("--color-secondary", data.secondaryColor);
    }
  }, [data]);

  useEffect(() => {
    if (!token) { setPageState("invalid"); return; }
    bookingService.getAppointmentByToken(token)
      .then((d) => { setData(d); setPageState("loaded"); })
      .catch(() => setPageState("invalid"));
  }, [token]);

  const primaryColor = data?.primaryColor ?? "#D4AF37";

  // ── Loading ──────────────────────────────────────────────────────────────
  if (pageState === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a" }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          border: "3px solid rgba(255,255,255,0.1)",
          borderTopColor: "#D4AF37",
          animation: "rp-spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes rp-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Invalid ───────────────────────────────────────────────────────────────
  if (pageState === "invalid") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0a0a0a", padding: "24px" }}>
        <div style={{ ...CARD, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
            Enlace no válido
          </h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
            Este enlace no es válido o ya ha expirado.<br />
            Puedes agendar una nueva cita desde la página de tu barbería.
          </p>
          <Link
            to="/"
            style={{
              display: "inline-block", padding: "10px 24px", borderRadius: 10,
              background: "#D4AF37", color: "#000", fontWeight: 700, fontSize: 14,
              textDecoration: "none",
            }}
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (pageState === "success" && successResult) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0a0a0a", padding: "24px" }}>
        <div style={{ ...CARD, textAlign: "center" }}>
          {data?.logoBase64 && (
            <img src={`data:image/png;base64,${data.logoBase64}`} alt="Logo" style={{ height: 48, objectFit: "contain", marginBottom: 16 }} />
          )}
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h1 style={{ color: primaryColor, fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
            ¡Cita reprogramada!
          </h1>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 15, lineHeight: 1.6 }}>
            Tu cita fue reprogramada para el<br />
            <strong style={{ color: "#fff" }}>{formatDate(successResult.appointmentDate)}</strong>
          </p>
        </div>
      </div>
    );
  }

  // ── Loaded ────────────────────────────────────────────────────────────────
  // `data` is guaranteed non-null at this point (pageState === "loaded")
  const d = data!;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0a0a0a", padding: "24px" }}>
      <div style={CARD}>
        {/* Header / branding */}
        {d.logoBase64 && (
          <img
            src={`data:image/png;base64,${d.logoBase64}`}
            alt={d.tenantName ?? "Logo"}
            style={{ height: 40, objectFit: "contain", marginBottom: 16 }}
          />
        )}
        {d.tenantName && (
          <p style={{ color: primaryColor, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>
            {d.tenantName}
          </p>
        )}

        <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>
          Reprogramar cita
        </h1>

        {/* Current appointment summary */}
        <div style={{
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12, padding: "14px 16px", marginTop: 16, marginBottom: 20,
        }}>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            Cita actual
          </p>
          <p style={{ color: "#fff", fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
            {d.serviceName} con {d.barberName}
          </p>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
            {formatDate(d.appointmentDate)}
          </p>
        </div>

        {/* Either form or explanation */}
        {d.canReschedule ? (
          <RescheduleForm
            subdomain={d.subdomain}
            barberId={d.barberId}
            serviceId={d.serviceId}
            appointmentId={d.appointmentId}
            currentAppointmentDate={d.appointmentDate}
            primaryColor={primaryColor}
            onSubmit={async (newDateIso) => {
              try {
                const result = await bookingService.rescheduleAppointmentByToken(token!, newDateIso);
                setSuccessResult(result);
                setPageState("success");
              } catch (e: unknown) {
                const err = e as { response?: { data?: { message?: string } } };
                throw new Error(err?.response?.data?.message ?? "No se pudo reprogramar la cita.");
              }
            }}
          />
        ) : (
          <p style={{
            color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.6,
            padding: "16px", borderRadius: 10,
            background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)",
          }}>
            {notReschedulableReason(d)}
          </p>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 9.2: Build**

```
npm run build
```

Expected: 0 errors.

- [ ] **Step 9.3: Commit**

```
git add BarberBookSaaS.Web/src/features/booking/ReschedulePage.tsx
git commit -m "feat: agrega ReschedulePage para /r/:token (reprogramacion anonima desde WhatsApp)"
```

---

## Task 10: Add `/r/:token` route to `App.tsx`

**Files:**
- Modify: `BarberBookSaaS.Web/src/App.tsx`

- [ ] **Step 10.1: Add import for `ReschedulePage`**

Add this import after the existing `ReviewPage` import line:

```typescript
import { ReschedulePage } from "./features/booking/ReschedulePage";
```

- [ ] **Step 10.2: Add route**

In the "Rutas públicas" block (alongside `/book/:subdomain` and `/review/:subdomain`), add:

```tsx
<Route path="/r/:token" element={<ReschedulePage />} />
```

The updated public routes block becomes:

```tsx
{/* Rutas públicas */}
<Route path="/login" element={<Login />} />
<Route path="/forgot-password" element={<ForgotPassword />} />
<Route path="/reset-password" element={<ResetPassword />} />
<Route path="/book/:subdomain/citas" element={<BookingPage />} />
<Route path="/book/:subdomain" element={<BookingPage />} />
<Route path="/review/:subdomain" element={<ReviewPage />} />
<Route path="/r/:token" element={<ReschedulePage />} />
```

- [ ] **Step 10.3: Build**

```
npm run build
```

Expected: 0 errors.

- [ ] **Step 10.4: Commit**

```
git add BarberBookSaaS.Web/src/App.tsx
git commit -m "feat: agrega ruta /r/:token para ReschedulePage"
```

---

## Task 11: Documentation updates

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/HISTORIAL.md`
- Modify: `docs/API_REFERENCE.md`
- Modify: `docs/DECISIONES_DISENO.md`

- [ ] **Step 11.1: Update `CLAUDE.md`**

In the **Roadmap — Pendiente** section, mark the Fase 2 item as complete (change `- [ ]` to `- [x]`):

```markdown
- [x] **WhatsApp Meta Fase 2 — consumo del botón "Reprogramar"** — ...
```

In the **Estado del Proyecto** paragraph, append `integración WhatsApp Business Cloud API (Meta) Fase 2 (ruta pública /r/:token, reprogramación anónima desde botón de WhatsApp, RescheduleForm compartido entre "Mis citas" y página token)`.

Update the **Tests** count from `34/34` to `41/41`.

- [ ] **Step 11.2: Update `docs/HISTORIAL.md`**

Add a new "Fase 29" (or the next available number) section documenting:
- `AppointmentRescheduleLinkController` with GET + PUT at `api/public/reschedule/{token}`
- `RescheduleAppointmentAsync` extracted to `IAppointmentService`
- `PublicBookingController.RescheduleAppointment` refactored to delegate
- `RescheduleForm` extracted from `RescheduleModal`
- `ReschedulePage` at `/r/:token`
- 7 new tests (41 total)

- [ ] **Step 11.3: Update `docs/API_REFERENCE.md`**

Add a section for the new endpoints:

```
GET  /api/public/reschedule/{token}   — Anónimo. Valida token, devuelve TokenAppointmentDto con branding + canReschedule
PUT  /api/public/reschedule/{token}   — Anónimo. Body: { newAppointmentDate }. Reprograma. 200 / 400 / 404 / 409
```

- [ ] **Step 11.4: Update `docs/DECISIONES_DISENO.md`**

Add a decision entry:
> **Autenticación por token (reschedule desde WhatsApp):** el token HMAC-SHA256 sirve como prueba de propiedad; no se requiere sesión de cliente. Token no contiene subdominio — backend resuelve tenant via `Appointment.TenantId` con `IgnoreQueryFilters()`. Errores de token son genéricos (sin branding) para evitar filtración de información de tenant.

- [ ] **Step 11.5: Commit**

```
git add CLAUDE.md docs/HISTORIAL.md docs/API_REFERENCE.md docs/DECISIONES_DISENO.md
git commit -m "docs: marca Fase 2 WhatsApp Meta como completada, actualiza API_REFERENCE y DECISIONES"
```

---

## Self-Review Checklist (completed inline)

- **Spec coverage:** All sections of the spec are covered. DTOs → Task 1. `RescheduleAppointmentAsync` → Task 2. Controller refactor → Task 3. New controller → Task 5 (tested in Task 4). `RescheduleForm` → Task 8. `ReschedulePage` → Task 9. Route → Task 10. Docs → Task 11.
- **Type consistency:** `RescheduleResult` from `bookingTypes.ts` is used by `rescheduleAppointmentByToken` and by `successResult` state in `ReschedulePage`. `TokenAppointment` from `bookingTypes.ts` matches `TokenAppointmentDto` camelCase serialization.
- **Error code `NOT_LATER`:** The original `PublicBookingController.RescheduleAppointment` already returned `errorCode = "NOT_LATER"`. The refactored version returns it via the `_ => BadRequest(...)` arm. ✓
- **No placeholders:** All steps contain complete code.
- **`IAppointmentTokenService` DI:** Already registered as singleton in `Program.cs:59`. No `Program.cs` changes needed.
- **Unique `(BarberId, DayOfWeek)` index:** Each test class uses its own isolated SQLite DB (one `TestWebApplicationFactory` per class). No cross-class conflicts.
