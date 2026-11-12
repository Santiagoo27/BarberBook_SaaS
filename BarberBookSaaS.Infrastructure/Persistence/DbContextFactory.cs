using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;
using BarberBookSaaS.Application.Common;

namespace BarberBookSaaS.Infrastructure.Persistence;

public class DbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var config = new ConfigurationBuilder()
            .SetBasePath(Path.Combine(Directory.GetCurrentDirectory(), "..", "BarberBookSaaS.WebApi"))
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .Build();

        var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();

        var connectionString = config.GetConnectionString("DefaultConnection");
        if (!string.IsNullOrEmpty(connectionString))
            optionsBuilder.UseNpgsql(connectionString);
        else
            optionsBuilder.UseSqlite("Data Source=../BarberBookSaaS.WebApi/barberbook.db");

        return new ApplicationDbContext(optionsBuilder.Options, new FakeTenantService());
    }
}

internal class FakeTenantService : ITenantService
{
    public string TenantId { get; set; } = "design-time";
}
