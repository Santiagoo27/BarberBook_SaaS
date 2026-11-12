using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Barbers;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.WebApi.Common;

namespace BarberBookSaaS.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = $"{UserRoles.Admin},{UserRoles.Barber}")]
public class BarbersController : ControllerBase
{
    private readonly IBarberService _barberService;

    public BarbersController(IBarberService barberService)
    {
        _barberService = barberService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
        => Ok(await _barberService.GetAllAsync());

    [HttpGet("me")]
    [Authorize(Roles = UserRoles.Barber)]
    public async Task<IActionResult> GetMe()
    {
        var userIdClaim = User.FindFirst("UserId")?.Value;
        if (userIdClaim is null || !Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        var barber = await _barberService.GetByUserIdAsync(userId);
        if (barber is null) return NotFound(new { message = "Perfil de barbero no encontrado." });

        return Ok(new { barber.Id, barber.Name, barber.Email, barber.Phone, barber.Specialty, barber.ImageBase64 });
    }

    [HttpPost]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> Create([FromBody] CreateBarberDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        try
        {
            var result = await _barberService.CreateAsync(dto);
            return CreatedAtAction(nameof(GetAll), result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPut("{id}")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateBarberDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var result = await _barberService.UpdateAsync(id, dto);
        if (result is null) return NotFound(new { message = "Barbero no encontrado." });
        return Ok(result);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var cancelled = await _barberService.DeleteAsync(id);
        if (cancelled is null) return NotFound(new { message = "Barbero no encontrado." });
        return Ok(new { cancelledAppointments = cancelled });
    }

    [HttpPut("{id}/activate")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> Activate(Guid id)
    {
        var success = await _barberService.ActivateAsync(id);
        if (!success) return NotFound(new { message = "Barbero no encontrado." });
        return NoContent();
    }

    [HttpDelete("{id}/permanent")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> HardDelete(Guid id)
    {
        var result = await _barberService.HardDeleteAsync(id);
        if (result is null) return NotFound(new { message = "Barbero no encontrado." });
        if (result is false) return Conflict(new { message = "No se puede eliminar: este barbero tiene citas registradas. Desactívalo en su lugar." });
        return NoContent();
    }

    [HttpPost("{id}/image")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> UploadImage(Guid id, IFormFile file)
    {
        var (base64, error) = await ImageUploadValidator.ValidateAndConvertAsync(file);
        if (error is not null) return BadRequest(error);

        var success = await _barberService.UpdateImageAsync(id, base64!);
        if (!success) return NotFound(new { message = "Barbero no encontrado." });

        return Ok(new { imageBase64 = base64 });
    }

    [HttpGet("{id}/schedule")]
    [Authorize(Roles = $"{UserRoles.Admin},{UserRoles.Barber}")]
    public async Task<IActionResult> GetSchedule(Guid id)
        => Ok(await _barberService.GetScheduleAsync(id));

    [HttpPost("{id}/schedule")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> UpsertScheduleDay(Guid id, [FromBody] BarberScheduleDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        await _barberService.UpsertScheduleDayAsync(id, dto);
        return NoContent();
    }

    [HttpDelete("{id}/schedule/{day}")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> DeleteScheduleDay(Guid id, int day)
    {
        await _barberService.DeleteScheduleDayAsync(id, day);
        return NoContent();
    }
}
