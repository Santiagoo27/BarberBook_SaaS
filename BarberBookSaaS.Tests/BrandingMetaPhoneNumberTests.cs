using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using BarberBookSaaS.Tests.Helpers;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BarberBookSaaS.Tests;

public class BrandingWhatsAppTests : IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory = new();
    private HttpClient _client = null!;
    private const string TenantId = "meta-t1";

    public async Task InitializeAsync()
    {
        await _factory.InitializeDbAsync();
        _client = _factory.CreateClient();
        await SeedAsync();
        _client.SetAuth(TestAuthHelper.AdminToken(TenantId), TenantId);
    }

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private async Task SeedAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.Tenants.Add(new Tenant { Id = TenantId, Name = "WhatsApp Test", Subdomain = TenantId });
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task UpdateWhatsApp_PersistsEnabledAndPhone()
    {
        var response = await _client.PutAsJsonAsync("/api/tenant/whatsapp", new
        {
            enabled = true,
            phone = "+573001234567"
        });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var getResponse = await _client.GetAsync("/api/tenant/branding");
        var body = await getResponse.Content.ReadFromJsonAsync<JsonElement>();

        Assert.True(body.GetProperty("whatsAppEnabled").GetBoolean());
        Assert.Equal("+573001234567", body.GetProperty("whatsAppPhone").GetString());
    }

    [Fact]
    public async Task UpdateWhatsApp_BlankPhone_StoresNull()
    {
        await _client.PutAsJsonAsync("/api/tenant/whatsapp", new
        {
            enabled = false,
            phone = ""
        });

        var getResponse = await _client.GetAsync("/api/tenant/branding");
        var body = await getResponse.Content.ReadFromJsonAsync<JsonElement>();

        Assert.False(body.GetProperty("whatsAppEnabled").GetBoolean());
        Assert.Equal(JsonValueKind.Null, body.GetProperty("whatsAppPhone").ValueKind);
    }
}
