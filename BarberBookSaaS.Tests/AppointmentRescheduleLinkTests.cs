using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using BarberBookSaaS.Infrastructure.Services;
using BarberBookSaaS.Tests.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
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
                ["Jwt:Key"] = "TestSecretKeyForUnitTests_AtLeast32Chars!"
            })
            .Build(), NullLogger<AppointmentTokenService>.Instance);

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
        _validToken          = ts.GenerateToken(_pendingId,        pendingAppt.AppointmentDate);
        _cancelledToken      = ts.GenerateToken(_cancelledId,      cancelledAppt.AppointmentDate);
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
        var updated = await db.Appointments.IgnoreQueryFilters().FirstOrDefaultAsync(a => a.Id == _pendingId);
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
