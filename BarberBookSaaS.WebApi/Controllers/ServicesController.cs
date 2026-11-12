using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Services;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.WebApi.Common;

namespace BarberBookSaaS.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = $"{UserRoles.Admin},{UserRoles.Barber}")]
public class ServicesController : ControllerBase
{
    private readonly IServiceService _serviceService;

    public ServicesController(IServiceService serviceService)
    {
        _serviceService = serviceService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
        => Ok(await _serviceService.GetAllAsync());

    [HttpPost]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> Create([FromBody] CreateServiceDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var result = await _serviceService.CreateAsync(dto);
        return CreatedAtAction(nameof(GetAll), result);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateServiceDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var result = await _serviceService.UpdateAsync(id, dto);
        if (result is null) return NotFound(new { message = "Servicio no encontrado." });
        return Ok(result);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var cancelled = await _serviceService.DeleteAsync(id);
        if (cancelled is null) return NotFound(new { message = "Servicio no encontrado." });
        return Ok(new { cancelledAppointments = cancelled });
    }

    [HttpPut("{id}/activate")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> Activate(Guid id)
    {
        var success = await _serviceService.ActivateAsync(id);
        if (!success) return NotFound(new { message = "Servicio no encontrado." });
        return NoContent();
    }

    [HttpDelete("{id}/permanent")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> HardDelete(Guid id)
    {
        var result = await _serviceService.HardDeleteAsync(id);
        if (result is null) return NotFound(new { message = "Servicio no encontrado." });
        if (result is false) return Conflict(new { message = "No se puede eliminar: este servicio tiene citas registradas. Desactívalo en su lugar." });
        return NoContent();
    }

    [HttpPost("{id}/image")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> UploadImage(Guid id, IFormFile file)
    {
        var (base64, error) = await ImageUploadValidator.ValidateAndConvertAsync(file);
        if (error is not null) return BadRequest(error);

        var success = await _serviceService.UpdateImageAsync(id, base64!);
        if (!success) return NotFound(new { message = "Servicio no encontrado." });

        return Ok(new { imageBase64 = base64 });
    }
}
