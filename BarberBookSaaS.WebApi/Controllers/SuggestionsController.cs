using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;

namespace BarberBookSaaS.WebApi.Controllers;

[ApiController]
[Route("api/suggestions")]
[Authorize(Roles = UserRoles.Admin)]
public class SuggestionsController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public SuggestionsController(ApplicationDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var items = await _db.Suggestions
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();
        return Ok(items);
    }

    [HttpPut("{id:guid}/read")]
    public async Task<IActionResult> MarkAsRead(Guid id)
    {
        var item = await _db.Suggestions.FirstOrDefaultAsync(s => s.Id == id);
        if (item is null) return NotFound();
        item.Status = "Leída";
        await _db.SaveChangesAsync();
        return Ok(item);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var item = await _db.Suggestions.FirstOrDefaultAsync(s => s.Id == id);
        if (item is null) return NotFound();
        _db.Suggestions.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

[ApiController]
[Route("api/public/{subdomain}/suggestions")]
public class PublicSuggestionsController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public PublicSuggestionsController(ApplicationDbContext db) => _db = db;

    [HttpPost]
    [Authorize(Roles = UserRoles.Customer)]
    [EnableRateLimiting("public-review")]
    public async Task<IActionResult> Create(string subdomain, [FromBody] CreateSuggestionDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var jwtTenantId = User.FindFirstValue("TenantId");
        if (jwtTenantId != subdomain) return Forbid();

        var customerIdClaim = User.FindFirstValue("UserId");
        if (!Guid.TryParse(customerIdClaim, out var customerId))
            return Unauthorized();

        var customer = await _db.Customers
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == customerId && c.TenantId == subdomain);
        if (customer is null) return NotFound(new { message = "Cliente no encontrado." });

        var suggestion = new Suggestion
        {
            TenantId = subdomain,
            CustomerId = customerId,
            CustomerName = customer.Name,
            Type = dto.Type == "queja" ? "queja" : "sugerencia",
            Message = dto.Message.Trim(),
        };

        _db.Suggestions.Add(suggestion);
        await _db.SaveChangesAsync();

        return Ok(new { message = "¡Gracias por tu comentario!", suggestionId = suggestion.Id });
    }
}

public class CreateSuggestionDto
{
    [Required]
    [RegularExpression("^(queja|sugerencia)$")]
    public string Type { get; set; } = "sugerencia";

    [Required]
    [StringLength(1000, MinimumLength = 10)]
    public string Message { get; set; } = string.Empty;
}
