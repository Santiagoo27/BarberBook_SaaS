using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BarberBookSaaS.WebApi.Middleware;

public class TenantStatusMiddleware
{
    private readonly RequestDelegate _next;

    public TenantStatusMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, ITenantService tenantService, ApplicationDbContext db)
    {
        var tenantId = tenantService.TenantId;

        // For public endpoints the tenant is not in middleware — extract from URL path
        // Pattern: /api/public/{subdomain}/...
        if (string.IsNullOrEmpty(tenantId))
        {
            var path = context.Request.Path.Value ?? "";
            if (path.StartsWith("/api/public/", StringComparison.OrdinalIgnoreCase))
            {
                var parts = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
                // parts: ["api", "public", "{subdomain}", ...]
                if (parts.Length >= 3)
                    tenantId = parts[2].ToLower();
            }
        }

        if (!string.IsNullOrEmpty(tenantId))
        {
            var tenant = await db.Tenants
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == tenantId);

            if (tenant is not null && !tenant.IsWebActive)
            {
                context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsync(
                    "{\"error\":\"Servicio suspendido. Contacta al administrador.\"}");
                return;
            }
        }

        await _next(context);
    }
}
