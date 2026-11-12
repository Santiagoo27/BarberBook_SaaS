using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using BarberBookSaaS.Tests.Helpers;
using Xunit;

namespace BarberBookSaaS.Tests;

public class MustChangePasswordTests : IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory = new();
    private HttpClient _client = null!;
    private const string TenantId = "mcp-t1";

    public async Task InitializeAsync()
    {
        await _factory.InitializeDbAsync();
        _client = _factory.CreateClient();
    }

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    [Fact]
    public async Task AccessProtectedEndpoint_WithMustChangePasswordToken_Returns403()
    {
        _client.SetAuth(TestAuthHelper.MustChangePasswordToken(TenantId), TenantId);

        var response = await _client.GetAsync("/api/appointments");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("MUST_CHANGE_PASSWORD", body.GetProperty("errorCode").GetString());
    }

    [Fact]
    public async Task AccessChangePasswordEndpoint_WithMustChangePasswordToken_IsNotBlocked()
    {
        _client.SetAuth(TestAuthHelper.MustChangePasswordToken(TenantId), TenantId);

        var response = await _client.PostAsJsonAsync("/api/auth/change-password", new
        {
            currentPassword = "wrong",
            newPassword = "newpass123"
        });

        Assert.NotEqual(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AccessProtectedEndpoint_WithNormalToken_IsNotBlocked()
    {
        _client.SetAuth(TestAuthHelper.BarberToken(TenantId), TenantId);

        var response = await _client.GetAsync("/api/appointments");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}