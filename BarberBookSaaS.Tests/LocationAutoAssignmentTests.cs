using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using BarberBookSaaS.Tests.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BarberBookSaaS.Tests;

public class LocationAutoAssignmentTests : IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory = new();
    private HttpClient _client = null!;

    public async Task InitializeAsync()
    {
        await _factory.InitializeDbAsync();
        _client = _factory.CreateClient();
    }

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private async Task<Location> SeedTenantWithLocationsAsync(string tenantId, int locationCount, string? address = null)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        db.Tenants.Add(new Tenant { Id = tenantId, Name = tenantId, Subdomain = tenantId, Address = address });

        Location first = null!;
        for (var i = 0; i < locationCount; i++)
        {
            var location = new Location
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Name = $"Sede {i + 1}",
                Address = "Calle Falsa 123",
                IsActive = true,
                CreatedAt = DateTime.UtcNow.AddMinutes(i)
            };
            first ??= location;
            db.Locations.Add(location);
        }

        await db.SaveChangesAsync();
        return first;
    }

    [Fact]
    public async Task RegisterTenant_CreatesSedePrincipal_WithTenantAddress()
    {
        const string subdomain = "loc-reg-1";
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", TestAuthHelper.SuperAdminToken());

        var response = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            barberiaName = "Barbería Registro",
            subdomain,
            phone = "+573000000000",
            address = "Av. Siempre Viva 742",
            adminEmail = "admin@loc-reg-1.com"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var location = await db.Locations.IgnoreQueryFilters()
            .SingleOrDefaultAsync(l => l.TenantId == subdomain);

        Assert.NotNull(location);
        Assert.Equal("Sede Principal", location!.Name);
        Assert.Equal("Av. Siempre Viva 742", location.Address);
        Assert.True(location.IsActive);
    }

    [Fact]
    public async Task RegisterTenant_WithoutAddress_UsesDefaultAddress()
    {
        const string subdomain = "loc-reg-2";
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", TestAuthHelper.SuperAdminToken());

        var response = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            barberiaName = "Barbería Sin Dirección",
            subdomain,
            adminEmail = "admin@loc-reg-2.com"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var location = await db.Locations.IgnoreQueryFilters()
            .SingleOrDefaultAsync(l => l.TenantId == subdomain);

        Assert.NotNull(location);
        Assert.Equal("Sin dirección registrada", location!.Address);
    }

    [Fact]
    public async Task CreateBarber_TenantWithOneLocation_AutoAssignsLocationId()
    {
        const string tenantId = "loc-barber-1";
        var location = await SeedTenantWithLocationsAsync(tenantId, locationCount: 1);
        _client.SetAuth(TestAuthHelper.AdminToken(tenantId), tenantId);

        var response = await _client.PostAsJsonAsync("/api/barbers", new
        {
            name = "Carlos",
            email = "carlos@loc-barber-1.com",
            phone = "+573001112233",
            specialty = "Cortes clásicos"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var barber = await db.Barbers.IgnoreQueryFilters()
            .SingleAsync(b => b.TenantId == tenantId);

        Assert.Equal(location.Id, barber.LocationId);
    }

    [Fact]
    public async Task CreateBarber_TenantWithTwoLocations_DoesNotAutoAssign()
    {
        const string tenantId = "loc-barber-2";
        await SeedTenantWithLocationsAsync(tenantId, locationCount: 2);
        _client.SetAuth(TestAuthHelper.AdminToken(tenantId), tenantId);

        var response = await _client.PostAsJsonAsync("/api/barbers", new
        {
            name = "Luis",
            email = "luis@loc-barber-2.com",
            phone = "+573001112244",
            specialty = "Barba"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var barber = await db.Barbers.IgnoreQueryFilters()
            .SingleAsync(b => b.TenantId == tenantId);

        Assert.Null(barber.LocationId);
    }

    [Fact]
    public async Task CreateService_TenantWithOneLocation_AutoLinksLocationService()
    {
        const string tenantId = "loc-service-1";
        var location = await SeedTenantWithLocationsAsync(tenantId, locationCount: 1);
        _client.SetAuth(TestAuthHelper.AdminToken(tenantId), tenantId);

        var response = await _client.PostAsJsonAsync("/api/services", new
        {
            name = "Corte + Barba",
            price = 35000,
            durationMinutes = 45
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<JsonElement>();
        var serviceId = created.GetProperty("id").GetGuid();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var linked = await db.LocationServices
            .AnyAsync(ls => ls.LocationId == location.Id && ls.ServiceId == serviceId);

        Assert.True(linked);
    }

    [Fact]
    public async Task CreateService_TenantWithTwoLocations_DoesNotAutoLink()
    {
        const string tenantId = "loc-service-2";
        await SeedTenantWithLocationsAsync(tenantId, locationCount: 2);
        _client.SetAuth(TestAuthHelper.AdminToken(tenantId), tenantId);

        var response = await _client.PostAsJsonAsync("/api/services", new
        {
            name = "Tinte",
            price = 50000,
            durationMinutes = 60
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<JsonElement>();
        var serviceId = created.GetProperty("id").GetGuid();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var linked = await db.LocationServices.AnyAsync(ls => ls.ServiceId == serviceId);

        Assert.False(linked);
    }
}
