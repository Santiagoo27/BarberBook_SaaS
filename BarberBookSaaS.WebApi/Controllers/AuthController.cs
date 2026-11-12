using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Auth;
using BarberBookSaaS.Domain.Constants;

namespace BarberBookSaaS.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ICustomerAuthService _customerAuthService;
    private readonly IConfiguration _config;

    public AuthController(IAuthService authService, ICustomerAuthService customerAuthService, IConfiguration config)
    {
        _authService = authService;
        _customerAuthService = customerAuthService;
        _config = config;
    }

    [HttpGet("tenant-by-email")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> GetTenantByEmail([FromQuery] string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return BadRequest(new { message = "Email requerido." });

        var result = await _authService.GetTenantByEmailAsync(email);
        return Ok(result);
    }

    [HttpPost("register")]
    [Authorize(Roles = UserRoles.SuperAdmin)]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Register([FromBody] RegisterTenantDto request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var temporaryPassword = await _authService.RegisterTenantAsync(request);
        if (temporaryPassword is null)
            return BadRequest(new { message = "El subdominio ya está registrado." });

        return Ok(new { message = "Barbería y cuenta admin creadas exitosamente.", temporaryPassword });
    }

    [HttpPost("login")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Login([FromBody] LoginDto request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var response = await _authService.LoginAsync(request);
        if (response is null)
            return Unauthorized(new { message = "Credenciales incorrectas." });

        return Ok(response);
    }

    [HttpPost("refresh")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Refresh([FromBody] RefreshTokenRequestDto request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var response = await _authService.RefreshTokenAsync(request.RefreshToken);
        if (response is null)
            return Unauthorized(new { message = "Refresh token inválido o expirado." });

        return Ok(response);
    }

    [HttpPost("logout")]
    [Authorize]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Logout()
    {
        var userIdClaim = User.FindFirstValue("UserId");
        if (userIdClaim is null || !Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        await _authService.LogoutAsync(userId);
        return NoContent();
    }

    [HttpPost("forgot-password")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var frontendBase = _config["FrontendBaseUrl"] ?? "http://localhost:5173";
        await _authService.ForgotPasswordAsync(request.Email, frontendBase);

        // Always 200 to prevent user enumeration
        return Ok(new { message = "Si el correo existe, recibirás un enlace para restablecer tu contraseña." });
    }

    [HttpPost("reset-password")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var success = await _authService.ResetPasswordAsync(request.Token, request.NewPassword);
        if (!success)
            success = await _customerAuthService.ResetPasswordAsync(request.Token, request.NewPassword);

        if (!success)
            return BadRequest(new { message = "El enlace es inválido o ha expirado." });

        return Ok(new { message = "Contraseña actualizada correctamente." });
    }

    [HttpPost("change-password")]
    [Authorize]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var userIdClaim = User.FindFirstValue("UserId");
        if (userIdClaim is null || !Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        var result = await _authService.ChangePasswordAsync(userId, request);
        if (result is null)
            return BadRequest(new { message = "Contraseña actual incorrecta." });

        return Ok(result);
    }
}