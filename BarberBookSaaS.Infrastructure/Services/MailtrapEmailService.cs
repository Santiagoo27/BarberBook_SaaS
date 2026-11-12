using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using BarberBookSaaS.Application.Common;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BarberBookSaaS.Infrastructure.Services;

public class MailtrapEmailService : IEmailService
{
    private readonly IConfiguration _config;
    private readonly ILogger<MailtrapEmailService> _logger;
    private readonly HttpClient _http;

    public MailtrapEmailService(IConfiguration config, ILogger<MailtrapEmailService> logger, HttpClient http)
    {
        _config = config;
        _logger = logger;
        _http = http;
    }

    public async Task SendPasswordResetEmailAsync(string toEmail, string tenantName, string resetLink)
    {
        var token = _config["Email:MailtrapToken"];
        var inboxId = _config["Email:MailtrapInboxId"];
        var from = _config["Email:From"] ?? "noreply@barberbook.dev";

        if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(inboxId))
        {
            _logger.LogWarning(
                "[DEV] Password reset email NOT sent — Mailtrap not configured.\n" +
                "  To: {To}\n  Reset link: {Link}", toEmail, resetLink);
            return;
        }

        var body = $"""
            <p>Hola,</p>
            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>{tenantName}</strong>.</p>
            <p>
              <a href="{resetLink}" style="background:#D4AF37;color:#000;padding:10px 20px;text-decoration:none;border-radius:4px;font-weight:bold;">
                Restablecer contraseña
              </a>
            </p>
            <p>Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este mensaje.</p>
            <p style="color:#888;font-size:12px;">BarberBook — Panel Administrativo</p>
            """;

        var payload = new
        {
            to = new[] { new { email = toEmail } },
            from = new { email = from, name = "BarberBook" },
            subject = $"Restablecer contraseña — {tenantName}",
            html = body
        };

        var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"https://sandbox.api.mailtrap.io/api/send/{inboxId}");

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = new StringContent(
            JsonSerializer.Serialize(payload),
            Encoding.UTF8,
            "application/json");

        try
        {
            var response = await _http.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                _logger.LogError("Mailtrap API error {Status}: {Body}", response.StatusCode, error);
                _logger.LogWarning("[DEV FALLBACK] Reset link for {To}: {Link}", toEmail, resetLink);
            }
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "[DEV FALLBACK] Email delivery failed (network error). Reset link for {To}: {Link}", toEmail, resetLink);
        }
    }
}
