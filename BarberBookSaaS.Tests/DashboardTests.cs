using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using BarberBookSaaS.Tests.Helpers;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

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

        // Cita completada HOY 9am → cuenta en WeekRevenue
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
        // Segunda cita completada HOY 11am → también cuenta en WeekRevenue (evita depender del día de semana)
        db.Appointments.Add(new Appointment
        {
            Id = Guid.NewGuid(), TenantId = TenantId, BarberId = barberId, ServiceId = serviceId,
            CustomerName = "C3", AppointmentDate = DateTime.Now.Date.AddHours(11),
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

        Assert.True(body.TryGetProperty("upcomingAppointments", out var upcoming));
        Assert.True(body.TryGetProperty("weekRevenue", out var weekRev));

        // 1 cita en las próximas 48h (mañana)
        Assert.Equal(1, upcoming.GetInt32());

        // WeekRevenue = hoy (20) + ayer (20) = 40
        Assert.Equal(40m, weekRev.GetDecimal());
    }
}