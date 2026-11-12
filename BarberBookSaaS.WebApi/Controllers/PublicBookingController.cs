using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Appointments;
using BarberBookSaaS.Application.DTOs.Auth;
using BarberBookSaaS.Application.DTOs.Customers;
using BarberBookSaaS.Application.DTOs.Reviews;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;

namespace BarberBookSaaS.WebApi.Controllers;

[ApiController]
[Route("api/public/{subdomain}")]
public class PublicBookingController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICustomerAuthService _customerAuthService;
    private readonly IAppointmentService _appointmentService;
    private readonly ITenantService _tenantService;
    private readonly IConfiguration _config;
    private readonly IWhatsAppService _whatsAppService;
    private readonly ILocationService _locationService;

    public PublicBookingController(
        ApplicationDbContext context,
        ICustomerAuthService customerAuthService,
        IAppointmentService appointmentService,
        ITenantService tenantService,
        IConfiguration config,
        IWhatsAppService whatsAppService,
        ILocationService locationService)
    {
        _context = context;
        _customerAuthService = customerAuthService;
        _appointmentService = appointmentService;
        _tenantService = tenantService;
        _config = config;
        _whatsAppService = whatsAppService;
        _locationService = locationService;
    }

    [HttpGet("locations")]
    [AllowAnonymous]
    public async Task<IActionResult> GetLocations(string subdomain)
    {
        var tenantExists = await _context.Tenants.AnyAsync(t => t.Id == subdomain);
        if (!tenantExists) return NotFound(new { message = "Barbería no encontrada." });

        _tenantService.TenantId = subdomain;

        var locations = await _locationService.GetPublicLocationsAsync(subdomain);
        return Ok(locations);
    }

    [HttpGet("barbers")]
    [AllowAnonymous]
    public async Task<IActionResult> GetBarbers(string subdomain, [FromQuery] Guid? locationId = null)
    {
        var tenantExists = await _context.Tenants.AnyAsync(t => t.Id == subdomain);
        if (!tenantExists) return NotFound(new { message = "Barbería no encontrada." });

        var query = _context.Barbers
            .IgnoreQueryFilters()
            .Where(b => b.TenantId == subdomain && b.IsActive);

        if (locationId.HasValue)
            query = query.Where(b => b.LocationId == locationId.Value);

        var barbers = await query
            .Select(b => new { b.Id, b.Name, b.Specialty, b.ImageBase64 })
            .ToListAsync();

        return Ok(barbers);
    }

    [HttpGet("services")]
    [AllowAnonymous]
    public async Task<IActionResult> GetServices(string subdomain, [FromQuery] Guid? locationId = null)
    {
        var tenantExists = await _context.Tenants.AnyAsync(t => t.Id == subdomain);
        if (!tenantExists) return NotFound(new { message = "Barbería no encontrada." });

        var query = _context.Services
            .IgnoreQueryFilters()
            .Where(s => s.TenantId == subdomain && s.IsActive);

        if (locationId.HasValue)
            query = query.Where(s => _context.LocationServices.Any(ls => ls.LocationId == locationId.Value && ls.ServiceId == s.Id));

        var services = await query.ToListAsync();

        return Ok(services);
    }

    [HttpGet("availability")]
    [AllowAnonymous]
    public async Task<IActionResult> GetAvailability(
        string subdomain,
        [FromQuery] Guid barberId,
        [FromQuery] Guid serviceId,
        [FromQuery] string date,
        [FromQuery] Guid? excludeAppointmentId = null,
        [FromQuery] Guid? locationId = null)
    {
        if (!DateOnly.TryParse(date, out var parsedDate))
            return BadRequest(new { message = "Formato de fecha inválido. Use YYYY-MM-DD." });

        var tenantExists = await _context.Tenants.AnyAsync(t => t.Id == subdomain);
        if (!tenantExists) return NotFound(new { message = "Barbería no encontrada." });

        _tenantService.TenantId = subdomain;

        var slots = await _appointmentService.GetAvailabilityAsync(barberId, serviceId, parsedDate, minimumLeadHours: 3, excludeAppointmentId: excludeAppointmentId, locationId: locationId);
        return Ok(slots);
    }

    [HttpPost("auth/register")]
    [AllowAnonymous]
    [EnableRateLimiting("public-register")]
    public async Task<IActionResult> RegisterCustomer(string subdomain, [FromBody] RegisterCustomerDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var result = await _customerAuthService.RegisterAsync(subdomain, dto);
        if (result is null)
            return BadRequest(new { message = "El teléfono ya está registrado en esta barbería o la barbería no existe." });

        return Ok(result);
    }

    [HttpPost("auth/login")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> LoginCustomer(string subdomain, [FromBody] LoginCustomerDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var result = await _customerAuthService.LoginAsync(subdomain, dto);
        if (result is null)
            return Unauthorized(new { message = "Teléfono o contraseña incorrectos." });

        return Ok(result);
    }

    [HttpPost("auth/forgot-password")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ForgotPasswordCustomer(string subdomain, [FromBody] ForgotPasswordByPhoneDto request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var frontendBase = _config["FrontendBaseUrl"] ?? "http://localhost:5173";
        await _customerAuthService.ForgotPasswordByPhoneAsync(subdomain, request.Phone, frontendBase);

        return Ok(new { message = "Si el número está registrado, recibirás un mensaje de WhatsApp para restablecer tu contraseña." });
    }

    [HttpPost("auth/reset-password")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ResetPasswordCustomer([FromBody] ResetPasswordDto request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var success = await _customerAuthService.ResetPasswordAsync(request.Token, request.NewPassword);
        if (!success)
            return BadRequest(new { message = "El enlace es inválido o ha expirado." });

        return Ok(new { message = "Contraseña actualizada correctamente." });
    }

    [HttpPost("auth/refresh")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> RefreshCustomerToken([FromBody] string refreshToken)
    {
        if (string.IsNullOrEmpty(refreshToken))
            return BadRequest(new { message = "Refresh token requerido." });

        var result = await _customerAuthService.RefreshTokenAsync(refreshToken);
        if (result is null)
            return Unauthorized(new { message = "Refresh token inválido o expirado." });

        return Ok(result);
    }

    [HttpPost("appointments")]
    [Authorize(Roles = UserRoles.Customer)]
    public async Task<IActionResult> CreateAppointment(
        string subdomain,
        [FromBody] PublicCreateAppointmentDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var colombiaNow = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(-5)).DateTime;
        if (dto.AppointmentDate < colombiaNow.AddHours(3))
            return BadRequest(new { errorCode = "TOO_SOON", message = "Las citas deben agendarse con al menos 3 horas de antelación." });

        var jwtTenantId = User.FindFirstValue("TenantId");
        if (jwtTenantId != subdomain)
            return Forbid();

        var customerIdClaim = User.FindFirstValue("UserId");
        if (!Guid.TryParse(customerIdClaim, out var customerId))
            return Unauthorized();

        var customer = await _context.Customers
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == customerId && c.TenantId == subdomain);
        if (customer is null)
            return NotFound(new { message = "Cliente no encontrado." });

        // Fetch tenant before first SaveChanges so that nothing between the two saves can throw
        var tenant = await _context.Tenants.FindAsync(subdomain);

        var createDto = new CreateAppointmentDto
        {
            BarberId = dto.BarberId,
            ServiceId = dto.ServiceId,
            CustomerName = customer.Name,
            CustomerPhone = customer.Phone,
            AppointmentDate = dto.AppointmentDate,
            LocationId = dto.LocationId
        };

        var result = await _appointmentService.CreateAppointmentAsync(createDto);
        if (!result.Success)
        {
            var statusCode = result.ErrorCode == "SCHEDULE_CONFLICT"
                ? StatusCodes.Status409Conflict
                : StatusCodes.Status400BadRequest;
            return StatusCode(statusCode, new { errorCode = result.ErrorCode, message = result.ErrorMessage });
        }

        var appointment = result.Appointment!;

        // In-memory mutations only — cannot throw between save 1 and save 2
        appointment.CustomerId = customerId;

        if (tenant is not null && tenant.LoyaltyEnabled && tenant.LoyaltyRewardServiceId.HasValue)
        {
            if (customer.LoyaltyCount >= tenant.LoyaltyThreshold
                && appointment.ServiceId == tenant.LoyaltyRewardServiceId.Value)
            {
                appointment.IsFree = true;
                customer.LoyaltyCount = 0;
            }
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            appointmentId = appointment.Id,
            barberId = appointment.BarberId,
            serviceId = appointment.ServiceId,
            appointmentDate = appointment.AppointmentDate,
            status = appointment.Status,
            isFree = appointment.IsFree,
            loyaltyCount = customer.LoyaltyCount
        });
    }

    [HttpDelete("appointments/{id:guid}")]
    [Authorize(Roles = UserRoles.Customer)]
    public async Task<IActionResult> CancelAppointment(string subdomain, Guid id)
    {
        var jwtTenantId = User.FindFirstValue("TenantId");
        if (jwtTenantId != subdomain)
            return Forbid();

        var customerIdClaim = User.FindFirstValue("UserId");
        if (!Guid.TryParse(customerIdClaim, out var customerId))
            return Unauthorized();

        var appointment = await _context.Appointments
            .IgnoreQueryFilters()
            .Include(a => a.Barber)
            .FirstOrDefaultAsync(a => a.Id == id && a.TenantId == subdomain);

        if (appointment is null)
            return NotFound(new { message = "Cita no encontrada." });

        if (appointment.CustomerId != customerId)
            return Forbid();

        if (appointment.Status != Domain.Constants.AppointmentStatus.Pending)
            return BadRequest(new { message = "Solo se pueden cancelar citas en estado Pendiente." });

        var colombiaNow = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(-5)).DateTime;
        if ((appointment.AppointmentDate - colombiaNow).TotalMinutes <= 60)
            return BadRequest(new { message = "No es posible cancelar con menos de 1 hora de antelación." });

        appointment.Status = Domain.Constants.AppointmentStatus.Cancelled;
        appointment.CancelledAt = DateTime.UtcNow;
        appointment.CancelledBy = "customer";

        await _context.SaveChangesAsync();

        var tenant = await _context.Tenants.FindAsync(subdomain);
        if (tenant is { WhatsAppEnabled: true } && !string.IsNullOrWhiteSpace(appointment.CustomerPhone))
        {
            await _whatsAppService.SendCancellationAsync(
                appointmentId: appointment.Id,
                toPhone: appointment.CustomerPhone!,
                customerName: appointment.CustomerName,
                tenantName: tenant.Name,
                appointmentDate: appointment.AppointmentDate,
                barberName: appointment.Barber?.Name ?? "tu barbero",
                tenantId: tenant.Id
            );
        }

        return Ok(new { message = "Cita cancelada correctamente." });
    }

    [HttpPut("appointments/{id:guid}/reschedule")]
    [Authorize(Roles = UserRoles.Customer)]
    public async Task<IActionResult> RescheduleAppointment(string subdomain, Guid id, [FromBody] RescheduleAppointmentDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var jwtTenantId = User.FindFirstValue("TenantId");
        if (jwtTenantId != subdomain)
            return Forbid();

        var customerIdClaim = User.FindFirstValue("UserId");
        if (!Guid.TryParse(customerIdClaim, out var customerId))
            return Unauthorized();

        var appointment = await _context.Appointments
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(a => a.Id == id && a.TenantId == subdomain);

        if (appointment is null)
            return NotFound(new { message = "Cita no encontrada." });

        if (appointment.CustomerId != customerId)
            return Forbid();

        _tenantService.TenantId = subdomain;
        var result = await _appointmentService.RescheduleAppointmentAsync(id, dto.NewAppointmentDate);

        if (!result.Success)
        {
            return result.ErrorCode switch
            {
                "NOT_FOUND" => NotFound(new { message = result.ErrorMessage }),
                "SCHEDULE_CONFLICT" => StatusCode(StatusCodes.Status409Conflict,
                    new { errorCode = result.ErrorCode, message = result.ErrorMessage }),
                _ => BadRequest(new { errorCode = result.ErrorCode, message = result.ErrorMessage }),
            };
        }

        return Ok(new
        {
            appointmentId = result.Appointment!.Id,
            appointmentDate = result.Appointment.AppointmentDate,
            status = result.Appointment.Status,
            message = "Cita reprogramada correctamente."
        });
    }

    // -----------------------------------------------------------------------
    // REVIEWS
    // -----------------------------------------------------------------------

    [HttpPost("reviews")]
    [Authorize(Roles = UserRoles.Customer)]
    [EnableRateLimiting("public-review")]
    public async Task<IActionResult> CreateReview(string subdomain, [FromBody] CreateReviewDto dto)
    {
        var jwtTenantId = User.FindFirstValue("TenantId");
        if (jwtTenantId != subdomain)
            return Forbid();

        var customerIdClaim = User.FindFirstValue("UserId");
        if (!Guid.TryParse(customerIdClaim, out var customerId))
            return Unauthorized();

        var tenantExists = await _context.Tenants.AnyAsync(t => t.Id == subdomain);
        if (!tenantExists) return NotFound(new { message = "Barbería no encontrada." });

        if (dto.Rating < 1 || dto.Rating > 5)
            return BadRequest(new { message = "La calificación debe estar entre 1 y 5." });

        // AppointmentId es opcional: el QR de la barbería lleva a una reseña genérica
        // sin cita asociada. Cuando sí se indica (ej. enlace específico), se valida.
        if (dto.AppointmentId.HasValue)
        {
            var appointment = await _context.Appointments
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(a => a.Id == dto.AppointmentId && a.TenantId == subdomain);

            if (appointment is null)
                return BadRequest(new { message = "Cita no encontrada." });

            if (appointment.Status != AppointmentStatus.Completed)
                return BadRequest(new { message = "Solo puedes dejar reseña de citas completadas." });

            if (appointment.CustomerId != customerId)
                return BadRequest(new { message = "Solo puedes dejar reseña de tus propias citas." });

            var alreadyReviewed = await _context.Reviews
                .IgnoreQueryFilters()
                .AnyAsync(r => r.AppointmentId == dto.AppointmentId && r.TenantId == subdomain);

            if (alreadyReviewed)
                return BadRequest(new { message = "Ya dejaste una reseña para esta cita." });
        }

        var review = new Domain.Entities.Review
        {
            TenantId = subdomain,
            AppointmentId = dto.AppointmentId,
            CustomerId = customerId,
            Rating = dto.Rating,
            Comment = dto.Comment?.Trim(),
            CreatedAt = DateTime.UtcNow,
        };

        _context.Reviews.Add(review);
        await _context.SaveChangesAsync();

        return Ok(new { message = "¡Gracias por tu reseña!", reviewId = review.Id });
    }

    [HttpGet("reviews/summary")]
    [AllowAnonymous]
    public async Task<IActionResult> GetReviewSummary(string subdomain)
    {
        var tenantExists = await _context.Tenants.AnyAsync(t => t.Id == subdomain);
        if (!tenantExists) return NotFound(new { message = "Barbería no encontrada." });

        var reviews = await _context.Reviews
            .IgnoreQueryFilters()
            .Where(r => r.TenantId == subdomain)
            .ToListAsync();

        if (reviews.Count == 0)
            return Ok(new { averageRating = 0.0, totalReviews = 0 });

        var avg = reviews.Average(r => r.Rating);
        return Ok(new { averageRating = Math.Round(avg, 1), totalReviews = reviews.Count });
    }
}
