using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Locations;
using BarberBookSaaS.Domain.Constants;

namespace BarberBookSaaS.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class LocationsController : ControllerBase
{
    private readonly ILocationService _locationService;

    public LocationsController(ILocationService locationService)
    {
        _locationService = locationService;
    }

    [HttpGet]
    [Authorize(Roles = $"{UserRoles.Admin},{UserRoles.Barber},{UserRoles.SuperAdmin}")]
    public async Task<IActionResult> GetAll()
        => Ok(await _locationService.GetAllAsync());

    [HttpGet("{id}")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var location = await _locationService.GetByIdAsync(id);
        if (location is null) return NotFound(new { message = "Sede no encontrada." });
        return Ok(location);
    }

    [HttpPost]
    [Authorize(Roles = UserRoles.SuperAdmin)]
    public async Task<IActionResult> Create([FromBody] CreateLocationDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var result = await _locationService.CreateAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateLocationDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var result = await _locationService.UpdateAsync(id, dto);
        if (result is null) return NotFound(new { message = "Sede no encontrada." });
        return Ok(result);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = UserRoles.SuperAdmin)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var success = await _locationService.DeleteAsync(id);
        if (!success) return NotFound(new { message = "Sede no encontrada." });
        return NoContent();
    }

    [HttpPost("{id}/barbers")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> AssignBarber(Guid id, [FromBody] AssignBarberDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var location = await _locationService.GetByIdAsync(id);
        if (location is null) return NotFound(new { message = "Sede no encontrada." });

        var success = await _locationService.AssignBarberAsync(id, dto.BarberId);
        if (!success) return BadRequest(new { message = "El barbero no existe o no pertenece a esta barbería." });

        return NoContent();
    }

    [HttpDelete("{id}/barbers/{barberId}")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> RemoveBarber(Guid id, Guid barberId)
    {
        var location = await _locationService.GetByIdAsync(id);
        if (location is null) return NotFound(new { message = "Sede no encontrada." });

        var success = await _locationService.RemoveBarberAsync(id, barberId);
        if (!success) return NotFound(new { message = "El barbero no está asignado a esta sede." });

        return NoContent();
    }

    [HttpPost("{id}/services")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> AssignService(Guid id, [FromBody] AssignServiceDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var location = await _locationService.GetByIdAsync(id);
        if (location is null) return NotFound(new { message = "Sede no encontrada." });

        var success = await _locationService.AssignServiceAsync(id, dto.ServiceId);
        if (!success) return BadRequest(new { message = "El servicio no existe o no pertenece a esta barbería." });

        return NoContent();
    }

    [HttpDelete("{id}/services/{serviceId}")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> RemoveService(Guid id, Guid serviceId)
    {
        var location = await _locationService.GetByIdAsync(id);
        if (location is null) return NotFound(new { message = "Sede no encontrada." });

        var success = await _locationService.RemoveServiceAsync(id, serviceId);
        if (!success) return NotFound(new { message = "El servicio no está asignado a esta sede." });

        return NoContent();
    }
}
