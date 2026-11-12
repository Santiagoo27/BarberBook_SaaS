using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Application.Common;

namespace BarberBookSaaS.Infrastructure.Persistence;

public class ApplicationDbContext : DbContext
{
    private readonly ITenantService _tenantService;

    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options, 
        ITenantService tenantService) : base(options)
    {
        _tenantService = tenantService;
    }

    // Nuevas tablas añadidas para Autenticación y Multi-tenant
    public DbSet<Tenant> Tenants { get; set; }
    public DbSet<User> Users { get; set; }
    public DbSet<Customer> Customers { get; set; }

    // Tablas operacionales existentes
    public DbSet<Barber> Barbers { get; set; }
    public DbSet<BarberSchedule> BarberSchedules { get; set; }
    public DbSet<Service> Services { get; set; }
    public DbSet<Appointment> Appointments { get; set; }
    public DbSet<Review> Reviews { get; set; }
    public DbSet<Suggestion> Suggestions { get; set; }
    public DbSet<SuperAdminDiagnosis> SuperAdminDiagnoses { get; set; }
    public DbSet<Location> Locations => Set<Location>();
    public DbSet<LocationService> LocationServices => Set<LocationService>();

    // Todo el sistema trata las fechas como "hora de Colombia disfrazada de UTC"
    // (ver SpecifyKind(..., Utc) en AppointmentService, DashboardService, etc.).
    // SQLite devuelve DateTimeKind.Unspecified al leer; Npgsql devuelve Utc.
    // Sin esto, el JSON serializado no lleva "Z" en dev pero sí en producción,
    // y el frontend (new Date(...).getUTCHours()) interpreta mal la hora local en dev.
    private sealed class ForceUtcKindConverter : ValueConverter<DateTime, DateTime>
    {
        public ForceUtcKindConverter() : base(
            v => v,
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc))
        { }
    }

    private sealed class ForceUtcKindNullableConverter : ValueConverter<DateTime?, DateTime?>
    {
        public ForceUtcKindNullableConverter() : base(
            v => v,
            v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v)
        { }
    }

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<DateTime>().HaveConversion<ForceUtcKindConverter>();
        configurationBuilder.Properties<DateTime?>().HaveConversion<ForceUtcKindNullableConverter>();
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        if (Database.IsSqlite())
            modelBuilder.Entity<Service>().Property(s => s.Price).HasConversion<double>();

        // RELACIONES
        modelBuilder.Entity<Appointment>()
            .HasOne(a => a.Barber).WithMany().HasForeignKey(a => a.BarberId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Appointment>()
            .HasOne(a => a.Service).WithMany().HasForeignKey(a => a.ServiceId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<BarberSchedule>()
            .HasOne(bs => bs.Barber).WithMany().HasForeignKey(bs => bs.BarberId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<BarberSchedule>()
            .HasIndex(bs => new { bs.BarberId, bs.DayOfWeek })
            .IsUnique();

        // Teléfono único por tenant para Customer
        modelBuilder.Entity<Customer>()
            .HasIndex(c => new { c.TenantId, c.Phone })
            .IsUnique();

        // LOCATIONS (Sedes)
        modelBuilder.Entity<Location>()
            .Property(l => l.Name).HasMaxLength(100).IsRequired();
        modelBuilder.Entity<Location>()
            .Property(l => l.Address).HasMaxLength(256).IsRequired();

        modelBuilder.Entity<LocationService>()
            .HasKey(ls => new { ls.LocationId, ls.ServiceId });

        modelBuilder.Entity<LocationService>()
            .HasOne(ls => ls.Location).WithMany(l => l.LocationServices).HasForeignKey(ls => ls.LocationId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<LocationService>()
            .HasOne(ls => ls.Service).WithMany().HasForeignKey(ls => ls.ServiceId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Barber>()
            .HasOne(b => b.Location).WithMany(l => l.Barbers).HasForeignKey(b => b.LocationId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Appointment>()
            .HasOne(a => a.Location).WithMany().HasForeignKey(a => a.LocationId)
            .OnDelete(DeleteBehavior.Restrict);

        // FILTROS GLOBALES MULTI-TENANT (Protección para Lecturas)
        // Nota: La tabla 'Tenant' no lleva filtro porque es la raíz del sistema
        modelBuilder.Entity<User>().HasQueryFilter(u => u.TenantId == _tenantService.TenantId);
        modelBuilder.Entity<Barber>().HasQueryFilter(b => b.TenantId == _tenantService.TenantId);
        modelBuilder.Entity<BarberSchedule>().HasQueryFilter(bs => bs.TenantId == _tenantService.TenantId);
        modelBuilder.Entity<Service>().HasQueryFilter(s => s.TenantId == _tenantService.TenantId);
        modelBuilder.Entity<Appointment>().HasQueryFilter(a => a.TenantId == _tenantService.TenantId);
        modelBuilder.Entity<Customer>().HasQueryFilter(c => c.TenantId == _tenantService.TenantId);
        modelBuilder.Entity<Review>().HasQueryFilter(r => r.TenantId == _tenantService.TenantId);
        modelBuilder.Entity<Suggestion>().HasQueryFilter(s => s.TenantId == _tenantService.TenantId);
        modelBuilder.Entity<Location>().HasQueryFilter(l => l.TenantId == _tenantService.TenantId);
    }

    // -------------------------------------------------------------------------
    // INTERCEPTORES DE ESCRITURA (Protección automatizada para inserciones masivas)
    // -------------------------------------------------------------------------

    public override int SaveChanges()
    {
        ApplyTenantIdToNewEntities();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyTenantIdToNewEntities();
        return base.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Recorre los cambios antes de guardarse en la BD. Si detecta una entidad nueva 
    /// que posea la propiedad TenantId, le clava automáticamente el Tenant de la sesión.
    /// </summary>
    private void ApplyTenantIdToNewEntities()
    {
        foreach (var entry in ChangeTracker.Entries())
        {
            // Solo nos interesan los registros que se van a insertar (Added)
            if (entry.State == EntityState.Added)
            {
                var tenantIdProp = entry.Entity.GetType().GetProperty("TenantId");

                // Si la entidad tiene la propiedad "TenantId", la inyectamos solo si
                // aún no tiene un valor (evita sobreescribir TenantIds asignados explícitamente,
                // como el del admin en RegisterTenantAsync).
                if (tenantIdProp != null)
                {
                    var currentValue = tenantIdProp.GetValue(entry.Entity) as string;
                    if (string.IsNullOrEmpty(currentValue) && !string.IsNullOrEmpty(_tenantService.TenantId))
                    {
                        tenantIdProp.SetValue(entry.Entity, _tenantService.TenantId);
                    }
                }
            }
        }
    }
}