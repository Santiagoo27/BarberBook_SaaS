using System.Net;
using System.Net.Mail;
using BarberBookSaaS.Application.Common;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BarberBookSaaS.Infrastructure.Services;

public class GmailEmailService : IEmailService
{
    private readonly IConfiguration _config;
    private readonly ILogger<GmailEmailService> _logger;

    public GmailEmailService(IConfiguration config, ILogger<GmailEmailService> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task SendPasswordResetEmailAsync(string toEmail, string tenantName, string resetLink)
    {
        var gmailUser = _config["Email:GmailUser"];
        var gmailAppPassword = _config["Email:GmailAppPassword"];
        var fromName = _config["Email:FromName"] ?? "BarberBook";

        if (string.IsNullOrWhiteSpace(gmailUser) || string.IsNullOrWhiteSpace(gmailAppPassword))
        {
            _logger.LogWarning(
                "[DEV] Password reset email NOT sent — Gmail not configured.\n" +
                "  To: {To}\n  Reset link: {Link}", toEmail, resetLink);
            return;
        }

        var htmlBody = $"""
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;">
              <h2 style="color:#D4AF37;">BarberBook</h2>
              <p>Hola,</p>
              <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>{tenantName}</strong>.</p>
              <p style="text-align:center;margin:30px 0;">
                <a href="{resetLink}" style="background:#D4AF37;color:#000;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">
                  Restablecer contraseña
                </a>
              </p>
              <p style="color:#888;font-size:13px;">Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este mensaje.</p>
              <hr style="border:none;border-top:1px solid #333;margin:20px 0;"/>
              <p style="color:#666;font-size:11px;">BarberBook — Panel Administrativo</p>
            </div>
            """;

        using var message = new MailMessage();
        message.From = new MailAddress(gmailUser, fromName);
        message.To.Add(new MailAddress(toEmail));
        message.Subject = $"Restablecer contraseña — {tenantName}";
        message.Body = htmlBody;
        message.IsBodyHtml = true;

        using var smtp = new SmtpClient("smtp.gmail.com", 587);
        smtp.Credentials = new NetworkCredential(gmailUser, gmailAppPassword);
        smtp.EnableSsl = true;

        try
        {
            await smtp.SendMailAsync(message);
            _logger.LogInformation("Password reset email sent to {To}", toEmail);
        }
        catch (SmtpException ex)
        {
            _logger.LogError(ex, "Failed to send email via Gmail to {To}", toEmail);
            _logger.LogWarning("[FALLBACK] Reset link for {To}: {Link}", toEmail, resetLink);
        }
    }
}
