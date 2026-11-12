using System.Security.Claims;
using BarberBookSaaS.Domain.Constants;

namespace BarberBookSaaS.WebApi.Middleware;

public class MustChangePasswordMiddleware
{
    private readonly RequestDelegate _next;

    public MustChangePasswordMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var mustChange = context.User.FindFirstValue("MustChangePassword");
            var role = context.User.FindFirstValue(ClaimTypes.Role);

            // Aplica a Barberos y Admins: ambos pueden ser creados con contraseña temporal
            // (Barbero por el dueño, Admin por el SuperAdmin al crear una barbería nueva)
            if (mustChange == "true" && (role == UserRoles.Barber || role == UserRoles.Admin))
            {
                var path = context.Request.Path.Value ?? string.Empty;

                // Auth endpoints always pass through — prevents stale JWTs from
                // blocking login requests when the old token is still in the header
                var isBypassed =
                    path.StartsWith("/api/auth/", StringComparison.OrdinalIgnoreCase) ||
                    path.StartsWith("/api/public/", StringComparison.OrdinalIgnoreCase);

                if (!isBypassed)
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    context.Response.ContentType = "application/json";
                    await context.Response.WriteAsJsonAsync(new
                    {
                        errorCode = "MUST_CHANGE_PASSWORD",
                        message   = "Debes cambiar tu contraseña antes de continuar."
                    });
                    return;
                }
            }
        }

        await _next(context);
    }
}