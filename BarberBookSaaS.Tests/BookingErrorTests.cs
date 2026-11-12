using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using BarberBookSaaS.Tests.Helpers;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BarberBookSaaS.Tests;

public class BookingErrorTests : IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory = new();
    private HttpClient _client = null!;
    private static readonly Guid BarberId          = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000001");
    private static readonly Guid ServiceId         = Guid.Parse("bbbbbbbb-0000-0000-0000-000000000001");
    private static readonly Guid InactiveServiceId = Guid.Parse("cccccccc-0000-0000-0000-000000000001");
    private const string TenantId = "booking-t1";

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

        db.Tenants.Add(new Tenant { Id = TenantId, Name = "Booking Test", Subdomain = TenantId });
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
    public async Task CreateAppointment_PastDate_Returns400_WithErrorCode_PAST_DATE()
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
    public async Task CreateAppointment_InactiveService_Returns400_WithErrorCode_SERVICE_INACTIVE()
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
    public async Task CreateAppointment_ServiceNotFound_Returns400_WithErrorCode_SERVICE_NOT_FOUND()
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
    public async Task CreateAppointment_ConflictingSlot_Returns409_WithErrorCode_SCHEDULE_CONFLICT()
    {
        AuthAsAdmin();
        var appointmentDate = DateTime.Now.AddDays(1).Date.AddHours(10); // tomorrow at 10:00

        // First appointment — must succeed
        var first = await _client.PostAsJsonAsync("/api/appointments", new
        {
            barberId = BarberId,
            serviceId = ServiceId,
            customerName = "Cliente 1",
            appointmentDate
        });
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        // Second appointment at same time — must fail with 409
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