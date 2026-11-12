using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs;
using BarberBookSaaS.Application.DTOs.Auth;
using BarberBookSaaS.Application.DTOs.SuperAdmin;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Infrastructure.Persistence;

namespace BarberBookSaaS.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = UserRoles.SuperAdmin)]
public class SuperAdminController : ControllerBase
{
    private readonly ISuperAdminService _superAdminService;
    private readonly ApplicationDbContext _db;
    private readonly IAIService _aiService;

    public SuperAdminController(ISuperAdminService superAdminService, ApplicationDbContext db, IAIService aiService)
    {
        _superAdminService = superAdminService;
        _db = db;
        _aiService = aiService;
    }

    [HttpGet("tenants")]
    public async Task<IActionResult> ListTenants()
    {
        var tenants = await _superAdminService.ListTenantsAsync();
        return Ok(tenants);
    }

    [HttpPost("tenants")]
    public async Task<IActionResult> CreateTenant([FromBody] RegisterTenantDto request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var temporaryPassword = await _superAdminService.CreateTenantAsync(request);
        if (temporaryPassword is null)
            return BadRequest(new { message = "El subdominio ya está registrado." });

        return Ok(new { message = "Barbería creada exitosamente.", temporaryPassword });
    }

    [HttpPut("tenants/{id}/plan")]
    public async Task<IActionResult> UpdatePlan(string id, [FromBody] UpdateTenantPlanDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var ok = await _superAdminService.UpdatePlanAsync(id, dto.Plan);
        if (!ok) return NotFound(new { message = "Barbería no encontrada." });
        return Ok(new { message = "Plan actualizado.", plan = dto.Plan });
    }

    [HttpPut("tenants/{id}/status")]
    public async Task<IActionResult> UpdateStatus(string id, [FromBody] UpdateTenantStatusDto dto)
    {
        var ok = await _superAdminService.UpdateStatusAsync(id, dto.IsWebActive);
        if (!ok) return NotFound(new { message = "Barbería no encontrada." });
        return Ok(new { message = dto.IsWebActive ? "Barbería activada." : "Barbería suspendida.", isWebActive = dto.IsWebActive });
    }

    [HttpDelete("tenants/{id}")]
    public async Task<IActionResult> DeleteTenant(string id)
    {
        var ok = await _superAdminService.DeleteTenantAsync(id);
        if (!ok) return NotFound(new { message = "Barbería no encontrada." });
        return Ok(new { message = "Barbería eliminada." });
    }

    [HttpGet("tenants/{id}/diagnoses")]
    public async Task<IActionResult> GetDiagnoses(string id)
    {
        var items = await _db.Appointments
            .IgnoreQueryFilters()
            .Where(a => a.TenantId == id && a.AiDiagnosisJson != null)
            .OrderByDescending(a => a.AppointmentDate)
            .Select(a => new
            {
                a.Id,
                a.CustomerName,
                a.AppointmentDate,
                a.AiDiagnosisJson,
            })
            .ToListAsync();
        return Ok(items);
    }

    [HttpPost("test-diagnosis")]
    [RequestSizeLimit(52_428_800)]
    public async Task<IActionResult> TestDiagnosis([FromBody] AIDiagnosisRequestDto request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        try
        {
            var result = await _aiService.GetHaircutDiagnosisAsync(request.ImageBase64);
            var analysisNode = System.Text.Json.Nodes.JsonNode.Parse(result.AnalysisJson);
            var response = new System.Text.Json.Nodes.JsonObject
            {
                ["imageBase64"] = result.ImageBase64,
                ["imageUrl"] = result.ImageUrl,
                ["face"] = analysisNode?["face"]?.DeepClone(),
                ["styles"] = analysisNode?["styles"]?.DeepClone(),
                ["whyWorks"] = analysisNode?["why_works"]?.DeepClone(),
                ["products"] = analysisNode?["products"]?.DeepClone(),
                ["maintenance"] = analysisNode?["maintenance"]?.GetValue<string>() ?? "",
            };
            return Content(response.ToJsonString(), "application/json");
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpGet("my-diagnoses")]
    public async Task<IActionResult> GetMyDiagnoses()
    {
        var items = await _db.SuperAdminDiagnoses
            .OrderByDescending(d => d.CreatedAt)
            .Select(d => new { d.Id, d.Label, d.CreatedAt })
            .ToListAsync();
        return Ok(items);
    }

    [HttpGet("my-diagnoses/{id:guid}")]
    public async Task<IActionResult> GetMyDiagnosis(Guid id)
    {
        var item = await _db.SuperAdminDiagnoses.FindAsync(id);
        if (item is null) return NotFound();
        return Content(item.ResultJson, "application/json");
    }

    [HttpPost("my-diagnoses")]
    public async Task<IActionResult> SaveMyDiagnosis([FromBody] SaveDiagnosisDto dto)
    {
        var entity = new Domain.Entities.SuperAdminDiagnosis
        {
            Id = Guid.NewGuid(),
            Label = dto.Label,
            ResultJson = dto.ResultJson,
        };
        _db.SuperAdminDiagnoses.Add(entity);
        await _db.SaveChangesAsync();
        return Ok(new { id = entity.Id });
    }

    [HttpDelete("my-diagnoses/{id:guid}")]
    public async Task<IActionResult> DeleteMyDiagnosis(Guid id)
    {
        var item = await _db.SuperAdminDiagnoses.FindAsync(id);
        if (item is null) return NotFound();
        _db.SuperAdminDiagnoses.Remove(item);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Eliminado." });
    }

    [HttpDelete("diagnoses/{appointmentId:guid}")]
    public async Task<IActionResult> DeleteDiagnosis(Guid appointmentId)
    {
        var appt = await _db.Appointments
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(a => a.Id == appointmentId);
        if (appt is null) return NotFound();
        appt.AiDiagnosisJson = null;
        await _db.SaveChangesAsync();
        return Ok(new { message = "Diagnóstico eliminado." });
    }
}

public class SaveDiagnosisDto
{
    public string Label { get; set; } = string.Empty;
    public string ResultJson { get; set; } = string.Empty;
}
