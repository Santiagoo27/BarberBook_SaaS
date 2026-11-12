using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Security.Claims;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using BarberBookSaaS.Domain.Constants;

namespace BarberBookSaaS.Tests.Helpers;

public static class TestAuthHelper
{
    private const string JwtKey = "TestSecretKeyForUnitTests_AtLeast32Chars!";

    public static string AdminToken(string tenantId = "t1", string? userId = null) =>
        BuildToken(userId ?? Guid.NewGuid().ToString(), "admin@test.com", UserRoles.Admin, tenantId, false);

    public static string SuperAdminToken(string? userId = null) =>
        BuildToken(userId ?? Guid.NewGuid().ToString(), "superadmin@test.com", UserRoles.SuperAdmin, "", false);

    public static string BarberToken(string tenantId = "t1", string? userId = null) =>
        BuildToken(userId ?? Guid.NewGuid().ToString(), "barber@test.com", UserRoles.Barber, tenantId, false);

    public static string CustomerToken(string tenantId = "t1", string? customerId = null) =>
        BuildToken(customerId ?? Guid.NewGuid().ToString(), "customer@test.com", "Customer", tenantId, false);

    public static string MustChangePasswordToken(string tenantId = "t1") =>
        BuildToken(Guid.NewGuid().ToString(), "barber@test.com", UserRoles.Barber, tenantId, true);

    public static void SetAuth(this HttpClient client, string token, string tenantId = "t1")
    {
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        client.DefaultRequestHeaders.Remove("X-Tenant-Id");
        client.DefaultRequestHeaders.Add("X-Tenant-Id", tenantId);
    }

    private static string BuildToken(string userId, string email, string role, string tenantId, bool mustChangePassword)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtKey));
        var claims = new List<Claim>
        {
            new("UserId", userId),
            new(ClaimTypes.Email, email),
            new(ClaimTypes.Role, role),
            new("TenantId", tenantId),
            new("MustChangePassword", mustChangePassword.ToString().ToLower())
        };
        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Issuer = "BarberBookSaaS",
            Audience = "BarberBookSaaS",
            Expires = DateTime.UtcNow.AddHours(1),
            SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
        };
        var handler = new JwtSecurityTokenHandler();
        return handler.WriteToken(handler.CreateToken(descriptor));
    }
}