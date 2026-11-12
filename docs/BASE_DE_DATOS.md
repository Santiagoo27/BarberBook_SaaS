# Base de Datos — BarberBook SaaS

> Para comandos de migración y la ruta del archivo SQLite, ver `CLAUDE.md`.

## Migraciones

| # | Migración | Cambio |
|---|-----------|--------|
| 1 | `20260521203812_Inicial` | Estructura base |
| 2 | `20260521205709_AgregarDuracionServicio` | `DurationMinutes` en `Service` |
| 3 | `20260521221938_AgregarSeguridadYTenants` | Tablas `Tenants` y `Users` |
| 4 | `20260521223537_AgregarCreatedAtCita` | `CreatedAt` en `Appointment` |
| 5 | `20260525232536_AgregarHorariosBarbero` | `Email`, `Phone` en `Barber`; tabla `BarberSchedules` |
| 6 | `20260526053816_AgregarBrandingTenant` | `Theme`, `PrimaryColor`, `SecondaryColor`, `LogoBase64` en `Tenant` |
| 7 | `20260527031054_AgregarRefreshTokenYBarberoVinculado` | `MustChangePassword`, `RefreshToken`, `RefreshTokenExpiresAt` en `Users`; `UserId` en `Barbers` |
| 8 | `20260527191931_AgregarClientesYFidelizacion` | Tabla `Customers`; `LoyaltyEnabled`/`LoyaltyThreshold` en `Tenant`; `IsFree`/`CustomerId` en `Appointment` |
| 9 | `20260603004735_AgregarPasswordReset` | `Email?`, `PasswordResetToken?`, `PasswordResetTokenExpiresAt?` en `Users` y `Customers` |
| 10 | `20260603021611_AgregarResenas` | Tabla `Reviews` (`TenantId`, `AppointmentId?`, `Rating`, `Comment?`, `CreatedAt`) |
| 11 | `20260603024709_AgregarPlanYEstadoTenant` | `Plan` (string, default `Standard`) + `IsWebActive` (bool, default `true`) en `Tenants` |
| 12 | `20260605222219_AgregarDescansoHorarioBarbero` | `BreakStartHour?`, `BreakStartMinute?`, `BreakEndHour?`, `BreakEndMinute?` en `BarberSchedules` |
| 13 | `20260610140226_AgregarImagenesServiciosBarberos` | `ImageBase64?` en `Service` y `Barber` |
| 14 | `20260612144559_AgregarMetaPhoneNumberId` | Agrega `Tenant.MetaPhoneNumberId` (ID del número de WhatsApp Business en Meta Cloud API, por tenant) |
| 15 | `20260701185031_AddLocationsAndSedes` | Tablas `Locations` (Id, TenantId, Name, Address, IsActive, CreatedAt) y `LocationServices` (junction M:N con `Service`, clave compuesta); `LocationId` nullable en `Barbers` y `Appointments` |
| 16 | `20260702053245_SeedSedesPrincipales` | Migración de datos (SQL directo, idempotente): crea "Sede Principal" para tenants sin sedes activas, vincula barberos/citas sin `LocationId` a su Sede Principal, y vincula servicios activos en `LocationServices` para tenants con exactamente 1 sede. `Down()` vacío — no revierte datos |

## Datos de prueba (estado actual)

| Subdomain | Admin Email | Estado |
|-----------|------------|--------|
| `elegant` | santiago@elegant.com | ✅ OK |
| `elegant2` | santiago@elegant2.com | ✅ OK |
| `barberia-pasto` | *(ninguno)* | ⚠️ Sin user |
| `cosabarber` | *(ninguno)* | ⚠️ Sin user |
| `prueba` | prueba123@gmail.com | ⚠️ TenantId vacío → `UPDATE Users SET TenantId='prueba' WHERE Email='prueba123@gmail.com'` |
| `barberprueba` | barberprueba@gmail.com | ✅ OK — horarios con descanso 12:00–14:00 Lun–Vie. |
| `demobarber` | *(creado en pruebas)* | ✅ OK — sin descanso configurado |

> Nota: para pruebas/ejemplos nuevos preferir el tenant `pokemon` o crear una barbería nueva — ver memoria `feedback_test_accounts`.

### SuperAdmin (barberbook.db local)

- Email y contraseña: los definidos en `SuperAdmin:Email` / `SuperAdmin:Password` de `appsettings.Development.json` (no versionado)
- **Importante:** `DataSeeder.SeedSuperAdminAsync` solo crea el usuario SuperAdmin si no existe ninguno con ese rol — una vez creado, cambiar `SuperAdmin:Email`/`SuperAdmin:Password` en `appsettings.Development.json` **no tiene efecto** sobre una DB ya seedeada. Si se pierde la contraseña y no hay email configurado (`Email:GmailUser`/Mailtrap vacíos en dev), "Forgot Password" no es una opción — hay que resetear el `PasswordHash` directamente vía SQL con BCrypt (ver `BCrypt.Net-Next` en `Infrastructure.csproj` para generar un hash compatible).
