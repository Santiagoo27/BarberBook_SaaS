using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Tenant;
using BarberBookSaaS.Domain.Constants;

namespace BarberBookSaaS.WebApi.Controllers;

[ApiController]
[Route("api/tenant/loyalty")]
public class LoyaltyController : ControllerBase
{
    private readonly ILoyaltyService _loyaltyService;

    public LoyaltyController(ILoyaltyService loyaltyService)
    {
        _loyaltyService = loyaltyService;
    }

    [HttpGet]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> GetConfig()
    {
        var config = await _loyaltyService.GetLoyaltyConfigAsync();
        if (config is null) return NotFound();
        return Ok(config);
    }

    [HttpPut]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> UpdateConfig([FromBody] UpdateLoyaltyDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var success = await _loyaltyService.UpdateLoyaltyConfigAsync(dto);
        if (!success) return NotFound();
        return NoContent();
    }

    [HttpPost("award")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> AwardPoints([FromBody] AwardLoyaltyDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var success = await _loyaltyService.AwardLoyaltyAsync(dto);
        if (!success) return NotFound(new { message = "Cliente no encontrado." });
        return NoContent();
    }
}
