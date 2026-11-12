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
        Assert.True(items[0].TryGetProperty("barberName", out _));
        Assert.True(items[0].TryGetProperty("serviceName", out _));
        Assert.True(items[0].TryGetProperty("appointmentDate", out _));
        Assert.True(items[0].TryGetProperty("status", out _));
    }

    [Fact]
    public async Task GetMyAppointments_WithoutAuth_Returns401()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/customer/appointments");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}