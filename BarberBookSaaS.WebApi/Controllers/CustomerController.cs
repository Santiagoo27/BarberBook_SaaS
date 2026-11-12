using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Customers;
using BarberBookSaaS.Infrastructure.Persistence;
using BarberBookSaaS.Domain.Constants;

namespace BarberBookSaaS.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = UserRoles.Customer)]
public class CustomerController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ITenantService _tenantService;

    public CustomerController(ApplicationDbContext context, ITenantService tenantService)
    {
        _context = context;
        _tenantService = tenantService;
    }

    [HttpGet("appointments")]
    public async Task<IActionResult> GetAppointments()
    {
        var customerIdClaim = User.FindFirstValue("UserId");
        if (!Guid.TryParse(customerIdClaim, out var customerId))
            return Unauthorized();

        var tenantId = _tenantService.TenantId;

        var appointments = await _context.Appointments
            .Include(a => a.Barber)
            .Include(a => a.Service)
            .Where(a => a.CustomerId == customerId && a.TenantId == tenantId)
            .OrderByDescending(a => a.AppointmentDate)
            .Select(a => new CustomerAppointmentDto
            {
                Id             = a.Id,
                BarberId       = a.BarberId,
                ServiceId      = a.ServiceId,
                BarberName     = a.Barber != null ? a.Barber.Name : string.Empty,
                ServiceName    = a.Service != null ? a.Service.Name : string.Empty,
                ServicePrice   = a.Service != null ? a.Service.Price : 0,
                AppointmentDate = a.AppointmentDate,
                Status         = a.Status,
                IsFree         = a.IsFree,
                CancelledBy    = a.CancelledBy,
                WasRescheduled = a.RescheduleTokenUsedAt != null
            })
            .ToListAsync();

        return Ok(appointments);
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMe()
    {
        var customerIdClaim = User.FindFirstValue("UserId");
        if (!Guid.TryParse(customerIdClaim, out var customerId))
            return Unauthorized();

        var customer = await _context.Customers
            .FirstOrDefaultAsync(c => c.Id == customerId);
        if (customer is null || customer.TenantId != _tenantService.TenantId)
            return NotFound();

        var tenant = await _context.Tenants.FindAsync(customer.TenantId);

        string? rewardServiceName = null;
        if (tenant?.LoyaltyRewardServiceId is not null)
        {
            rewardServiceName = await _context.Services
                .Where(s => s.Id == tenant.LoyaltyRewardServiceId.Value && s.TenantId == tenant.Id)
                .Select(s => s.Name)
                .FirstOrDefaultAsync();
        }

        return Ok(new CustomerMeDto
        {
            Name = customer.Name,
            Phone = customer.Phone,
            LoyaltyCount = customer.LoyaltyCount,
            LoyaltyThreshold = tenant?.LoyaltyThreshold ?? 10,
            LoyaltyEnabled = tenant?.LoyaltyEnabled ?? false,
            LoyaltyRewardServiceId = tenant?.LoyaltyRewardServiceId,
            LoyaltyRewardServiceName = rewardServiceName
        });
    }
}
