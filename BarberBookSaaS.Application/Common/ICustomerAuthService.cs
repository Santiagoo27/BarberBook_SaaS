using BarberBookSaaS.Application.DTOs.Customers;

namespace BarberBookSaaS.Application.Common;

public interface ICustomerAuthService
{
    Task<CustomerAuthResponseDto?> RegisterAsync(string subdomain, RegisterCustomerDto dto);
    Task<CustomerAuthResponseDto?> LoginAsync(string subdomain, LoginCustomerDto dto);
    Task<CustomerAuthResponseDto?> RefreshTokenAsync(string refreshToken);
    Task<bool> ForgotPasswordAsync(string subdomain, string email, string frontendBaseUrl);
    Task<bool> ForgotPasswordByPhoneAsync(string subdomain, string phone, string frontendBaseUrl);
    Task<bool> ResetPasswordAsync(string token, string newPassword);
}