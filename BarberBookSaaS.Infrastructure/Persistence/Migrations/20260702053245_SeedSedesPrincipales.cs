using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BarberBookSaaS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SeedSedesPrincipales : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Crear Sede Principal para tenants que no tengan ninguna Location activa
            migrationBuilder.Sql(@"
                INSERT INTO Locations (Id, TenantId, Name, Address, IsActive, CreatedAt)
                SELECT
                    lower(hex(randomblob(4))) || '-' ||
                    lower(hex(randomblob(2))) || '-4' ||
                    substr(lower(hex(randomblob(2))),2) || '-' ||
                    substr('89ab',abs(random()) % 4 + 1, 1) ||
                    substr(lower(hex(randomblob(2))),2) || '-' ||
                    lower(hex(randomblob(6))) AS Id,
                    t.Id AS TenantId,
                    'Sede Principal' AS Name,
                    COALESCE(NULLIF(t.Address, ''), 'Sin dirección registrada') AS Address,
                    1 AS IsActive,
                    datetime('now') AS CreatedAt
                FROM Tenants t
                WHERE NOT EXISTS (
                    SELECT 1 FROM Locations l
                    WHERE l.TenantId = t.Id AND l.IsActive = 1
                );
            ");

            // 2. Vincular barberos sin sede a su Sede Principal
            migrationBuilder.Sql(@"
                UPDATE Barbers
                SET LocationId = (
                    SELECT l.Id FROM Locations l
                    WHERE l.TenantId = Barbers.TenantId
                    AND l.IsActive = 1
                    ORDER BY l.CreatedAt ASC
                    LIMIT 1
                )
                WHERE LocationId IS NULL;
            ");

            // 3. Vincular citas sin sede a su Sede Principal
            migrationBuilder.Sql(@"
                UPDATE Appointments
                SET LocationId = (
                    SELECT l.Id FROM Locations l
                    WHERE l.TenantId = Appointments.TenantId
                    AND l.IsActive = 1
                    ORDER BY l.CreatedAt ASC
                    LIMIT 1
                )
                WHERE LocationId IS NULL;
            ");

            // 4. Vincular servicios activos a su Sede Principal en LocationServices
            // (solo para tenants con exactamente 1 sede activa; 2+ sedes requieren asignación manual)
            migrationBuilder.Sql(@"
                INSERT INTO LocationServices (LocationId, ServiceId)
                SELECT
                    l.Id AS LocationId,
                    s.Id AS ServiceId
                FROM Services s
                INNER JOIN Locations l ON l.TenantId = s.TenantId AND l.IsActive = 1
                WHERE s.IsActive = 1
                AND NOT EXISTS (
                    SELECT 1 FROM LocationServices ls
                    WHERE ls.LocationId = l.Id AND ls.ServiceId = s.Id
                )
                AND (
                    SELECT COUNT(*) FROM Locations l2
                    WHERE l2.TenantId = s.TenantId AND l2.IsActive = 1
                ) = 1;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Migración de seed de datos — no tiene sentido revertirla.
        }
    }
}
