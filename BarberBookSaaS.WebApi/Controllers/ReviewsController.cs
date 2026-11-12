using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Infrastructure.Persistence;

namespace BarberBookSaaS.WebApi.Controllers;

[ApiController]
[Route("api/tenant/reviews")]
[Authorize(Roles = UserRoles.Admin)]
public class ReviewsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public ReviewsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetReviews(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int limit = 50)
    {
        var query = _context.Reviews.AsQueryable();

        if (from.HasValue)
            query = query.Where(r => r.CreatedAt >= from.Value);
        if (to.HasValue)
            query = query.Where(r => r.CreatedAt <= to.Value);

        var reviews = await query
            .OrderByDescending(r => r.CreatedAt)
            .Take(Math.Min(limit, 200))
            .Select(r => new
            {
                r.Id,
                r.Rating,
                r.Comment,
                r.AppointmentId,
                r.CreatedAt,
            })
            .ToListAsync();

        var total = await _context.Reviews.CountAsync();
        var avg = total > 0
            ? Math.Round(await _context.Reviews.AverageAsync(r => (double)r.Rating), 1)
            : 0.0;

        return Ok(new { reviews, averageRating = avg, totalReviews = total });
    }
}
