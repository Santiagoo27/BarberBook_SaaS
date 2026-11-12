using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Appointments;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Infrastructure.Persistence;

namespace BarberBookSaaS.WebApi.Controllers;

[ApiController]
[Route("api/public/reschedule")]
public class AppointmentRescheduleLinkController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IAppointmentTokenService _tokenService;
    private readonly IAppointmentService _appointmentService;
    private readonly ITenantService _tenantService;
    private readonly ILogger<AppointmentRescheduleLinkController> _logger;

    public AppointmentRescheduleLinkController(
        ApplicationDbContext context,
        IAppointmentTokenService tokenService,
        IAppointmentService appointmentService,
        ITenantService tenantService,
        ILogger<AppointmentRescheduleLinkController> logger)
    {
        _context = context;
        _tokenService = tokenService;
        _appointmentService = appointmentService;
        _tenantService = tenantService;
        _logger = logger;
    }

    [HttpGet("{token}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetAppointment(string token)
    {
        if (token.StartsWith("{{1}}"))
            token = token["{{1}}".Length..];
        _logger.LogInformation("[Reschedule] Token recibido: {Token} (length={Length})", token, token?.Length);
        var appointmentId = _tokenService.ValidateToken(token);
        _logger.LogInformation("[Reschedule] ValidateToken result: {Result}", appointmentId?.ToString() ?? "NULL (token inválido o expirado)");
        if (appointmentId is null)
            return NotFound(new { message = "Este enlace no es válido o ha expirado." });

        var appointment = await _context.Appointments
            .IgnoreQueryFilters()
            .Include(a => a.Barber)
            .Include(a => a.Service)
            .FirstOrDefaultAsync(a => a.Id == appointmentId.Value);

        if (appointment is null)
            return NotFound(new { message = "Este enlace no es válido o ha expirado." });

        var tenant = await _context.Tenants.FindAsync(appointment.TenantId);
        if (tenant is null)
            return NotFound(new { message = "Este enlace no es válido o ha expirado." });

        var colombiaNow = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(-5)).DateTime;
        var canReschedule = appointment.Status == AppointmentStatus.Pending
            && (appointment.AppointmentDate - colombiaNow) > TimeSpan.FromHours(1)
            && appointment.RescheduleTokenUsedAt is null;

        _logger.LogInformation("[Reschedule] canReschedule={Can}, Status={Status}, AppDate={AppDate}, ColombiaNow={Now}, Diff={Diff}h, TokenUsed={Used}",
            canReschedule, appointment.Status, appointment.AppointmentDate, colombiaNow,
            (appointment.AppointmentDate - colombiaNow).TotalHours, appointment.RescheduleTokenUsedAt);

        return Ok(new TokenAppointmentDto
        {
            Subdomain      = appointment.TenantId,
            TenantName     = tenant.Name,
            Theme          = tenant.Theme,
            PrimaryColor   = tenant.PrimaryColor,
            SecondaryColor = tenant.SecondaryColor,
            LogoBase64     = tenant.LogoBase64,
            LogoUrl        = tenant.LogoUrl,
            AppointmentId  = appointment.Id,
            BarberId       = appointment.BarberId,
            ServiceId      = appointment.ServiceId,
            BarberName     = appointment.Barber?.Name ?? string.Empty,
            ServiceName    = appointment.Service?.Name ?? string.Empty,
            AppointmentDate = appointment.AppointmentDate,
            Status         = appointment.Status,
            CanReschedule  = canReschedule
        });
    }

    [HttpPut("{token}")]
    [AllowAnonymous]
    public async Task<IActionResult> RescheduleAppointment(string token, [FromBody] RescheduleAppointmentDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        if (token.StartsWith("{{1}}"))
            token = token["{{1}}".Length..];

        var appointmentId = _tokenService.ValidateToken(token);
        if (appointmentId is null)
            return NotFound(new { message = "Este enlace no es válido o ha expirado." });

        var appointment = await _context.Appointments
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(a => a.Id == appointmentId.Value);

        if (appointment is null)
            return NotFound(new { message = "Este enlace no es válido o ha expirado." });

        if (appointment.RescheduleTokenUsedAt is not null)
            return BadRequest(new { errorCode = "TOKEN_USED", message = "Este enlace de reprogramación ya fue utilizado. Contacta a la barbería para obtener uno nuevo." });

        _tenantService.TenantId = appointment.TenantId;

        _logger.LogInformation("[Reschedule PUT] Reprogramando cita {Id} de {Old} a {New}",
            appointmentId.Value, appointment.AppointmentDate, dto.NewAppointmentDate);

        RescheduleResult result;
        try
        {
            result = await _appointmentService.RescheduleAppointmentAsync(appointmentId.Value, dto.NewAppointmentDate);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Reschedule PUT] Error inesperado al reprogramar cita {Id}", appointmentId.Value);
            return StatusCode(500, new { message = "Error interno al reprogramar la cita." });
        }

        if (!result.Success)
        {
            _logger.LogWarning("[Reschedule PUT] Fallo: {Code} — {Msg}", result.ErrorCode, result.ErrorMessage);
            return result.ErrorCode switch
            {
                "NOT_FOUND" => NotFound(new { message = result.ErrorMessage }),
                "SCHEDULE_CONFLICT" => StatusCode(StatusCodes.Status409Conflict,
                    new { errorCode = result.ErrorCode, message = result.ErrorMessage }),
                _ => BadRequest(new { errorCode = result.ErrorCode, message = result.ErrorMessage }),
            };
        }

        appointment.RescheduleTokenUsedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new
        {
            appointmentId = result.Appointment!.Id,
            appointmentDate = result.Appointment.AppointmentDate,
            status = result.Appointment.Status,
            message = "Cita reprogramada correctamente."
        });
    }
}
