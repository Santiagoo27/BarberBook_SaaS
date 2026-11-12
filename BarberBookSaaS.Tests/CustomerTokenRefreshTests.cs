using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using BarberBookSaaS.Tests.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BarberBookSaaS.Tests;

/// <summary>
/// publicApiClient.ts posts the refresh token as a raw JSON string (matching
/// [FromBody] string refreshToken on the controller), not as { refreshToken }
/// like the admin refresh endpoint. This locks in that exact wire contract so
/// a frontend/backend mismatch here fails CI instead of silently 400ing for
/// every customer whose 1h token has expired.
/// </summary>
public class CustomerTokenRefreshTests : IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory = new();
    private HttpClient _client = null!;
    private const string TenantId = "refresh-t1";

    public async Task InitializeAsync()
    {
        await _factory.InitializeDbAsync();
        _client = _factory.CreateClient();
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.Tenants.Add(new Tenant { Id = TenantId, Name = "Refresh Test", Subdomain = TenantId });
        await db.SaveChangesAsync();
    }

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    [Fact]
    public async Task RefreshEndpoint_AcceptsRawJsonStringBody_AndReturnsWorkingToken()
    {
        var register = await _client.PostAsJsonAsync($"/api/public/{TenantId}/auth/register", new
        {
            name = "Cliente Refresh",
            phone = "3009998877",
            password = "Segura123!"
        });
        register.EnsureSuccessStatusCode();
        var registerBody = await register.Content.ReadFromJsonAsync<JsonElement>();
        var originalRefreshToken = registerBody.GetProperty("refreshToken").GetString();
        Assert.False(string.IsNullOrEmpty(originalRefreshToken));

        // Exactly what publicApiClient.ts sends: a bare JSON string as the body.
        var rawBody = JsonSerializer.Serialize(originalRefreshToken);
        var refreshResponse = await _client.PostAsync(
            $"/api/public/{TenantId}/auth/refresh",
            new StringContent(rawBody, Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.OK, refreshResponse.StatusCode);
        var refreshBody = await refreshResponse.Content.ReadFromJsonAsync<JsonElement>();
        var newToken = refreshBody.GetProperty("token").GetString();
        Assert.False(string.IsNullOrEmpty(newToken));

        // The freshly refreshed token must actually authenticate a customer-only call.
        _client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", newToken);
        var reviewResponse = await _client.PostAsJsonAsync($"/api/public/{TenantId}/reviews", new
        {
            rating = 5,
            appointmentId = (Guid?)null
        });
        Assert.Equal(HttpStatusCode.OK, reviewResponse.StatusCode);
    }
}
