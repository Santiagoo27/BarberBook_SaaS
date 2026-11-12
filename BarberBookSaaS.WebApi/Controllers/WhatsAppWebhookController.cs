using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BarberBookSaaS.WebApi.Controllers;

[ApiController]
[Route("api/whatsapp/webhook")]
public class WhatsAppWebhookController : ControllerBase
{
    private const string CancelPrefix = "CANCELAR:";

    private readonly ApplicationDbContext _context;
    private readonly ITenantService _tenantService;
    private readonly IAppointmentService _appointmentService;
    private readonly IConfiguration _config;
    private readonly ILogger<WhatsAppWebhookController> _logger;

    public WhatsAppWebhookController(
        ApplicationDbContext context,
        ITenantService tenantService,
        IAppointmentService appointmentService,
        IConfiguration config,
        ILogger<WhatsAppWebhookController> logger)
    {
        _context = context;
        _tenantService = tenantService;
        _appointmentService = appointmentService;
        _config = config;
        _logger = logger;
    }

    [HttpGet]
    [AllowAnonymous]
    public IActionResult Verify(
        [FromQuery(Name = "hub.mode")] string? mode,
        [FromQuery(Name = "hub.verify_token")] string? verifyToken,
        [FromQuery(Name = "hub.challenge")] string? challenge)
    {
        var expectedToken = _config["Meta:VerifyToken"];

        if (mode == "subscribe" && !string.IsNullOrEmpty(expectedToken) && verifyToken == expectedToken)
            return Content(challenge ?? string.Empty, "text/plain");

        return Forbid();
    }

    [HttpPost]
    [AllowAnonymous]
    public async Task<IActionResult> Receive()
    {
        using var reader = new StreamReader(Request.Body, Encoding.UTF8);
        var rawBody = await reader.ReadToEndAsync();

        if (!IsValidSignature(rawBody))
            return Unauthorized();

        using var doc = JsonDocument.Parse(rawBody);
        await ProcessEntriesAsync(doc.RootElement);

        return Ok();
    }

    private bool IsValidSignature(string rawBody)
    {
        var appSecret = _config["Meta:AppSecret"];
        if (string.IsNullOrEmpty(appSecret)) return false;

        var signatureHeader = Request.Headers["X-Hub-Signature-256"].FirstOrDefault();
        if (string.IsNullOrEmpty(signatureHeader) || !signatureHeader.StartsWith("sha256=", StringComparison.OrdinalIgnoreCase))
            return false;

        var providedHex = signatureHeader["sha256=".Length..];

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(appSecret));
        var computedBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(rawBody));
        var computedHex = Convert.ToHexString(computedBytes).ToLowerInvariant();

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(computedHex),
            Encoding.UTF8.GetBytes(providedHex.ToLowerInvariant()));
    }

    private async Task ProcessEntriesAsync(JsonElement root)
    {
        if (!root.TryGetProperty("entry", out var entries)) return;

        foreach (var entry in entries.EnumerateArray())
        {
            if (!entry.TryGetProperty("changes", out var changes)) continue;

            foreach (var change in changes.EnumerateArray())
            {
                if (!change.TryGetProperty("value", out var value)) continue;
                await ProcessChangeValueAsync(value);
            }
        }
    }

    private async Task ProcessChangeValueAsync(JsonElement value)
    {
        if (!value.TryGetProperty("messages", out var messages)) return;

        foreach (var message in messages.EnumerateArray())
        {
            await ProcessMessageAsync(message);
        }
    }

    private async Task ProcessMessageAsync(JsonElement message)
    {
        if (!message.TryGetProperty("type", out var typeProp) || typeProp.GetString() != "button")
            return;

        if (!message.TryGetProperty("button", out var button)
            || !button.TryGetProperty("payload", out var payloadProp))
            return;

        var payload = payloadProp.GetString() ?? string.Empty;
        if (!payload.StartsWith(CancelPrefix, StringComparison.Ordinal))
            return;

        // Payload format: CANCELAR:{tenantId}:{appointmentId}
        var parts = payload[CancelPrefix.Length..].Split(':', 2);
        if (parts.Length != 2 || !Guid.TryParseExact(parts[1], "N", out var appointmentId))
        {
            _logger.LogWarning("[WhatsApp Webhook] Payload de cancelación con formato inválido: {Payload}", payload);
            return;
        }

        var tenantId = parts[0];
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            _logger.LogWarning("[WhatsApp Webhook] TenantId vacío en payload: {Payload}", payload);
            return;
        }

        _tenantService.TenantId = tenantId;

        var appointment = await _context.Appointments
            .FirstOrDefaultAsync(a => a.Id == appointmentId && a.Status == AppointmentStatus.Pending);

        if (appointment is null)
        {
            _logger.LogWarning("[WhatsApp Webhook] Cita {AppointmentId} no encontrada o no está Pendiente en tenant {TenantId}", appointmentId, tenantId);
            return;
        }

        await _appointmentService.UpdateStatusAsync(appointment.Id, AppointmentStatus.Cancelled, "whatsapp");
        _logger.LogInformation("[WhatsApp Webhook] Cita {AppointmentId} cancelada vía botón de WhatsApp", appointment.Id);
    }
}
