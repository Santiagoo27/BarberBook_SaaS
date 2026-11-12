using System.Net.Http.Json;
using BarberBookSaaS.Application.DTOs.Appointments;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using BarberBookSaaS.Tests.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BarberBookSaaS.Tests;

/// <summary>
/// A service whose duration isn't a multiple of the 30-minute slot grid (e.g. 35 min)
/// must block every slot it overlaps, not just the one it starts in.
/// </summary>
public class AppointmentAvailabilityDurationTests : IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory = new();
    private HttpClient _client = null!;
    private static readonly Guid BarberId  = Guid.Parse("dddddddd-0000-0000-0000-000000000001");
    private static readonly Guid ServiceId = Guid.Parse("eeeeeeee-0000-0000-0000-000000000001");
    private const string TenantId = "duration-t1";
    private DateTime _targetDate;

    public async Task InitializeAsync()
    {
        await _factory.InitializeDbAsync();
        _client = _factory.CreateClient();
        await SeedAsync();
    }

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private async Task SeedAsync()
    {
        _targetDate = DateTime.UtcNow.AddDays(4).Date;
        var dayOfWeek = (int)DateOnly.FromDateTime(_targetDate).DayOfWeek;

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        db.Tenants.Add(new Tenant { Id = TenantId, Name = "Duration Test", Subdomain = TenantId });
        db.Barbers.Add(new Barber { Id = BarberId, TenantId = TenantId, Name = "Barbero Duration" });
        db.Services.Add(new Service
        {
            Id = ServiceId, TenantId = TenantId, Name = "Corte 35min",
            Price = 20, DurationMinutes = 35, IsActive = true
        });
        db.BarberSchedules.Add(new BarberSchedule
        {
            Id = Guid.NewGuid(), TenantId = TenantId, BarberId = BarberId,
            DayOfWeek = dayOfWeek, StartHour = 8, StartMinute = 0, EndHour = 18, EndMinute = 0
        });

        // Booked at 3:30pm — occupies 15:30 to 16:05
        db.Appointments.Add(new Appointment
        {
            Id = Guid.NewGuid(), TenantId = TenantId, BarberId = BarberId, ServiceId = ServiceId,
            CustomerName = "Cliente 1",
            AppointmentDate = _targetDate.AddHours(15).AddMinutes(30),
            Status = AppointmentStatus.Pending
        });

        await db.SaveChangesAsync();
    }

    private void AuthAsAdmin() => _client.SetAuth(TestAuthHelper.AdminToken(TenantId), TenantId);

    [Fact]
    public async Task GetAvailability_35MinuteService_BlocksBothOverlappingSlots_LeavesNextSlotFree()
    {
        AuthAsAdmin();
        var dateStr = DateOnly.FromDateTime(_targetDate).ToString("yyyy-MM-dd");

        var response = await _client.GetAsync(
            $"/api/appointments/availability?barberId={BarberId}&serviceId={ServiceId}&date={dateStr}");

        response.EnsureSuccessStatusCode();
        var slots = await response.Content.ReadFromJsonAsync<List<AvailabilitySlotDto>>();
        Assert.NotNull(slots);

        var slot1530 = slots!.Single(s => s.Time == "15:30");
        var slot1600 = slots!.Single(s => s.Time == "16:00");
        var slot1630 = slots!.Single(s => s.Time == "16:30");

        Assert.False(slot1530.Available, "15:30 should be blocked — it's the booked slot itself.");
        Assert.False(slot1600.Available, "16:00 should be blocked — the 35min appointment (15:30-16:05) overlaps it.");
        Assert.True(slot1630.Available, "16:30 should be free — the 35min appointment ends at 16:05, before 16:30.");
    }
}
