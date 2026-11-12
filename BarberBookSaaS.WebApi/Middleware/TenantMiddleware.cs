using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;
using BarberBookSaaS.Application.Common;

namespace BarberBookSaaS.WebApi.Middleware;

public class TenantMiddleware
{
    private readonly RequestDelegate _next;

    public TenantMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(
        HttpContext context,
        ITenantService tenantService,
        IOptionsMonitor<JwtBearerOptions> jwtOptionsMonitor)
    {
        string? tenantId = null;

        var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
        if (authHeader != null && authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            var token = authHeader.Substring("Bearer ".Length).Trim();
            try
            {
                var jwtOptions = jwtOptionsMonitor.Get(JwtBearerDefaults.AuthenticationScheme);
                var handler = new JwtSecurityTokenHandler();
                var principal = handler.ValidateToken(token, jwtOptions.TokenValidationParameters, out _);
                tenantId = principal.FindFirst("TenantId")?.Value;
            }
            catch
            {
                // Token inválido, expirado o firma incorrecta — no se extrae tenant
            }
        }

        if (string.IsNullOrEmpty(tenantId) &&
            context.Request.Headers.TryGetValue("X-Tenant-Id", out var headerValue))
        {
            tenantId = headerValue.FirstOrDefault();
        }
        else if (!string.IsNullOrEmpty(tenantId) &&
                 context.Request.Headers.TryGetValue("X-Tenant-Id", out var extraHeader))
        {
            var headerTenant = extraHeader.FirstOrDefault()?.ToLower().Trim();
            if (!string.IsNullOrEmpty(headerTenant) && headerTenant != tenantId.ToLower().Trim())
            {
                context.Response.StatusCode = 403;
                return;
            }
        }

        if (!string.IsNullOrEmpty(tenantId))
        {
            tenantService.TenantId = tenantId.ToLower().Trim();
        }

        await _next(context);
    }
}
