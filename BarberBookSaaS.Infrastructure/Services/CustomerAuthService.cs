using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Customers;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using BCryptNet = BCrypt.Net.BCrypt;

namespace BarberBookSaaS.Infrastructure.Services;

public class CustomerAuthService : ICustomerAuthService
{
    private readonly ApplicationDbContext _context;
    private readonly ITokenService _tokenService;
    private readonly ITenantService _tenantService;
    private readonly IEmailService _emailService;
    private readonly IWhatsAppService _whatsAppService;
    private readonly ILogger<CustomerAuthService> _logger;

    private const string PasswordRequirementsMessage =
        "La contraseña debe tener mínimo 6 caracteres.";

    private static bool EsContrasenaSegura(string password)
    {
        return password.Length >= 6;
    }

    public CustomerAuthService(ApplicationDbContext context, ITokenService tokenService, ITenantService tenantService, IEmailService emailService, IWhatsAppService whatsAppService, ILogger<CustomerAuthService> logger)
    {
        _context = context;
        _tokenService = tokenService;
        _tenantService = tenantService;
        _emailService = emailService;
        _whatsAppService = whatsAppService;
        _logger = logger;
    }

    public async Task<CustomerAuthResponseDto?> RegisterAsync(string subdomain, RegisterCustomerDto dto)
    {
        if (!EsContrasenaSegura(dto.Password))
            throw new ArgumentException(PasswordRequirementsMessage);

        var tenantExists = await _context.Tenants.AnyAsync(t => t.Id == subdomain);
        if (!tenantExists) return null;

        var existing = await _context.Customers
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.TenantId == subdomain && c.Phone == dto.Phone);

        if (existing is not null)
        {
            if (existing.PasswordHash != string.Empty)
                return null; // teléfono ya registrado con contraseña real

            // Ghost → upgrade: conserva LoyaltyCount e historial de citas
            existing.Name = dto.Name;
            existing.PasswordHash = BCryptNet.HashPassword(dto.Password);
            existing.AcceptedTermsAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return await BuildResponseAsync(existing);
        }

        _tenantService.TenantId = subdomain;

        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            Name = dto.Name,
            Phone = dto.Phone,
            PasswordHash = BCryptNet.HashPassword(dto.Password),
            LoyaltyCount = 0,
            CreatedAt = DateTime.UtcNow,
            AcceptedTermsAt = DateTime.UtcNow
        };

        await _context.Customers.AddAsync(customer);
        await _context.SaveChangesAsync();

        return await BuildResponseAsync(customer);
    }

    public async Task<CustomerAuthResponseDto?> LoginAsync(string subdomain, LoginCustomerDto dto)
    {
        var customer = await _context.Customers
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.TenantId == subdomain && c.Phone == dto.Phone);

        if (customer is null
            || string.IsNullOrEmpty(customer.PasswordHash)
            || !BCryptNet.Verify(dto.Password, customer.PasswordHash))
            return null;

        return await BuildResponseAsync(customer);
    }

    public async Task<CustomerAuthResponseDto?> RefreshTokenAsync(string refreshToken)
    {
        var customer = await _context.Customers
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.RefreshToken == refreshToken);

        if (customer is null || customer.RefreshTokenExpiresAt < DateTime.UtcNow)
            return null;

        return await BuildResponseAsync(customer);
    }

    public async Task<bool> ForgotPasswordAsync(string subdomain, string email, string frontendBaseUrl)
    {
        var emailLower = email.ToLower();
        var customer = await _context.Customers
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.TenantId == subdomain && c.Email == emailLower);

        // Always return true to avoid user enumeration
        if (customer is null) return true;

        var tenant = await _context.Tenants.FindAsync(subdomain);
        var tenantName = tenant?.Name ?? "BarberBook";

        customer.PasswordResetToken = Guid.NewGuid().ToString("N");
        customer.PasswordResetTokenExpiresAt = DateTime.UtcNow.AddHours(1);
        await _context.SaveChangesAsync();

        var resetLink = $"{frontendBaseUrl}/book/{subdomain}?reset_token={customer.PasswordResetToken}";
        await _emailService.SendPasswordResetEmailAsync(email, tenantName, resetLink);
        return true;
    }

    public async Task<bool> ForgotPasswordByPhoneAsync(string subdomain, string phone, string frontendBaseUrl)
    {
        var customer = await _context.Customers
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.TenantId == subdomain && c.Phone == phone);

        if (customer is null) return true;

        var tenant = await _context.Tenants.FindAsync(subdomain);
        var tenantName = tenant?.Name ?? "BarberBook";

        customer.PasswordResetToken = Guid.NewGuid().ToString("N");
        customer.PasswordResetTokenExpiresAt = DateTime.UtcNow.AddHours(1);
        await _context.SaveChangesAsync();

        var resetLink = $"{subdomain}?reset_token={customer.PasswordResetToken}";
        await _whatsAppService.SendPasswordResetAsync(phone, customer.Name, tenantName, resetLink);
        return true;
    }

    public async Task<bool> ResetPasswordAsync(string token, string newPassword)
    {
        var actualToken = token;
        var idx = token.IndexOf("reset_token=", StringComparison.Ordinal);
        if (idx >= 0)
            actualToken = token[(idx + "reset_token=".Length)..];

        var customer = await _context.Customers
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.PasswordResetToken == actualToken);

        if (customer is null)
        {
            _logger.LogWarning("[ResetPassword] Customer no encontrado para token: {Token} (parsed: {Parsed})", token, actualToken);
            return false;
        }

        if (customer.PasswordResetTokenExpiresAt < DateTime.UtcNow)
        {
            _logger.LogWarning("[ResetPassword] Token expirado. Expira: {Expires}, UtcNow: {Now}", customer.PasswordResetTokenExpiresAt, DateTime.UtcNow);
            return false;
        }

        if (!EsContrasenaSegura(newPassword))
            throw new ArgumentException(PasswordRequirementsMessage);

        customer.PasswordHash = BCryptNet.HashPassword(newPassword);
        customer.PasswordResetToken = null;
        customer.PasswordResetTokenExpiresAt = null;
        customer.RefreshToken = null;
        customer.RefreshTokenExpiresAt = null;
        await _context.SaveChangesAsync();
        return true;
    }

    private async Task<CustomerAuthResponseDto> BuildResponseAsync(Customer customer)
    {
        var expiresAt = DateTime.UtcNow.AddHours(1);
        var accessToken = _tokenService.CreateTokenForUser(customer.Id, customer.Phone, "Customer", customer.TenantId);
        var refreshToken = GenerateSecureToken();

        customer.RefreshToken = refreshToken;
        customer.RefreshTokenExpiresAt = DateTime.UtcNow.AddDays(30);
        await _context.SaveChangesAsync();

        return new CustomerAuthResponseDto
        {
            Token = accessToken,
            RefreshToken = refreshToken,
            ExpiresAt = expiresAt,
            CustomerId = customer.Id.ToString(),
            Name = customer.Name,
            Phone = customer.Phone,
            TenantId = customer.TenantId,
            LoyaltyCount = customer.LoyaltyCount
        };
    }

    private static string GenerateSecureToken()
    {
        var bytes = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(bytes);
        return Convert.ToBase64String(bytes);
    }
}