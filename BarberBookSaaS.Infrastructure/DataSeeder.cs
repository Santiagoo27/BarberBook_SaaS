using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using BCryptNet = BCrypt.Net.BCrypt;

namespace BarberBookSaaS.Infrastructure;

public static class DataSeeder
{
    public static async Task SeedSuperAdminAsync(ApplicationDbContext db, IConfiguration configuration)
    {
        var superAdmin = await db.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Role == UserRoles.SuperAdmin);

        if (superAdmin is not null)
        {
            if (string.IsNullOrEmpty(superAdmin.Email))
            {
                var emailPatch = configuration["SuperAdmin:Email"] ?? "superadmin@barberbook.dev";
                superAdmin.Email = emailPatch;
                await db.SaveChangesAsync();
            }
            return;
        }

        var email = configuration["SuperAdmin:Email"];
        var password = configuration["SuperAdmin:Password"];

        if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(password))
            throw new InvalidOperationException(
                "SuperAdmin:Email and SuperAdmin:Password must be configured in appsettings or environment variables. " +
                "Copy appsettings.Development.example.json to appsettings.Development.json and fill in the values.");

        db.Users.Add(new User
        {
            Id                  = Guid.NewGuid(),
            TenantId            = "",
            Email               = email,
            Role                = UserRoles.SuperAdmin,
            PasswordHash        = BCryptNet.HashPassword(password),
            IsActive            = true,
            MustChangePassword  = true
        });
        await db.SaveChangesAsync();
    }
}
