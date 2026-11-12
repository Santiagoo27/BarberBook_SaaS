using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Auth;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using BarberBookSaaS.Domain.Constants;
using BCryptNet = BCrypt.Net.BCrypt;

namespace BarberBookSaaS.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly ApplicationDbContext _context;
    private readonly ITokenService _tokenService;
    private readonly ITenantService _tenantService;
    private readonly IEmailService _emailService;

    private const string PasswordRequirementsMessage =
        "La contraseña debe tener mínimo 6 caracteres.";

    private static bool EsContrasenaSegura(string password)
    {
        return password.Length >= 6;
    }

    public AuthService(ApplicationDbContext context, ITokenService tokenService, ITenantService tenantService, IEmailService emailService)
    {
        _context = context;
        _tokenService = tokenService;
        _tenantService = tenantService;
        _emailService = emailService;
    }

    public async Task<string?> RegisterTenantAsync(RegisterTenantDto request)
    {
        var exists = await _context.Tenants
            .AnyAsync(t => t.Subdomain == request.Subdomain.ToLower());
        if (exists) return null;

        var tempPassword = TemporaryPasswordGenerator.Generate();

        var newTenant = new Tenant
        {
            Id = request.Subdomain.ToLower(),
            Name = request.BarberiaName,
            Subdomain = request.Subdomain.ToLower(),
            Phone = request.Phone,
            Address = request.Address
        };

        var newAdmin = new User
        {
            Id = Guid.NewGuid(),
            TenantId = newTenant.Id,
            Email = request.AdminEmail.ToLower(),
            Role = UserRoles.Admin,
            PasswordHash = BCryptNet.HashPassword(tempPassword),
            IsActive = true,
            MustChangePassword = true
        };

        await _context.Tenants.AddAsync(newTenant);
        await _context.Users.AddAsync(newAdmin);
        await _context.SaveChangesAsync();

        // Sede Principal automática — garantiza que toda barbería nueva tenga
        // al menos una sede desde su creación. TenantId se asigna explícito porque
        // el tenant recién creado aún no está activo en ITenantService (mismo patrón
        // usado arriba para newAdmin.TenantId).
        var sedePrincipal = new Location
        {
            Id = Guid.NewGuid(),
            TenantId = newTenant.Id,
            Name = "Sede Principal",
            Address = string.IsNullOrWhiteSpace(newTenant.Address)
                ? "Sin dirección registrada"
                : newTenant.Address,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        await _context.Locations.AddAsync(sedePrincipal);
        await _context.SaveChangesAsync();

        return tempPassword;
    }

    public async Task<AuthResponseDto?> LoginAsync(LoginDto request)
    {
        var emailLower = request.Email.ToLower();
        var tenantId = _tenantService.TenantId;

        // Always check SuperAdmin first — works regardless of tenant context
        var superAdmin = await _context.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Email == emailLower && u.Role == UserRoles.SuperAdmin);

        if (superAdmin is not null)
        {
            if (!BCryptNet.Verify(request.Password, superAdmin.PasswordHash) || !superAdmin.IsActive)
                return null;

            var (saToken, saRefresh, saExpiry) = await GenerateTokensAsync(superAdmin);
            return new AuthResponseDto
            {
                Token              = saToken,
                RefreshToken       = saRefresh,
                ExpiresAt          = saExpiry,
                UserId             = superAdmin.Id.ToString(),
                Email              = superAdmin.Email,
                Role               = superAdmin.Role,
                TenantId           = superAdmin.TenantId,
                MustChangePassword = superAdmin.MustChangePassword
            };
        }

        // For regular users, tenant context is required
        if (string.IsNullOrEmpty(tenantId))
            return null;

        var user = await _context.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Email == emailLower && u.TenantId == tenantId);

        if (user is null || !BCryptNet.Verify(request.Password, user.PasswordHash) || !user.IsActive)
            return null;

        var (accessToken, refreshToken, expiresAt) = await GenerateTokensAsync(user);

        return new AuthResponseDto
        {
            Token              = accessToken,
            RefreshToken       = refreshToken,
            ExpiresAt          = expiresAt,
            UserId             = user.Id.ToString(),
            Email              = user.Email,
            Role               = user.Role,
            TenantId           = user.TenantId,
            MustChangePassword = user.MustChangePassword
        };
    }

    public async Task<RefreshTokenResponseDto?> RefreshTokenAsync(string refreshToken)
    {
        var user = await _context.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.RefreshToken == refreshToken);

        if (user is null || !user.IsActive || user.RefreshTokenExpiresAt < DateTime.UtcNow)
            return null;

        var (accessToken, newRefreshToken, expiresAt) = await GenerateTokensAsync(user);

        return new RefreshTokenResponseDto
        {
            Token = accessToken,
            RefreshToken = newRefreshToken,
            ExpiresAt = expiresAt
        };
    }

    public async Task<bool> LogoutAsync(Guid userId)
    {
        var user = await _context.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user is null) return false;

        user.RefreshToken = null;
        user.RefreshTokenExpiresAt = null;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<AuthResponseDto?> ChangePasswordAsync(Guid userId, ChangePasswordDto dto)
    {
        var user = await _context.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user is null) return null;

        if (string.IsNullOrEmpty(dto.CurrentPassword) || !BCryptNet.Verify(dto.CurrentPassword, user.PasswordHash))
            return null;

        if (!EsContrasenaSegura(dto.NewPassword))
            throw new ArgumentException(PasswordRequirementsMessage);

        user.PasswordHash = BCryptNet.HashPassword(dto.NewPassword);
        user.MustChangePassword = false;
        await _context.SaveChangesAsync();

        // Issue a fresh token pair — the new JWT carries MustChangePassword=false
        var (accessToken, refreshToken, expiresAt) = await GenerateTokensAsync(user);

        return new AuthResponseDto
        {
            Token              = accessToken,
            RefreshToken       = refreshToken,
            ExpiresAt          = expiresAt,
            UserId             = user.Id.ToString(),
            Email              = user.Email,
            Role               = user.Role,
            TenantId           = user.TenantId,
            MustChangePassword = false
        };
    }

    public async Task<TenantLookupDto> GetTenantByEmailAsync(string email)
    {
        var emailLower = email.ToLower();

        var user = await _context.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Email == emailLower && u.IsActive);

        await Task.Delay(100);

        if (user is null || string.IsNullOrEmpty(user.TenantId) || user.Role == UserRoles.SuperAdmin)
            return new TenantLookupDto("", "", null);

        var tenant = await _context.Tenants.FindAsync(user.TenantId);
        if (tenant is null)
            return new TenantLookupDto("", "", null);

        return new TenantLookupDto(tenant.Id, tenant.Name, tenant.LogoBase64);
    }

    public async Task<bool> ForgotPasswordAsync(string email, string frontendBaseUrl)
    {
        var emailLower = email.ToLower();
        var user = await _context.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Email == emailLower && u.IsActive && u.Role != UserRoles.SuperAdmin);

        // Always return true to avoid user enumeration
        if (user is null) return true;

        var tenant = await _context.Tenants.FindAsync(user.TenantId);
        var tenantName = tenant?.Name ?? "BarberBook";

        user.PasswordResetToken = Guid.NewGuid().ToString("N");
        user.PasswordResetTokenExpiresAt = DateTime.UtcNow.AddHours(1);
        await _context.SaveChangesAsync();

        var resetLink = $"{frontendBaseUrl}/reset-password?token={user.PasswordResetToken}";
        await _emailService.SendPasswordResetEmailAsync(user.Email, tenantName, resetLink);
        return true;
    }

    public async Task<bool> ResetPasswordAsync(string token, string newPassword)
    {
        var actualToken = token;
        var idx = token.IndexOf("reset_token=", StringComparison.Ordinal);
        if (idx >= 0)
            actualToken = token[(idx + "reset_token=".Length)..];

        var user = await _context.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.PasswordResetToken == actualToken);

        if (user is null || user.PasswordResetTokenExpiresAt < DateTime.UtcNow)
            return false;

        if (!EsContrasenaSegura(newPassword))
            throw new ArgumentException(PasswordRequirementsMessage);

        user.PasswordHash = BCryptNet.HashPassword(newPassword);
        user.PasswordResetToken = null;
        user.PasswordResetTokenExpiresAt = null;
        user.RefreshToken = null;
        user.RefreshTokenExpiresAt = null;
        await _context.SaveChangesAsync();
        return true;
    }

    private async Task<(string accessToken, string refreshToken, DateTime expiresAt)> GenerateTokensAsync(User user)
    {
        var expiresAt = DateTime.UtcNow.AddHours(1);
        var accessToken = _tokenService.CreateToken(user);
        var refreshToken = GenerateSecureToken();

        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiresAt = DateTime.UtcNow.AddDays(30);
        await _context.SaveChangesAsync();

        return (accessToken, refreshToken, expiresAt);
    }

    private static string GenerateSecureToken()
    {
        var bytes = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(bytes);
        return Convert.ToBase64String(bytes);
    }
}