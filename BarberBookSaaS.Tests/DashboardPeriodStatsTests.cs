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

public class DashboardPeriodStatsTests : IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory = new();
    private HttpClient _client = null!;
    private const string TenantId = "dash-period-t1";
    private const decimal Price = 25m;

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

        db.Tenants.Add(new Tenant { Id = TenantId, Name = "Period Test", Subdomain = TenantId });
        var barberId = Guid.NewGuid();
        var serviceId = Guid.NewGuid();
        db.Barbers.Add(new Barber { Id = barberId, TenantId = TenantId, Name = "Ana" });
        db.Services.Add(new Service
        {
            Id = serviceId, TenantId = TenantId, Name = "Corte",
            Price = Price, DurationMinutes = 30, IsActive = true
        });

        var today = DateTime.Now.Date;

        // Hace 3 días — completada, dentro de 7 días
        db.Appointments.Add(new Appointment
        {
            Id = Guid.NewGuid(), TenantId = TenantId, BarberId = barberId, ServiceId = serviceId,
            CustomerName = "C1", AppointmentDate = today.AddDays(-3).AddHours(9),
            Status = AppointmentStatus.Completed
        });
        // Ayer — completada, walk-in, dentro de 7 días
        db.Appointments.Add(new Appointment
        {
            Id = Guid.NewGuid(), TenantId = TenantId, BarberId = barberId, ServiceId = serviceId,
            CustomerName = "C2", AppointmentDate = today.AddDays(-1).AddHours(10),
            Status = AppointmentStatus.Completed, IsWalkIn = true
        });
        // Hace 20 días — completada, fuera de 7 y 15 días, dentro de 30 días
        db.Appointments.Add(new Appointment
        {
            Id = Guid.NewGuid(), TenantId = TenantId, BarberId = barberId, ServiceId = serviceId,
            CustomerName = "C3", AppointmentDate = today.AddDays(-20).AddHours(11),
            Status = AppointmentStatus.Completed
        });

        // Cliente hace 2 días — dentro de 7 días
        db.Customers.Add(new Customer
        {
            Id = Guid.NewGuid(), TenantId = TenantId, Name = "Nuevo1",
            Phone = "300000001", PasswordHash = "x",
            CreatedAt = today.AddDays(-2)
        });
        // Cliente hace 20 días — fuera de 7 y 15 días, dentro de 30 días
        db.Customers.Add(new Customer
        {
            Id = Guid.NewGuid(), TenantId = TenantId, Name = "Nuevo2",
            Phone = "300000002", PasswordHash = "x",
            CreatedAt = today.AddDays(-20)
        });

        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task GetPeriodStats_7Days_ReturnsCorrectTotals()
    {
        var response = await _client.GetAsync("/api/dashboard/period-stats?days=7");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(2, body.GetProperty("totalAppointments").GetInt32());
        Assert.Equal(Price * 2, body.GetProperty("totalRevenue").GetDecimal());
        Assert.Equal(1, body.GetProperty("totalWalkIns").GetInt32());
        Assert.Equal(1, body.GetProperty("newCustomers").GetInt32());
    }

    [Fact]
    public async Task GetPeriodStats_30Days_IncludesOlderData()
    {
        var response = await _client.GetAsync("/api/dashboard/period-stats?days=30");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(3, body.GetProperty("totalAppointments").GetInt32());
        Assert.Equal(Price * 3, body.GetProperty("totalRevenue").GetDecimal());
        Assert.Equal(2, body.GetProperty("newCustomers").GetInt32());
    }

    [Fact]
    public async Task GetPeriodStats_InvalidDays_Returns400()
    {
        var response = await _client.GetAsync("/api/dashboard/period-stats?days=5");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
