using System.Net;
using System.Net.Http.Json;
using BarberBookSaaS.Tests.Helpers;
using Xunit;

namespace BarberBookSaaS.Tests;

public class RateLimiterTests : IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory = new();
    private HttpClient _client = null!;

    public async Task InitializeAsync()
    {
        await _factory.InitializeDbAsync();
        _client = _factory.CreateClient();
    }

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    [Fact]
    public async Task AuthEndpoints_InTestingEnv_AllowMoreThanFiveRequests()
    {
        // In Testing environment, PermitLimit should be int.MaxValue (not 5).
        // So 6+ requests must NOT return 429 TooManyRequests.
        for (var i = 0; i < 6; i++)
        {
            var response = await _client.PostAsJsonAsync("/api/auth/login",
                new { email = "x@x.com", password = "wrong" });

            // 401 Unauthorized (bad creds) is fine. 429 TooManyRequests is NOT fine.
            Assert.NotEqual(HttpStatusCode.TooManyRequests, response.StatusCode);
        }
    }
}