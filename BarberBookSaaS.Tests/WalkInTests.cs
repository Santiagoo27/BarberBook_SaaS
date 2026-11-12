using System.Net;
using System.Net.Http.Json;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using BarberBookSaaS.Tests.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using BCryptNet = BCrypt.Net.BCrypt;

namespace BarberBookSaaS.Tests;

public class WalkInTests : IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory = new();
    private HttpClient _client = null!;

    // Tenant con loyalty habilitado
    private const string TenantId = "walkin-t1";
    private static readonly Guid UserId    = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid BarberId  = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static readonly Guid ServiceId    = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static readonly Guid AiServiceId  = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");

    // Tenant con loyalty DESHABILITADO
    private const string TenantId2 = "walkin-t2";
    private static readonly Guid UserId2   = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab");
    private static readonly Guid BarberId2 = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1");
    private static readonly Guid ServiceId2 = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccd");

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

        // Tenant 1 — loyalty enabled
        db.Tenants.Add(new Tenant
        {
            Id = TenantId, Name = "Walk-in Test", Subdomain = TenantId,
            LoyaltyEnabled = true, LoyaltyThreshold = 5
        });
        db.Users.Add(new User
        {
            Id = UserId, TenantId = TenantId, Email = "barber@walkin-t1.com",
            Role = UserRoles.Barber, PasswordHash = "x", IsActive = true, MustChangePassword = false
        });
        db.Barbers.Add(new Barber
        {
            Id = BarberId, TenantId = TenantId, UserId = UserId,
            Name = "Test Barber", IsActive = true
        });
        db.Services.Add(new Service
        {
            Id = ServiceId, TenantId = TenantId,
            Name = "Corte", Price = 20, DurationMinutes = 30, IsActive = true
        });
        db.Services.Add(new Service
        {
            Id = AiServiceId, TenantId = TenantId,
            Name = "Corte + Diagnóstico IA", Price = 30, DurationMinutes = 60, IsActive = true
        });

        // Tenant 2 — loyalty disabled
        db.Tenants.Add(new Tenant
        {
            Id = TenantId2, Name = "No Loyalty Test", Subdomain = TenantId2,
            LoyaltyEnabled = false, LoyaltyThreshold = 5
        });
        db.Users.Add(new User
        {
            Id = UserId2, TenantId = TenantId2, Email = "barber@walkin-t2.com",
            Role = UserRoles.Barber, PasswordHash = "x", IsActive = true, MustChangePassword = false
        });
        db.Barbers.Add(new Barber
        {
            Id = BarberId2, TenantId = TenantId2, UserId = UserId2,
            Name = "Test Barber 2", IsActive = true
        });
        db.Services.Add(new Service
        {
            Id = ServiceId2, TenantId = TenantId2,
            Name = "Corte", Price = 20, DurationMinutes = 30, IsActive = true
        });

        await db.SaveChangesAsync();
    }

    private void AuthAsBarber() =>
        _client.SetAuth(TestAuthHelper.BarberToken(TenantId, UserId.ToString()), TenantId);

    private void AuthAsBarber2() =>
        _client.SetAuth(TestAuthHelper.BarberToken(TenantId2, UserId2.ToString()), TenantId2);

    // ── Tests ───────────────────────────────────────────────────

    [Fact]
    public async Task CreateWalkIn_NoPhone_DoesNotCreateCustomer()
    {
        AuthAsBarber();
        var response = await _client.PostAsJsonAsync("/api/appointments/walk-in", new
        {
            serviceId = ServiceId,
            customerName = "Sin Teléfono",
            appointmentDate = DateTime.UtcNow
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var count = await db.Customers.IgnoreQueryFilters()
            .CountAsync(c => c.TenantId == TenantId);
        Assert.Equal(0, count);
    }

    [Fact]
    public async Task CreateWalkIn_WithNewPhone_CreatesGhostCustomerAndAccruesLoyalty()
    {
        AuthAsBarber();
        var response = await _client.PostAsJsonAsync("/api/appointments/walk-in", new
        {
            serviceId = ServiceId,
            customerName = "Carlos",
            customerPhone = "3001234567",
            appointmentDate = DateTime.UtcNow
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var customer = await db.Customers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.TenantId == TenantId && c.Phone == "3001234567");

        Assert.NotNull(customer);
        Assert.Equal("Carlos", customer.Name);
        Assert.Equal(string.Empty, customer.PasswordHash);
        Assert.Equal(1, customer.LoyaltyCount);
    }

    [Fact]
    public async Task CreateWalkIn_WithPhoneOfExistingGhost_ReusesAndAccruesLoyalty()
    {
        // Seed ghost customer directamente en DB
        using (var seedScope = _factory.Services.CreateScope())
        {
            var db = seedScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Customers.Add(new Customer
            {
                Id = Guid.NewGuid(), TenantId = TenantId,
                Name = "Carlos", Phone = "3009999999",
                PasswordHash = string.Empty, LoyaltyCount = 2, CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        AuthAsBarber();
        var response = await _client.PostAsJsonAsync("/api/appointments/walk-in", new
        {
            serviceId = ServiceId,
            customerName = "Carlos",
            customerPhone = "3009999999",
            appointmentDate = DateTime.UtcNow
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db2 = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var customers = await db2.Customers.IgnoreQueryFilters()
            .Where(c => c.TenantId == TenantId && c.Phone == "3009999999")
            .ToListAsync();

        Assert.Single(customers);                   // no se duplicó
        Assert.Equal(3, customers[0].LoyaltyCount); // 2 + 1
    }

    [Fact]
    public async Task CreateWalkIn_WithPhoneOfRealCustomer_ReusesAndAccruesLoyalty()
    {
        using (var seedScope = _factory.Services.CreateScope())
        {
            var db = seedScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Customers.Add(new Customer
            {
                Id = Guid.NewGuid(), TenantId = TenantId,
                Name = "Ana", Phone = "3008888888",
                PasswordHash = BCryptNet.HashPassword("Pass123!"),
                LoyaltyCount = 0, CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        AuthAsBarber();
        var response = await _client.PostAsJsonAsync("/api/appointments/walk-in", new
        {
            serviceId = ServiceId,
            customerName = "Ana",
            customerPhone = "3008888888",
            appointmentDate = DateTime.UtcNow
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db2 = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var customers = await db2.Customers.IgnoreQueryFilters()
            .Where(c => c.TenantId == TenantId && c.Phone == "3008888888")
            .ToListAsync();

        Assert.Single(customers);
        Assert.Equal(1, customers[0].LoyaltyCount);
    }

    [Fact]
    public async Task CreateWalkIn_AiService_DoesNotAccrueLoyalty()
    {
        AuthAsBarber();
        var response = await _client.PostAsJsonAsync("/api/appointments/walk-in", new
        {
            serviceId = AiServiceId,
            customerName = "Pedro",
            customerPhone = "3007777777",
            appointmentDate = DateTime.UtcNow
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var customer = await db.Customers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.TenantId == TenantId && c.Phone == "3007777777");

        Assert.NotNull(customer);
        Assert.Equal(0, customer.LoyaltyCount); // IA no acumula
    }

    [Fact]
    public async Task CreateWalkIn_LoyaltyDisabledTenant_DoesNotAccrueLoyalty()
    {
        AuthAsBarber2();
        var response = await _client.PostAsJsonAsync("/api/appointments/walk-in", new
        {
            serviceId = ServiceId2,
            customerName = "Luis",
            customerPhone = "3006666666",
            appointmentDate = DateTime.UtcNow
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var customer = await db.Customers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.TenantId == TenantId2 && c.Phone == "3006666666");

        Assert.NotNull(customer);
        Assert.Equal(0, customer.LoyaltyCount); // loyalty disabled
    }
}
