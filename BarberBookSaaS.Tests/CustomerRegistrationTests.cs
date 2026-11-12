using System.Net;
using System.Net.Http.Json;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using BarberBookSaaS.Tests.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BarberBookSaaS.Tests;

public class CustomerRegistrationTests : IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory = new();
    private HttpClient _client = null!;
    private const string TenantId = "reg-t1";

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
        db.Tenants.Add(new Tenant { Id = TenantId, Name = "Reg Test", Subdomain = TenantId });
        await db.SaveChangesAsync();
    }

    [Theory]
    [InlineData("test@gmail.com")]   // correo, no teléfono
    [InlineData("abcdefg")]          // texto sin dígitos
    [InlineData("123456")]           // 6 dígitos — muy corto
    [InlineData("12345678901234567")] // 17 dígitos — muy largo
    public async Task Register_InvalidPhoneFormat_Returns400(string phone)
    {
        var response = await _client.PostAsJsonAsync($"/api/public/{TenantId}/auth/register", new
        {
            name = "Cliente Test",
            phone,
            password = "Password123!"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("3001234567")]
    [InlineData("+573001234567")]
    [InlineData("(300) 123-4567")]
    public async Task Register_ValidPhoneFormat_Returns200(string phone)
    {
        var response = await _client.PostAsJsonAsync($"/api/public/{TenantId}/auth/register", new
        {
            name = "Cliente Test",
            phone,
            password = "Password123!"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Register_WithPhoneOfGhostCustomer_UpgradesGhostAndReturnsOk()
    {
        // Seed ghost customer directamente en DB
        using (var seedScope = _factory.Services.CreateScope())
        {
            var db = seedScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Customers.Add(new Customer
            {
                Id = Guid.NewGuid(), TenantId = TenantId,
                Name = "Ghost Name", Phone = "3005550001",
                PasswordHash = string.Empty,
                LoyaltyCount = 3, CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        // Registrar con ese teléfono
        var response = await _client.PostAsJsonAsync($"/api/public/{TenantId}/auth/register", new
        {
            name = "Real Name",
            phone = "3005550001",
            password = "Password123!"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        // Verificar que el Customer tiene contraseña y LoyaltyCount preservado
        using var verifyScope = _factory.Services.CreateScope();
        var db2 = verifyScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var customer = await db2.Customers
            .IgnoreQueryFilters()
            .FirstAsync(c => c.TenantId == TenantId && c.Phone == "3005550001");

        Assert.NotEqual(string.Empty, customer.PasswordHash);
        Assert.Equal("Real Name", customer.Name);
        Assert.Equal(3, customer.LoyaltyCount); // puntos de walk-ins previos conservados
    }

    [Fact]
    public async Task Register_WithPhoneOfRealCustomer_ReturnsBadRequest()
    {
        // Primer registro
        var first = await _client.PostAsJsonAsync($"/api/public/{TenantId}/auth/register", new
        {
            name = "Primero",
            phone = "3005550002",
            password = "Password123!"
        });
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        // Segundo intento con el mismo teléfono
        var second = await _client.PostAsJsonAsync($"/api/public/{TenantId}/auth/register", new
        {
            name = "Segundo",
            phone = "3005550002",
            password = "OtherPassword123!"
        });

        Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
    }
}
