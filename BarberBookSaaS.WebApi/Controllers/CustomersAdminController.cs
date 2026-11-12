using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs;
using BarberBookSaaS.Application.DTOs.Customers;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Infrastructure.Persistence;

namespace BarberBookSaaS.WebApi.Controllers;

[ApiController]
[Route("api/customers")]
[Authorize(Roles = UserRoles.Admin)]
public class CustomersAdminController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ITenantService _tenantService;

    public CustomersAdminController(ApplicationDbContext context, ITenantService tenantService)
    {
        _context = context;
        _tenantService = tenantService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var tenantId = _tenantService.TenantId;

        var query = _context.Customers
            .Where(c => c.TenantId == tenantId)
            .OrderByDescending(c => c.CreatedAt);

        var total = await query.CountAsync();

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new CustomerListItemDto
            {
                Id           = c.Id,
                Name         = c.Name,
                Phone        = c.Phone,
                Email        = c.Email,
                LoyaltyCount = c.LoyaltyCount,
                CreatedAt    = c.CreatedAt,
            })
            .ToListAsync();

        return Ok(new PagedResult<CustomerListItemDto>
        {
            Data     = items,
            Total    = total,
            Page     = page,
            PageSize = pageSize,
        });
    }
}