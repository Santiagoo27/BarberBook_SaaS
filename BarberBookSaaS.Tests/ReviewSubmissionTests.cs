using System.Net;
using System.Net.Http.Json;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using BarberBookSaaS.Tests.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BarberBookSaaS.Tests;

/// <summary>
/// The QR code in BrandingPage links to /review/:subdomain with no appointment
/// reference at all — AppointmentId on Review is nullable by design for exactly
/// this generic flow. CreateReview must not require it.
/// </summary>
public class ReviewSubmissionTests : IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory = new();
    private HttpClient _client = null!;
    private static readonly Guid CustomerId = Guid.Parse("ffffffff-0000-0000-0000-000000000001");
    private static readonly Guid BarberId   = Guid.Parse("ffffffff-0000-0000-0000-000000000002");
    private static readonly Guid ServiceId  = Guid.Parse("ffffffff-0000-0000-0000-000000000003");
    private const string TenantId = "review-t1";

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

        db.Tenants.Add(new Tenant { Id = TenantId, Name = "Review Test", Subdomain = TenantId });
        db.Barbers.Add(new Barber { Id = BarberId, TenantId = TenantId, Name = "Barbero" });
        db.Services.Add(new Service { Id = ServiceId, TenantId = TenantId, Name = "Corte", Price = 20, DurationMinutes = 30, IsActive = true });
        db.Customers.Add(new Customer
        {
            Id = CustomerId, TenantId = TenantId, Name = "Cliente QR",
            Phone = "3000000000", PasswordHash = "x"
        });
        await db.SaveChangesAsync();
    }

    private void AuthAsCustomer() =>
        _client.SetAuth(TestAuthHelper.CustomerToken(TenantId, CustomerId.ToString()), TenantId);

    [Fact]
    public async Task CreateReview_WithoutAppointmentId_Succeeds()
    {
        AuthAsCustomer();
        var response = await _client.PostAsJsonAsync($"/api/public/{TenantId}/reviews", new
        {
            rating = 5,
            comment = "Excelente atención",
            appointmentId = (Guid?)null
        });

        var body = await response.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var saved = await db.Reviews.IgnoreQueryFilters().SingleAsync(r => r.TenantId == TenantId);
        Assert.Null(saved.AppointmentId);
        Assert.Equal(CustomerId, saved.CustomerId);
        Assert.Equal(5, saved.Rating);
    }

    [Fact]
    public async Task CreateReview_WithAppointmentId_NotCompleted_ReturnsBadRequest()
    {
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Appointments.Add(new Appointment
            {
                Id = Guid.NewGuid(), TenantId = TenantId, BarberId = BarberId, ServiceId = ServiceId,
                CustomerId = CustomerId, CustomerName = "Cliente QR",
                AppointmentDate = DateTime.UtcNow.AddDays(-1),
                Status = AppointmentStatus.Pending
            });
            await db.SaveChangesAsync();
        }

        using var scope2 = _factory.Services.CreateScope();
        var db2 = scope2.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var pendingAppt = await db2.Appointments.IgnoreQueryFilters().SingleAsync(a => a.TenantId == TenantId);

        AuthAsCustomer();
        var response = await _client.PostAsJsonAsync($"/api/public/{TenantId}/reviews", new
        {
            rating = 4,
            appointmentId = pendingAppt.Id
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
