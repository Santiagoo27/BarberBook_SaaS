using System.Net;
using System.Text.Json;
using BarberBookSaaS.Infrastructure.Services;
using BarberBookSaaS.Tests.Helpers;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace BarberBookSaaS.Tests;

public class MetaWhatsAppServiceTests
{
    private const string PhoneNumberId = "1234567890";

    private static (MetaWhatsAppService Service, CapturingHttpMessageHandler Handler) CreateService(bool includePhoneNumberId = true)
    {
        var configValues = new Dictionary<string, string?>
        {
            ["Jwt:Key"] = "TestSecretKeyForUnitTests_AtLeast32Chars!",
            ["Meta:AccessToken"] = "test-access-token",
            ["Meta:ApiVersion"] = "v21.0",
            ["Meta:TemplateLanguage"] = "es_MX"
        };
        if (includePhoneNumberId)
            configValues["Meta:PhoneNumberId"] = PhoneNumberId;

        var config = new ConfigurationBuilder().AddInMemoryCollection(configValues).Build();

        var handler = new CapturingHttpMessageHandler();
        var httpClient = new HttpClient(handler);
        var tokenService = new AppointmentTokenService(config, NullLogger<AppointmentTokenService>.Instance);

        var service = new MetaWhatsAppService(config, httpClient, tokenService, NullLogger<MetaWhatsAppService>.Instance);
        return (service, handler);
    }

    [Fact]
    public async Task SendConfirmationAsync_SendsTemplateWithBodyVarsAndButtons()
    {
        var (service, handler) = CreateService();
        var appointmentId = Guid.NewGuid();
        var appointmentDate = new DateTime(2026, 6, 15, 14, 30, 0);
        const string tenantId = "elegant";

        await service.SendConfirmationAsync(
            appointmentId, "+573001234567", "Juan Pérez", "Barbería Test",
            appointmentDate, "Carlos", tenantId);

        Assert.NotNull(handler.LastRequest);
        Assert.Equal($"https://graph.facebook.com/v21.0/{PhoneNumberId}/messages", handler.LastRequest!.RequestUri!.ToString());

        var body = JsonDocument.Parse(handler.LastRequestBody!).RootElement;
        Assert.Equal("confirmacion_cita", body.GetProperty("template").GetProperty("name").GetString());
        Assert.Equal("es_MX", body.GetProperty("template").GetProperty("language").GetProperty("code").GetString());

        var components = body.GetProperty("template").GetProperty("components");
        Assert.Equal(3, components.GetArrayLength());

        var bodyParams = components[0].GetProperty("parameters");
        Assert.Equal("Juan Pérez", bodyParams[0].GetProperty("text").GetString());
        Assert.Equal("15/06/2026 a las 14:30", bodyParams[1].GetProperty("text").GetString());
        Assert.Equal("Carlos", bodyParams[2].GetProperty("text").GetString());

        Assert.Equal("url", components[1].GetProperty("sub_type").GetString());
        Assert.Equal("quick_reply", components[2].GetProperty("sub_type").GetString());

        var cancelPayload = components[2].GetProperty("parameters")[0].GetProperty("payload").GetString();
        Assert.Equal($"CANCELAR:{tenantId}:{appointmentId:N}", cancelPayload);
    }

    [Fact]
    public async Task SendCancellationAsync_SendsTemplateWithoutButtons()
    {
        var (service, handler) = CreateService();

        await service.SendCancellationAsync(
            Guid.NewGuid(), "+573001234567", "Juan Pérez", "Barbería Test",
            new DateTime(2026, 6, 15, 14, 30, 0), "Carlos", "elegant");

        Assert.NotNull(handler.LastRequest);

        var body = JsonDocument.Parse(handler.LastRequestBody!).RootElement;
        Assert.Equal("cita_cancelada", body.GetProperty("template").GetProperty("name").GetString());

        var components = body.GetProperty("template").GetProperty("components");
        Assert.Equal(1, components.GetArrayLength());
    }

    [Fact]
    public async Task SendConfirmationAsync_WithoutPhoneNumberIdInConfig_SkipsSend()
    {
        var (service, handler) = CreateService(includePhoneNumberId: false);

        await service.SendConfirmationAsync(
            Guid.NewGuid(), "+573001234567", "Juan Pérez", "Barbería Test",
            new DateTime(2026, 6, 15, 14, 30, 0), "Carlos", "elegant");

        Assert.Null(handler.LastRequest);
    }

    [Fact]
    public async Task SendConfirmationAsync_WhenMetaReturnsError_DoesNotThrow()
    {
        var (service, handler) = CreateService();
        handler.ResponseStatusCode = HttpStatusCode.BadRequest;
        handler.ResponseBody = "{\"error\":{\"message\":\"Invalid template\"}}";

        await service.SendConfirmationAsync(
            Guid.NewGuid(), "+573001234567", "Juan Pérez", "Barbería Test",
            new DateTime(2026, 6, 15, 14, 30, 0), "Carlos", "elegant");

        Assert.NotNull(handler.LastRequest);
    }
}
