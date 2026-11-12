using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Branding;
using BarberBookSaaS.Domain.Constants;

namespace BarberBookSaaS.WebApi.Controllers;

[ApiController]
[Route("api")]
public class BrandingController : ControllerBase
{
    private readonly IBrandingService _brandingService;

    public BrandingController(IBrandingService brandingService)
    {
        _brandingService = brandingService;
    }

    [HttpGet("tenant/branding")]
    [Authorize]
    public async Task<IActionResult> GetBranding()
    {
        var branding = await _brandingService.GetBrandingAsync();
        if (branding is null) return NotFound();
        return Ok(branding);
    }

    [HttpPut("tenant/branding")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> UpdateBranding([FromBody] UpdateBrandingDto dto)
    {
        var success = await _brandingService.UpdateBrandingAsync(dto);
        if (!success) return NotFound();
        return NoContent();
    }

    [HttpPost("tenant/logo")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> UploadLogo(IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest("No se recibió ningún archivo.");

        if (file.Length > 2 * 1024 * 1024)
            return BadRequest("El logo no puede superar los 2MB.");

        // SVG can embed scripts — only accept raster image formats
        var allowedMimeTypes = new[] { "image/png", "image/jpeg", "image/jpg", "image/webp" };
        if (!allowedMimeTypes.Contains(file.ContentType.ToLowerInvariant()))
            return BadRequest("Solo se aceptan imágenes PNG, JPEG o WebP.");

        using var memoryStream = new MemoryStream();
        await file.CopyToAsync(memoryStream);
        var bytes = memoryStream.ToArray();

        // Validate magic bytes — Content-Type is client-supplied and cannot be trusted alone
        if (!IsAllowedImageMagicBytes(bytes))
            return BadRequest("El archivo no es una imagen válida.");

        var base64 = $"data:{file.ContentType};base64,{Convert.ToBase64String(bytes)}";

        var success = await _brandingService.UpdateLogoAsync(base64);
        if (!success) return NotFound();

        return Ok(new { logoBase64 = base64 });
    }

    private static bool IsAllowedImageMagicBytes(byte[] bytes)
    {
        if (bytes.Length < 4) return false;
        // PNG: 89 50 4E 47
        if (bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47) return true;
        // JPEG: FF D8 FF
        if (bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF) return true;
        // WebP: RIFF....WEBP
        if (bytes.Length >= 12 &&
            bytes[0] == 0x52 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x46 &&
            bytes[8] == 0x57 && bytes[9] == 0x45 && bytes[10] == 0x42 && bytes[11] == 0x50) return true;
        return false;
    }

    [HttpPut("tenant/whatsapp")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> UpdateWhatsApp([FromBody] UpdateWhatsAppDto dto)
    {
        var success = await _brandingService.UpdateWhatsAppAsync(dto.Enabled, dto.Phone);
        if (!success) return NotFound();
        return NoContent();
    }

    [HttpPut("tenant/holidays")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> UpdateHolidays([FromBody] UpdateHolidaysDto dto)
    {
        var success = await _brandingService.UpdateHolidaysAsync(dto.Enabled);
        if (!success) return NotFound();
        return NoContent();
    }

    [HttpPut("tenant/address")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> UpdateAddress([FromBody] UpdateAddressDto dto)
    {
        var success = await _brandingService.UpdateAddressAsync(dto.Address);
        if (!success) return NotFound();
        return NoContent();
    }

    [HttpPut("tenant/name")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> UpdateName([FromBody] UpdateNameDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { message = "El nombre no puede estar vacío." });
        var success = await _brandingService.UpdateNameAsync(dto.Name);
        if (!success) return NotFound();
        return NoContent();
    }

    [HttpGet("public/{subdomain}/branding")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublicBranding(string subdomain)
    {
        var branding = await _brandingService.GetPublicBrandingAsync(subdomain);
        if (branding is null) return NotFound();
        return Ok(branding);
    }

    [HttpGet("public/{subdomain}/holidays")]
    [AllowAnonymous]
    public async Task<IActionResult> GetHolidays(string subdomain, [FromQuery] int? year)
    {
        var tenant = await _brandingService.GetPublicBrandingAsync(subdomain);
        if (tenant is null) return NotFound();
        if (!tenant.HolidaysEnabled) return Ok(new { enabled = false, holidays = Array.Empty<string>() });

        var y = year ?? DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(-5)).Year;
        var holidays = Infrastructure.Services.ColombianHolidayService.GetHolidayDatesIso(y);
        return Ok(new { enabled = true, holidays });
    }
}

public class UpdateHolidaysDto
{
    public bool Enabled { get; set; }
}

public class UpdateAddressDto
{
    public string? Address { get; set; }
}

public class UpdateNameDto
{
    public string Name { get; set; } = string.Empty;
}
