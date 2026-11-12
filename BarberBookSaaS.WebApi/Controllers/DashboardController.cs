using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Domain.Constants;

namespace BarberBookSaaS.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = $"{UserRoles.Admin},{UserRoles.Barber}")]
public class DashboardController : ControllerBase
{
    private readonly IDashboardService _dashboardService;

    public DashboardController(IDashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats([FromQuery] Guid? locationId = null)
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        Guid? filterByUserId = null;
        if (role == UserRoles.Barber && Guid.TryParse(User.FindFirstValue("UserId"), out var uid))
            filterByUserId = uid;

        return Ok(await _dashboardService.GetStatsAsync(filterByUserId, locationId));
    }

    [HttpGet("weekly-revenue")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> GetWeeklyRevenue(
        [FromQuery] Guid? locationId = null,
        [FromQuery] int days = 7)
    {
        if (days != 7 && days != 15 && days != 30)
            return BadRequest("days must be 7, 15, or 30");

        return Ok(await _dashboardService.GetWeeklyRevenueAsync(locationId, days));
    }

    [HttpGet("period-stats")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> GetPeriodStats(
        [FromQuery] int days,
        [FromQuery] Guid? locationId = null)
    {
        if (days != 7 && days != 15 && days != 30)
            return BadRequest("days must be 7, 15, or 30");

        return Ok(await _dashboardService.GetPeriodStatsAsync(days, locationId));
    }

    [HttpGet("barber-earnings")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> GetBarberEarnings(
        [FromQuery] int days = 7,
        [FromQuery] Guid? locationId = null)
    {
        if (days != 7 && days != 15 && days != 30)
            return BadRequest("days must be 7, 15, or 30");

        return Ok(await _dashboardService.GetBarberEarningsAsync(days, locationId));
    }
}
