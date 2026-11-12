using BarberBookSaaS.Application.DTOs.Auth;

namespace BarberBookSaaS.Application.Common;

public interface IAuthService
{
    Task<string?> RegisterTenantAsync(RegisterTenantDto request);
    Task<AuthResponseDto?> LoginAsync(LoginDto request);
    Task<RefreshTokenResponseDto?> RefreshTokenAsync(string refreshToken);
    Task<bool> LogoutAsync(Guid userId);
    Task<AuthResponseDto?> ChangePasswordAsync(Guid userId, ChangePasswordDto dto);
    Task<TenantLookupDto> GetTenantByEmailAsync(string email);
    Task<bool> ForgotPasswordAsync(string email, string frontendBaseUrl);
    Task<bool> ResetPasswordAsync(string token, string newPassword);
}