# Seguridad — BarberBook SaaS

## Auditoría inicial — Junio 2026

### Herramienta usada
Claude Code /security-review + skill owasp-security

### Resumen
- 5 vulnerabilidades MEDIUM encontradas
- 0 vulnerabilidades HIGH o críticas
- Auditoría realizada sobre rama main

### Vulnerabilidades encontradas y estado

| # | Vulnerabilidad | Severidad | Estado |
|---|---|---|---|
| 1 | Enumeración de emails y tenants | MEDIUM | ✅ Corregido |
| 2 | Token reprogramación reutilizable | MEDIUM | ✅ Corregido |
| 3 | Reseñas anónimas sin verificación | MEDIUM | ✅ Corregido |
| 4 | Sin validación de complejidad de contraseña | MEDIUM | ✅ Corregido |
| 5 | Token cliente enviado cross-tenant | MEDIUM | ✅ Corregido |

### Áreas con buenas prácticas confirmadas
- ✅ SQL Injection: protegido con EF Core/LINQ
- ✅ XSS: sin dangerouslySetInnerHTML
- ✅ BCrypt: hashing consistente
- ✅ JWT: HMAC-SHA256, ClockSkew=0, 1h expiración
- ✅ Multi-tenancy: query filters globales EF Core
- ✅ Uploads: validación MIME + magic bytes
- ✅ WhatsApp webhook: verificación HMAC
- ✅ Headers HTTP: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, HSTS
- ✅ CORS: whitelist restrictiva
- ✅ Refresh tokens: 64 bytes RandomNumberGenerator
- ✅ IDOR: validación appointment.CustomerId

### Fixes aplicados en esta sesión

#### Fix 1 — Validación de contraseña (VULN 4)
- Archivos modificados:
  - `BarberBookSaaS.Application/DTOs/Auth/ChangePasswordDto.cs` — DataAnnotations: MinLength(8) + RegularExpression complejidad
  - `BarberBookSaaS.Application/DTOs/Auth/ResetPasswordDto.cs` — DataAnnotations: MinLength(8) + RegularExpression complejidad
  - `BarberBookSaaS.Application/DTOs/Auth/RegisterTenantDto.cs` — DataAnnotations: RegularExpression complejidad
  - `BarberBookSaaS.Application/DTOs/Customers/RegisterCustomerDto.cs` — DataAnnotations: MinLength(8) + RegularExpression complejidad
  - `BarberBookSaaS.Infrastructure/Services/AuthService.cs` — Método `EsContrasenaSegura()` + validación en RegisterTenantAsync, ChangePasswordAsync, ResetPasswordAsync
  - `BarberBookSaaS.Infrastructure/Services/CustomerAuthService.cs` — Método `EsContrasenaSegura()` + validación en RegisterAsync, ResetPasswordAsync
- Cambio: Doble validación (DataAnnotations en DTOs + server-side en servicios). Requisitos: mín. 8 chars, 1 mayúscula, 1 minúscula, 1 dígito, 1 carácter especial
- Fecha: Junio 2026

#### Fix 2 — Cross-tenant frontend (VULN 5)
- Archivos modificados:
  - `BarberBookSaaS.Web/src/api/publicApiClient.ts` — Interceptor verifica que tenantId del token coincida con subdomain de la URL; si no coincide, limpia credenciales y no adjunta Authorization header
- Cambio: Antes de adjuntar el customer_token, extrae el subdomain de la URL (/book/:sub o /review/:sub) y lo compara con el tenantId almacenado en customer_user. Si difieren, elimina el token stale para prevenir envío cross-tenant
- Nota: Los endpoints backend de citas (POST/DELETE/PUT appointments) ya validaban `jwtTenantId != subdomain → Forbid()`. El endpoint de reviews se protege en Fix 3
- Fecha: Junio 2026

#### Fix 3 — Reseñas sin verificación (VULN 3)
- Archivos modificados:
  - `BarberBookSaaS.Domain/Entities/Review.cs` — Agregado campo `CustomerId` (Guid?) para registrar autor de la reseña
  - `BarberBookSaaS.WebApi/Controllers/PublicBookingController.cs` — Endpoint POST reviews: `[AllowAnonymous]` → `[Authorize(Roles = "Customer")]`. Validaciones: JWT tenantId vs subdomain, cita existe, cita completada, cita pertenece al cliente, no existe reseña previa para la cita
  - `BarberBookSaaS.Web/src/features/reviews/ReviewPage.tsx` — Si el cliente no está autenticado en el tenant correcto, muestra mensaje "Debes iniciar sesión para dejar una reseña" con botón al login
  - Migración EF Core: `AddCustomerIdToReview`
- Cambio: Las reseñas ahora requieren autenticación de cliente + cita completada propia + sin reseña duplicada
- Fecha: Junio 2026

#### Fix 4 — Enumeración de emails (VULN 1)
- Archivos modificados:
  - `BarberBookSaaS.Infrastructure/Services/AuthService.cs` — `GetTenantByEmailAsync` siempre retorna objeto (nunca null/404); elimina distinción SuperAdmin; agrega delay constante 100ms contra timing attacks
  - `BarberBookSaaS.Application/Common/IAuthService.cs` — Tipo de retorno cambiado de `TenantLookupDto?` a `TenantLookupDto` (nunca null)
  - `BarberBookSaaS.WebApi/Controllers/AuthController.cs` — Endpoint siempre retorna 200 OK, eliminada rama 404
- Cambio: Email no existente retorna `{ tenantId: "", tenantName: "", logoBase64: null }` con mismo timing que email existente. SuperAdmin tratado como usuario inexistente (sin revelación de rol)
- Fecha: Junio 2026

#### Fix 5 — Token reprogramación reutilizable (VULN 2)
- Archivos modificados:
  - `BarberBookSaaS.Domain/Entities/Appointment.cs` — Agregado campo `RescheduleTokenUsedAt` (DateTime?)
  - `BarberBookSaaS.WebApi/Controllers/AppointmentRescheduleLinkController.cs` — PUT: verifica `RescheduleTokenUsedAt != null` → 400 "TOKEN_USED"; tras reprogramación exitosa marca `RescheduleTokenUsedAt = UtcNow`. GET: `canReschedule` incluye condición `RescheduleTokenUsedAt is null`
  - `BarberBookSaaS.Infrastructure/Services/AppointmentService.cs` — `RescheduleAppointmentAsync` resetea `RescheduleTokenUsedAt = null` al reprogramar (permite nuevo token WhatsApp)
  - Migración EF Core: `AgregarRescheduleTokenUsedAt`
- Cambio: El token HMAC de reprogramación se invalida tras primer uso. Si la barbería envía nuevo WhatsApp con botón de reprogramar, el campo se resetea y el nuevo token funciona
- Fecha: Junio 2026

---

## Hardening adicional — Junio 2026

### Swagger oculto en produccion

- Archivo: `BarberBookSaaS.WebApi/Program.cs`
- Cambio: `AddSwaggerGen()`, `AddEndpointsApiExplorer()`, `UseSwagger()` y `UseSwaggerUI()` solo se habilitan cuando `Environment.IsDevelopment()` es true
- Resultado: `barberbook.dev/api/swagger` devuelve 404 en produccion; `localhost:5299/swagger` funciona en desarrollo

### JWT Secret como variable de entorno

- Archivo: `appsettings.json` — campo `Jwt:Key` vacio (sin secretos en el repositorio)
- Clave de desarrollo en `appsettings.Development.json` (excluido de Git via `.gitignore`)
- En produccion (Railway): configurar `Jwt__Key` como variable de entorno con clave aleatoria de minimo 32 caracteres
- Documentacion: `docs/DEPLOYMENT.md` creado con guia completa de variables de entorno para Railway
- Validacion: `Program.cs` lanza `InvalidOperationException` si `Jwt:Key` no esta configurado — la app no arranca sin clave

### Próxima auditoría recomendada
- Antes del lanzamiento a producción
- Después de cada feature mayor
- Comando: /security-review en Claude Code
