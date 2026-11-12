using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using BarberBookSaaS.Infrastructure.Persistence;

namespace BarberBookSaaS.Tests.Helpers;

public class TestWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly string _dbPath = Path.Combine(Path.GetTempPath(), $"bbtest_{Guid.NewGuid():N}.db");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureAppConfiguration((context, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "TestSecretKeyForUnitTests_AtLeast32Chars!",
                ["Meta:AppSecret"] = "test-app-secret",
                ["Meta:VerifyToken"] = "test-verify-token",
                ["SuperAdmin:Email"] = "superadmin@barberbook.dev",
                ["SuperAdmin:Password"] = "TestSuperAdmin2026!"
            });
        });

        builder.ConfigureServices(services =>
        {
            var descriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<ApplicationDbContext>));
            if (descriptor is not null) services.Remove(descriptor);

            services.AddDbContext<ApplicationDbContext>(options =>
                options.UseSqlite($"Data Source={_dbPath}"));
        });
    }

    public async Task InitializeDbAsync()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await db.Database.EnsureCreatedAsync();
    }

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        foreach (var ext in new[] { "", "-shm", "-wal" })
        {
            var path = _dbPath + ext;
            try { if (File.Exists(path)) File.Delete(path); }
            catch (IOException) { /* SQLite may still hold a handle briefly; temp file will be cleaned by OS */ }
        }
    }
}