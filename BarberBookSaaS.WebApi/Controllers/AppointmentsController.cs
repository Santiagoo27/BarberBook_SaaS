using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Appointments;
using BarberBookSaaS.Domain.Constants;

namespace BarberBookSaaS.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = $"{UserRoles.Admin},{UserRoles.Barber}")]
public class AppointmentsController : ControllerBase
{
    private readonly IAppointmentService _appointmentService;

    public AppointmentsController(IAppointmentService appointmentService)
    {
        _appointmentService = appointmentService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? status = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null)
    {
        if (status is not null && !AppointmentStatus.IsValid(status))
            return BadRequest(new { message = $"Estado inválido. Valores permitidos: {string.Join(", ", AppointmentStatus.All)}" });

        var role = User.FindFirstValue(ClaimTypes.Role);
        Guid? filterByUserId = null;
        if (role == UserRoles.Barber && Guid.TryParse(User.FindFirstValue("UserId"), out var uid))
            filterByUserId = uid;

        var result = await _appointmentService.GetAllAsync(page, pageSize, status, from, to, filterByUserId);
        return Ok(result);
    }

    [HttpGet("availability")]
    public async Task<IActionResult> GetAvailability(
        [FromQuery] Guid barberId,
        [FromQuery] Guid serviceId,
        [FromQuery] string date)
    {
        if (!DateOnly.TryParse(date, out var parsedDate))
            return BadRequest(new { message = "Formato de fecha inválido. Use YYYY-MM-DD." });

        var slots = await _appointmentService.GetAvailabilityAsync(barberId, serviceId, parsedDate);
        return Ok(slots);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateAppointmentDto request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var result = await _appointmentService.CreateAppointmentAsync(request);
        if (!result.Success)
        {
            var statusCode = result.ErrorCode == "SCHEDULE_CONFLICT"
                ? StatusCodes.Status409Conflict
                : StatusCodes.Status400BadRequest;
            return StatusCode(statusCode, new { errorCode = result.ErrorCode, message = result.ErrorMessage });
        }

        return Ok(result.Appointment);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var deleted = await _appointmentService.DeleteAsync(id);
        if (!deleted)
            return BadRequest(new { message = "Solo se pueden eliminar citas en estado Completada o Cancelada." });

        return NoContent();
    }

    [HttpPost("walk-in")]
    [Authorize(Roles = $"{UserRoles.Barber},{UserRoles.Admin}")]
    public async Task<IActionResult> CreateWalkIn([FromBody] CreateWalkInDto request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        if (!Guid.TryParse(User.FindFirstValue("UserId"), out var userId))
            return Unauthorized();

        var result = await _appointmentService.CreateWalkInAsync(request, userId);
        if (!result.Success)
            return BadRequest(new { errorCode = result.ErrorCode, message = result.ErrorMessage });

        return Ok(result.Appointment);
    }

    [HttpDelete("bulk")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> BulkDelete([FromBody] BulkDeleteAppointmentsDto request)
    {
        if (request.Ids is null || request.Ids.Count == 0)
            return BadRequest(new { message = "Debe enviar al menos un ID." });

        var ids = request.Ids.Select(id => Guid.TryParse(id, out var g) ? g : Guid.Empty)
                             .Where(g => g != Guid.Empty)
                             .ToList();

        var deleted = await _appointmentService.BulkDeleteAsync(ids);
        return Ok(new { deleted });
    }

    [HttpPut("{id}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateAppointmentStatusDto request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        string? cancelledBy = null;
        if (request.Status == AppointmentStatus.Cancelled)
        {
            var role = User.FindFirstValue(ClaimTypes.Role);
            cancelledBy = role == UserRoles.Barber ? "barber" : "admin";
        }

        var appointment = await _appointmentService.UpdateStatusAsync(id, request.Status, cancelledBy);
        if (appointment is null)
            return BadRequest(new { message = "Cita no encontrada o estado inválido." });

        return Ok(appointment);
    }
}

public class BulkDeleteAppointmentsDto
{
    public List<string> Ids { get; set; } = [];
}