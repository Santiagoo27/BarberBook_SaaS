using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using BarberBookSaaS.Application.Common;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BarberBookSaaS.Infrastructure.Services;

public class MetaWhatsAppService : IWhatsAppService
{
    private readonly HttpClient _http;
    private readonly IAppointmentTokenService _tokenService;
    private readonly ILogger<MetaWhatsAppService> _logger;
    private readonly string _apiVersion;
    private readonly string _templateLanguage;
    private readonly string? _phoneNumberId;

    public MetaWhatsAppService(IConfiguration config, HttpClient http, IAppointmentTokenService tokenService, ILogger<MetaWhatsAppService> logger)
    {
        _http = http;
        _tokenService = tokenService;
        _logger = logger;
        _apiVersion = config["Meta:ApiVersion"] ?? "v21.0";
        _templateLanguage = config["Meta:TemplateLanguage"] ?? "es_MX";
        _phoneNumberId = config["Meta:PhoneNumberId"];
        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", config["Meta:AccessToken"] ?? string.Empty);
    }

    public Task SendReminderAsync(Guid appointmentId, string toPhone, string customerName, string tenantName, DateTime appointmentDate, string barberName, string tenantId) =>
        SendTemplateAsync("recordatorio_cita", includeButtons: false, appointmentId, toPhone, customerName, appointmentDate, barberName, tenantId);

    public Task SendConfirmationAsync(Guid appointmentId, string toPhone, string customerName, string tenantName, DateTime appointmentDate, string barberName, string tenantId) =>
        SendTemplateAsync("confirmacion_cita", includeButtons: true, appointmentId, toPhone, customerName, appointmentDate, barberName, tenantId);

    public Task SendRescheduleAsync(Guid appointmentId, string toPhone, string customerName, string tenantName, DateTime newAppointmentDate, string barberName, string tenantId) =>
        SendTemplateAsync("reprogramacion_cita", includeButtons: false, appointmentId, toPhone, customerName, newAppointmentDate, barberName, tenantId);

    public Task SendCancellationAsync(Guid appointmentId, string toPhone, string customerName, string tenantName, DateTime appointmentDate, string barberName, string tenantId) =>
        SendTemplateAsync("cita_cancelada", includeButtons: false, appointmentId, toPhone, customerName, appointmentDate, barberName, tenantId);

    public async Task SendPasswordResetAsync(string toPhone, string customerName, string tenantName, string resetLink)
    {
        if (string.IsNullOrWhiteSpace(_phoneNumberId))
        {
            _logger.LogWarning("[Meta WhatsApp] Meta:PhoneNumberId no configurado — no se envía reset de password a {Phone}.", toPhone);
            return;
        }

        var payload = new
        {
            messaging_product = "whatsapp",
            to = NormalizePhone(toPhone),
            type = "template",
            template = new
            {
                name = "recuperacion_acceso",
                language = new { code = _templateLanguage },
                components = new object[]
                {
                    new
                    {
                        type = "body",
                        parameters = new object[]
                        {
                            new { type = "text", text = customerName },
                            new { type = "text", text = tenantName }
                        }
                    },
                    new
                    {
                        type = "button",
                        sub_type = "url",
                        index = "0",
                        parameters = new object[] { new { type = "text", text = resetLink } }
                    }
                }
            }
        };

        var content = new StringContent(
            System.Text.Json.JsonSerializer.Serialize(payload),
            System.Text.Encoding.UTF8,
            "application/json");

        var url = $"https://graph.facebook.com/{_apiVersion}/{_phoneNumberId}/messages";
        var response = await _http.PostAsync(url, content);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            _logger.LogError("[Meta WhatsApp] Error {Status} al enviar reset de password a {Phone}: {Error}", response.StatusCode, toPhone, error);
        }
        else
        {
            _logger.LogInformation("[Meta WhatsApp] Reset de password enviado a {Phone}", toPhone);
        }
    }

    private async Task SendTemplateAsync(string templateName, bool includeButtons, Guid appointmentId, string toPhone, string customerName, DateTime appointmentDate, string barberName, string tenantId)
    {
        if (string.IsNullOrWhiteSpace(_phoneNumberId))
        {
            _logger.LogWarning("[Meta WhatsApp] Meta:PhoneNumberId no configurado — no se envía la plantilla {Template} para la cita {AppointmentId}.", templateName, appointmentId);
            return;
        }

        var normalizedPhone = NormalizePhone(toPhone);
        _logger.LogInformation("[Meta WhatsApp] Enviando plantilla {Template} a {Phone} (original: {Original}), idioma: {Lang}", templateName, normalizedPhone, toPhone, _templateLanguage);

        var payload = BuildPayload(templateName, toPhone, customerName, appointmentDate, barberName, appointmentId, tenantId, includeButtons);
        var jsonPayload = JsonSerializer.Serialize(payload);
        _logger.LogInformation("[Meta WhatsApp] Payload: {Payload}", jsonPayload);
        var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

        var url = $"https://graph.facebook.com/{_apiVersion}/{_phoneNumberId}/messages";
        var response = await _http.PostAsync(url, content);

        var responseBody = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("[Meta WhatsApp] Error {Status} al enviar plantilla {Template} para la cita {AppointmentId}: {Error}", response.StatusCode, templateName, appointmentId, responseBody);
        }
        else
        {
            _logger.LogInformation("[Meta WhatsApp] Plantilla {Template} enviada para la cita {AppointmentId}. Response: {Response}", templateName, appointmentId, responseBody);
        }
    }

    private object BuildPayload(string templateName, string toPhone, string customerName, DateTime appointmentDate, string barberName, Guid appointmentId, string tenantId, bool includeButtons)
    {
        var components = new List<object>
        {
            new
            {
                type = "body",
                parameters = new object[]
                {
                    new { type = "text", text = customerName },
                    new { type = "text", text = appointmentDate.ToString("dd/MM/yyyy 'a las' HH:mm") },
                    new { type = "text", text = barberName }
                }
            }
        };

        if (includeButtons)
        {
            var token = _tokenService.GenerateToken(appointmentId, appointmentDate);

            components.Add(new
            {
                type = "button",
                sub_type = "url",
                index = "0",
                parameters = new object[] { new { type = "text", text = token } }
            });

            components.Add(new
            {
                type = "button",
                sub_type = "quick_reply",
                index = "1",
                parameters = new object[] { new { type = "payload", payload = $"CANCELAR:{tenantId}:{appointmentId:N}" } }
            });
        }

        return new
        {
            messaging_product = "whatsapp",
            to = NormalizePhone(toPhone),
            type = "template",
            template = new
            {
                name = templateName,
                language = new { code = _templateLanguage },
                components
            }
        };
    }

    private static string NormalizePhone(string phone)
    {
        phone = new string(phone.Where(char.IsDigit).ToArray());
        // Número colombiano sin prefijo: 10 dígitos empezando en 3 → agregar 57
        if (phone.Length == 10 && phone.StartsWith('3'))
            phone = "57" + phone;
        return phone;
    }
}
