using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Nodes;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Infrastructure.Persistence;

namespace BarberBookSaaS.WebApi.Controllers;

[ApiController]
[Route("api/appointments")]
[Authorize(Roles = $"{UserRoles.Admin},{UserRoles.Barber}")]
public class AIDiagnosisController : ControllerBase
{
    private const int PremiumMonthlyLimit = 100;

    private readonly IAIService _aiService;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<AIDiagnosisController> _logger;

    public AIDiagnosisController(IAIService aiService, ApplicationDbContext db, ILogger<AIDiagnosisController> logger)
    {
        _aiService = aiService;
        _db = db;
        _logger = logger;
    }

    [HttpGet("ai-diagnosis/quota")]
    public async Task<IActionResult> GetQuota()
    {
        var tenantId = User.FindFirstValue("TenantId") ?? "";
        var tenant = await _db.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId);
        if (tenant is null) return NotFound();

        if (tenant.Plan == "Standard")
            return Ok(new { plan = "Standard", available = false, used = 0, limit = 0, remaining = 0 });

        if (tenant.Plan == "PremiumUnlimited")
            return Ok(new { plan = "PremiumUnlimited", available = true, used = tenant.AiDiagnosisUsed, limit = -1, remaining = -1 });

        // Premium — 30-day window anchored to CreatedAt (same as billing cycle)
        var now = DateTime.UtcNow;
        var periodsElapsed = (int)Math.Floor((now - tenant.CreatedAt).TotalDays / 30);
        var periodStart = tenant.CreatedAt.AddDays(periodsElapsed * 30);
        var resetDate = tenant.CreatedAt.AddDays((periodsElapsed + 1) * 30);

        if (tenant.AiDiagnosisPeriodStart is null || tenant.AiDiagnosisPeriodStart.Value < periodStart)
            return Ok(new { plan = "Premium", available = true, used = 0, limit = PremiumMonthlyLimit, remaining = PremiumMonthlyLimit, resetDate });

        var used = tenant.AiDiagnosisUsed;
        var remaining = Math.Max(0, PremiumMonthlyLimit - used);
        return Ok(new { plan = "Premium", available = remaining > 0, used, limit = PremiumMonthlyLimit, remaining, resetDate });
    }

    [HttpGet("{appointmentId}/ai-diagnosis")]
    public async Task<IActionResult> GetDiagnosis(Guid appointmentId)
    {
        var appointment = await _db.Appointments.FirstOrDefaultAsync(a => a.Id == appointmentId);
        if (appointment is null)
            return NotFound(new { message = "Cita no encontrada." });

        if (string.IsNullOrEmpty(appointment.AiDiagnosisJson))
            return NotFound(new { message = "No hay diagnóstico para esta cita." });

        return Content(appointment.AiDiagnosisJson, "application/json");
    }

    [HttpPost("{appointmentId}/ai-diagnosis")]
    [RequestSizeLimit(52_428_800)]
    public async Task<IActionResult> Diagnose(Guid appointmentId, [FromBody] AIDiagnosisRequestDto request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var tenantId = User.FindFirstValue("TenantId") ?? "";

        var tenant = await _db.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId);
        if (tenant is null || tenant.Plan == "Standard")
            return StatusCode(403, new { message = "Esta función requiere el plan Premium." });

        var appointment = await _db.Appointments
            .Include(a => a.Service)
            .FirstOrDefaultAsync(a => a.Id == appointmentId);

        if (appointment is null)
            return NotFound(new { message = "Cita no encontrada." });

        if (!string.IsNullOrEmpty(appointment.AiDiagnosisJson))
            return Conflict(new { message = "Ya se realizó un diagnóstico para esta cita." });

        // Enforce quota for Premium plan (PremiumUnlimited skips this block)
        if (tenant.Plan == "Premium")
        {
            var now = DateTime.UtcNow;
            var periodsElapsed = (int)Math.Floor((now - tenant.CreatedAt).TotalDays / 30);
            var periodStart = tenant.CreatedAt.AddDays(periodsElapsed * 30);
            var resetDate = tenant.CreatedAt.AddDays((periodsElapsed + 1) * 30);

            // Reset counter when a new billing period starts (anchored to CreatedAt)
            if (tenant.AiDiagnosisPeriodStart is null || tenant.AiDiagnosisPeriodStart.Value < periodStart)
            {
                tenant.AiDiagnosisUsed = 0;
                tenant.AiDiagnosisPeriodStart = periodStart;
            }

            if (tenant.AiDiagnosisUsed >= PremiumMonthlyLimit)
            {
                var daysLeft = (int)Math.Ceiling((resetDate - now).TotalDays);
                return StatusCode(403, new { message = $"Límite mensual de {PremiumMonthlyLimit} diagnósticos alcanzado. Se reinicia en {daysLeft} días." });
            }
        }

        try
        {
            var diagResult = await _aiService.GetHaircutDiagnosisAsync(request.ImageBase64);

            try
            {
                var analysisNode = JsonNode.Parse(diagResult.AnalysisJson);
                if (analysisNode is null)
                    return StatusCode(500, new { message = "El análisis IA devolvió una respuesta inválida." });

                var response = new JsonObject
                {
                    ["imageBase64"] = diagResult.ImageBase64,
                    ["imageUrl"] = diagResult.ImageUrl,
                    ["face"] = analysisNode["face"]?.DeepClone(),
                    ["styles"] = analysisNode["styles"]?.DeepClone(),
                    ["whyWorks"] = analysisNode["why_works"]?.DeepClone(),
                    ["products"] = analysisNode["products"]?.DeepClone(),
                    ["maintenance"] = analysisNode["maintenance"]?.GetValue<string>() ?? "",
                };

                var responseJson = response.ToJsonString();
                appointment.AiDiagnosisJson = responseJson;

                // Increment usage counter
                tenant.AiDiagnosisUsed += 1;

                await _db.SaveChangesAsync();

                return Content(responseJson, "application/json");
            }
            catch (JsonException)
            {
                return StatusCode(500, new { message = "El análisis IA devolvió una respuesta inválida. Intenta de nuevo." });
            }
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning("Diagnóstico IA rechazado: {Message}", ex.Message);
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error inesperado en diagnóstico IA");
            return StatusCode(500, new { message = "Error en el análisis IA. Intenta de nuevo." });
        }
    }
}
