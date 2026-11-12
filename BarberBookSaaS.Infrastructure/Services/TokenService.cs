using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Domain.Entities;

namespace BarberBookSaaS.Infrastructure.Services;

public class TokenService : ITokenService
{
    private readonly string _jwtKey;
    private readonly string _jwtIssuer;
    private readonly string _jwtAudience;

    public TokenService(IConfiguration configuration)
    {
        _jwtKey = configuration["Jwt:Key"]
            ?? throw new InvalidOperationException("JWT key 'Jwt:Key' is not configured.");
        _jwtIssuer = configuration["Jwt:Issuer"] ?? "BarberBookSaaS";
        _jwtAudience = configuration["Jwt:Audience"] ?? "BarberBookSaaS";
    }

    public string CreateToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new("UserId", user.Id.ToString()),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, user.Role),
            new("TenantId", user.TenantId),
            new("MustChangePassword", user.MustChangePassword.ToString().ToLower())
        };

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Issuer = _jwtIssuer,
            Audience = _jwtAudience,
            Expires = DateTime.UtcNow.AddHours(1),
            SigningCredentials = creds
        };

        var handler = new JwtSecurityTokenHandler();
        return handler.WriteToken(handler.CreateToken(tokenDescriptor));
    }

    public string CreateTokenForUser(Guid userId, string email, string role, string tenantId)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new("UserId", userId.ToString()),
            new(ClaimTypes.Email, email),
            new(ClaimTypes.Role, role),
            new("TenantId", tenantId)
        };

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Issuer = _jwtIssuer,
            Audience = _jwtAudience,
            Expires = DateTime.UtcNow.AddHours(1),
            SigningCredentials = creds
        };

        var handler = new JwtSecurityTokenHandler();
        return handler.WriteToken(handler.CreateToken(tokenDescriptor));
    }
}