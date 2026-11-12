using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using BarberBookSaaS.Tests.Helpers;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using BCryptNet = BCrypt.Net.BCrypt;

namespace BarberBookSaaS.Tests;

/// <summary>
/// Verifies the full flow: admin creates barber → barber logs in with temp password.
/// Diagnoses the reported bug where barbers could not log in after being created from the admin panel.
/// </summary>
public class BarberLoginFlowTests : IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory = new();
    private HttpClient _client = null!;
    private const string TenantId = "barber-login-t1";

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

        db.Tenants.Add(new Tenant
        {
            Id = TenantId,
            Name = "Test Barbershop",
            Subdomain = TenantId
        });

        db.Users.Add(new User
        {
            Id = Guid.NewGuid(),
            TenantId = TenantId,
            Email = "admin@barber-login-t1.com",
            Role = UserRoles.Admin,
            PasswordHash = BCryptNet.HashPassword("Admin1234!"),
            IsActive = true,
            MustChangePassword = false
        });

        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task AdminCreatesBarber_BarberCanLoginWithTempPassword()
    {
        // Step 1: Admin creates a barber via the API
        _client.SetAuth(TestAuthHelper.AdminToken(TenantId), TenantId);

        var createResp = await _client.PostAsJsonAsync("/api/barbers", new
        {
            name = "Juan Barbero",
            email = "juan@barber-login-t1.com",
            phone = "3001234567",
            specialty = "Corte clásico"
        });

        var createBody = await createResp.Content.ReadAsStringAsync();
        Assert.True(createResp.IsSuccessStatusCode,
            $"Create barber failed ({createResp.StatusCode}): {createBody}");

        var createData = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var temporaryPassword = createData.GetProperty("temporaryPassword").GetString()!;
        Assert.False(string.IsNullOrEmpty(temporaryPassword), "Temporary password must not be empty");

        // Step 2: Barber logs in with X-Tenant-Id header (no JWT — simulates login page)
        _client.DefaultRequestHeaders.Clear();
        _client.DefaultRequestHeaders.Add("X-Tenant-Id", TenantId);

        var loginResp = await _client.PostAsJsonAsync("/api/auth/login", new
        {
            email = "juan@barber-login-t1.com",
            password = temporaryPassword
        });

        var loginBody = await loginResp.Content.ReadAsStringAsync();
        Assert.True(loginResp.IsSuccessStatusCode,
            $"Barber login FAILED (status={loginResp.StatusCode}). " +
            $"TenantId='{TenantId}', Email='juan@barber-login-t1.com', TempPass='{temporaryPassword}'. " +
            $"Response: {loginBody}");

        var loginData = await loginResp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(UserRoles.Barber, loginData.GetProperty("role").GetString());
        Assert.True(loginData.GetProperty("mustChangePassword").GetBoolean(),
            "mustChangePassword should be true on first login");
        Assert.Equal(TenantId, loginData.GetProperty("tenantId").GetString());
    }

    [Fact]
    public async Task CreatedBarberUser_TenantId_MatchesAdminTenant()
    {
        // Create barber as admin
        _client.SetAuth(TestAuthHelper.AdminToken(TenantId), TenantId);

        var createResp = await _client.PostAsJsonAsync("/api/barbers", new
        {
            name = "Pedro Barbero",
            email = "pedro@barber-login-t1.com",
            phone = "3009876543",
            specialty = "Barba"
        });

        Assert.True(createResp.IsSuccessStatusCode,
            $"Create barber failed: {await createResp.Content.ReadAsStringAsync()}");

        // Verify barber appears in the barbers list (query filtered by TenantId)
        // If TenantId was not set correctly on the User, the barber list might still work (Barber entity),
        // but the login would fail. To prove User.TenantId is set, attempt login.
        var createData = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var tempPass = createData.GetProperty("temporaryPassword").GetString()!;

        _client.DefaultRequestHeaders.Clear();
        _client.DefaultRequestHeaders.Add("X-Tenant-Id", TenantId);

        var loginResp = await _client.PostAsJsonAsync("/api/auth/login", new
        {
            email = "pedro@barber-login-t1.com",
            password = tempPass
        });

        Assert.Equal(HttpStatusCode.OK, loginResp.StatusCode);
        var loginData = await loginResp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(TenantId, loginData.GetProperty("tenantId").GetString());
    }
}
