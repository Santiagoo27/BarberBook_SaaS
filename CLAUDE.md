# BarberBook SaaS — Guía del Proyecto para Claude

## Descripción General

**BarberBook SaaS** es una plataforma multi-tenant de agendamiento de citas para barberías. Cada barbería opera como un tenant aislado identificado por su subdominio. Un solo despliegue de la API sirve a múltiples barberías sin mezcla de datos.

---

## Arquitectura

```
BarberBookSaaS/
├── BarberBookSaaS.Domain/          # Entidades, constantes (UserRoles), contratos
├── BarberBookSaaS.Application/     # Interfaces de servicio, DTOs, PagedResult<T>
├── BarberBookSaaS.Infrastructure/  # EF Core, Services, SQLite
├── BarberBookSaaS.WebApi/          # ASP.NET Core 10, Controllers, Middleware
├── BarberBookSaaS.Web/             # React 18 + Vite + TypeScript + Tailwind
└── BarberBookSaaS.Tests/           # xUnit + WebApplicationFactory + SQLite aislado
```

**Stack:**
- Backend: .NET 10 / ASP.NET Core / Entity Framework Core / SQLite
- Frontend: React 18 / Vite / TypeScript / Tailwind CSS / Axios
- Auth: JWT Bearer (1h) + BCrypt (BCrypt.Net-Next) + Refresh Tokens (30 días)
- Multi-tenancy: Header `X-Tenant-Id` + claim JWT `TenantId` + QueryFilters globales EF Core

---

## Multi-Tenancy

El aislamiento opera en tres capas:

1. **`TenantMiddleware`** (`WebApi/Middleware/TenantMiddleware.cs`): extrae `TenantId` desde el header `X-Tenant-Id` o desde el claim JWT; lo inyecta en `ITenantService` (scoped).
2. **QueryFilters Globales** (`ApplicationDbContext.cs`): filtro automático `WHERE TenantId = @currentTenant` para todas las entidades que implementan `IMustHaveTenant`.
3. **Interceptor de Escritura** (`ApplyTenantIdToNewEntities`): antes de `SaveChanges`, inyecta `TenantId` activo en entidades nuevas **solo si el campo está vacío Y el service tiene tenant activo** — evita sobrescribir TenantIds explícitos (ej. durante `RegisterTenantAsync`).

El tenant se identifica por el **subdominio** elegido al crear la barbería (ej: `elegant` → `TenantId = "elegant"`). El subdominio es la clave primaria de `Tenants`, se guarda como claim en el JWT, y se envía automáticamente como `X-Tenant-Id` desde el frontend.

---

## Dominio

### Entidades

| Entidad | Tabla | Multi-tenant | Descripción |
|---------|-------|:---:|-------------|
| `Tenant` | `Tenants` | No | Barbería registrada — raíz del sistema |
| `User` | `Users` | Sí | Admin o Barbero de una barbería |
| `Barber` | `Barbers` | Sí | Barbero operacional; puede tener `UserId` vinculado |
| `Service` | `Services` | Sí | Servicio ofrecido con `DurationMinutes` e `IsActive` |
| `Appointment` | `Appointments` | Sí | Cita con validación de colisiones y `BookingResult` |
| `Customer` | `Customers` | Sí | Cliente final con auth por teléfono y loyalty |

### Roles

Definidos en `Domain/Constants/UserRoles.cs`: `Admin`, `Barbero`, `Customer`, `SuperAdmin`. **Nunca usar string literals.**

### Servicios Clave

| Interfaz | Responsabilidad |
|----------|----------------|
| `IAuthService` | Register, Login (SuperAdmin bypass), Refresh, Logout, ChangePassword |
| `ICustomerAuthService` | Auth de clientes por teléfono + contraseña; mismo esquema de refresh token |
| `IAppointmentService` | CRUD citas, colisión en memoria, slots de disponibilidad, filtro por rol, walk-in (sin cita) |
| `IBarberService` | Creación atómica Barber+User con contraseña temporal; setea `TenantId` explícito |
| `IServiceService` | CRUD de servicios con soft-delete |
| `IBrandingService` | GET/PUT branding del tenant; logo PNG → base64 en DB |
| `IDashboardService` | Métricas filtradas por rol (Admin: tenant completo; Barbero: solo propias) |
| `ILoyaltyService` | Configuración y acumulación de puntos de fidelización por tenant |
| `ISuperAdminService` | Listar tenants con stats; crear nueva barbería |
| `ITokenService` | Genera JWT con claims: `UserId`, `email`, `role`, `TenantId`, `MustChangePassword` |
| `ITenantService` | Servicio scoped; `TenantMiddleware` asigna el tenant activo en cada request |

**Códigos `BookingResult`:** `SERVICE_NOT_FOUND` (400), `SERVICE_INACTIVE` (400), `PAST_DATE` (400), `SCHEDULE_CONFLICT` (409)

---

## API Reference

Grupos de rutas: `/api/auth/*`, `/api/barbers/*`, `/api/services/*`, `/api/appointments/*`, `/api/tenant/branding|loyalty|reviews|whatsapp`, `/api/dashboard/stats|weekly-revenue`, `/api/customer/*`, `/api/public/{subdomain}/*`, `/api/whatsapp/webhook`, `/api/superadmin/*`.

> Referencia completa de endpoints, bodies y respuestas: **`docs/API_REFERENCE.md`**.

---

## Frontend

### Estructura (Admin — `BarberBookSaaS.Web/src/`)

```
api/
  apiClient.ts              # Axios: interceptores Bearer + X-Tenant-Id + retry en 401
  publicApiClient.ts        # Axios sin headers admin; inyecta JWT de cliente si existe
context/
  AuthContext.tsx           # Estado global auth: user, tenantId, loginGlobal, logout
  ThemeContext.tsx          # Tema activo + CSS variables, persiste en localStorage
features/
  landing/                  # LandingPage.tsx — landing pública en "/" (hero, valores, características, planes, contacto)
  demo/                     # DemoPage.tsx — presentación interactiva de 12 slides sin conexión al servidor
  auth/                     # Login, Register, authService, authTypes
  appointments/             # AppointmentManagement, appointmentService, appointmentTypes
  barbers/                  # BarberManagement, barberService, barberTypes
  services/                 # ServiceManagement, serviceService, serviceTypes
  dashboard/                # Dashboard.tsx, WeeklyRevenueChart.tsx, dashboardService.ts
  branding/                 # BrandingPage.tsx, brandingService.ts, brandingTypes.ts
  booking/                  # BookingPage.tsx, bookingService.ts, bookingTypes.ts
  superadmin/               # SuperAdminPage.tsx, superAdminService.ts
  reviews/                  # ReviewPage.tsx (pública), AdminReviews.tsx (admin), reviewService.ts
components/
  Sidebar.tsx               # Nav lateral + badge de rol + logout + tenant activo
  AdminLayout.tsx           # Layout con Sidebar para panel Admin
  BarberLayout.tsx          # Layout con sidebar simplificado + ChangePasswordOverlay
  SuperAdminLayout.tsx      # Layout oscuro independiente de ThemeContext
  ProtectedRoute.tsx        # Guard de rutas con prop allowedRoles
  CircularGallery.tsx       # Carrusel 3D responsive (rotación, swipe, scroll) — usado en BookingPage para servicios/barberos
  GlowCard.tsx              # Tarjeta con resplandor que sigue el cursor (data-glow + CSS vars --x/--y) — landing
  BackgroundPaths.tsx       # Fondo animado de líneas SVG (hero de landing)
  BackgroundGradientAnimation.tsx  # Fondo animado de gradientes orbitales (sección Planes de landing)
```

### Flujo de Autenticación (Admin/Barbero)

1. `Login.tsx` → usuario escribe subdominio + credenciales
2. `AuthContext.loginGlobal(credentials, subdomain)` — limpia `barber_tenant_id` stale, hace request, guarda resultado
3. localStorage: `barber_token`, `barber_refresh_token`, `barber_tenant_id`, `barber_user`, `barber_branding`
4. `apiClient` inyecta `Authorization: Bearer <token>` y `X-Tenant-Id: <tenantId>` en cada request
5. Si el backend responde 401, `apiClient` intenta refresh; si falla, limpia sesión y redirige a `/login`
6. `barber_tenant_id` **no se borra en logout** — persiste para auto-rellenar el campo subdominio en el próximo login

### Flujo de Autenticación (Cliente)

- localStorage: `customer_token`, `customer_user` (customerId, name, phone, tenantId, loyaltyCount)
- `readCustomerAuth(subdomain)` valida que `parsed.tenantId === subdomain` antes de restaurar sesión — previene contaminación cross-tenant

### Mapa de Rutas

| Ruta | Rol | Descripción |
|------|:---:|-------------|
| `/` | — | Landing pública: hero, "Qué es BarberBook", características, planes y contacto (`features/landing/LandingPage.tsx`) |
| `/login` | — | Login del panel admin (Admin + Barbero) |
| `/dashboard` | Admin | Dashboard con métricas y estadísticas |
| `/barbers` | Admin | Gestión de barberos (crear, editar, horarios) |
| `/services` | Admin | Gestión de servicios (CRUD + activar/desactivar) |
| `/appointments` | Admin | Vista y gestión de todas las citas del tenant |
| `/reviews` | Admin | Reseñas: promedio, distribución por estrellas, filtro por fecha, lista |
| `/branding` | Admin | Personalización de tema, colores y logo |
| `/barber` | Barbero | Dashboard del barbero — citas de hoy + registro de clientes sin cita |
| `/barber/schedule` | Barbero | Horario semanal del barbero (solo lectura) |
| `/superadmin` | SuperAdmin | Lista de todas las barberías + crear nueva |
| `/book/:subdomain` | — | Página pública de agendamiento para clientes |
| `/review/:subdomain` | — | Página pública de reseñas (estrellitas + comentario) |
| `/demo` | — | Presentación interactiva de 12 slides — datos ficticios, sin servidor |

**Redirecciones post-login:** Admin → `/dashboard` · Barbero → `/barber` · SuperAdmin → `/superadmin`. Catch-all `*` → `/`.

---

## Base de Datos

**SQLite:** `BarberBookSaaS.WebApi/barberbook.db`

**Crear nueva migración:**
```bash
cd BarberBookSaaS.Infrastructure
dotnet ef migrations add <NombreMigracion> --startup-project ../BarberBookSaaS.WebApi
dotnet ef database update --startup-project ../BarberBookSaaS.WebApi
```

> Historial de migraciones (14) y estado de cuentas de prueba por tenant: **`docs/BASE_DE_DATOS.md`**.

---

## Theming y Branding

**Temas base:** `dark-premium` (negro/dorado — default), `antigravity` (azul/violeta, glassmorphism), `light-modern` (blanco, estilo Notion)

**Defaults para tenant nuevo:** `dark-premium` + `#D4AF37` + `#6366F1`

**CSS Variables (`ThemeContext`):**
```css
--color-primary     --color-secondary   --color-bg
--color-sidebar     --color-surface     --color-border
--color-text        --color-text-muted
```

`ThemeContext` aplica variables al DOM y persiste en localStorage — sin flash de colores al recargar. `AuthContext.loginGlobal` carga branding desde la API y llama `applyBranding` tras login.

---

## Configuración de Desarrollo

```bash
# Backend
cd BarberBookSaaS.WebApi && dotnet run
# API:     http://localhost:5299
# Swagger: http://localhost:5299/swagger

# Frontend
cd BarberBookSaaS.Web && npm run dev
# App: http://localhost:5173
```

**CORS configurado para:** `localhost:5173`, `5500`, `8080`, `3000`

**JWT Secret:** `appsettings.json` → `Jwt:Key`. En producción: variable `Jwt__Key`.

**Si el puerto 5299 está ocupado:**
```powershell
Stop-Process -Id (netstat -ano | Select-String ":5299" | % { ($_ -split "\s+")[-1] }) -Force
```

---

## Estado del Proyecto

33 fases completadas: dominio y persistencia, auth JWT multi-tenant, paneles Admin/Barbero/SuperAdmin, booking público con loyalty, theming/branding, diagnóstico IA (Plan Premium), reseñas por QR, recordatorios WhatsApp, rediseño glassmorphism, fotos + carruseles 3D, landing pública, integración WhatsApp Business Cloud API (Meta) Fase 1 (plantillas con botones interactivos + webhook de cancelación), integración WhatsApp Business Cloud API (Meta) Fase 2 (ruta pública `/r/:token`, reprogramación anónima desde botón de WhatsApp, `RescheduleForm` compartido entre "Mis citas" y página token), demo interactiva de 12 slides (`/demo`) con datos ficticios, responsive, alerta de orientación móvil y paleta gris plateada, registro de clientes sin cita (walk-in) desde el panel del barbero con fecha/hora personalizable, gráfica de ingresos semanales con Recharts en Dashboard Admin (SCRUM-21), rediseño Crystal Liquid de selección de servicios y barberos en BookingPage (listas glassmorphism reemplazan carruseles 3D). Historial detallado por fase y fixes aplicados: **`docs/HISTORIAL.md`**.

**Tests:** 48/48 pasan.

---

## Roadmap — Pendiente

> Las fases están en orden estricto de prioridad. Completar cada una antes de arrancar la siguiente. Items ya completados: ver `docs/HISTORIAL.md`.

---

### PRIORIDAD MEDIA — Features importantes

- [x] **WhatsApp Meta Fase 2 — consumo del botón "Reprogramar"** — implementar la ruta pública `/r/:token` (frontend) que reciba el token generado por `IAppointmentTokenService.GenerateToken`, lo valide con `ValidateToken`, y abra el flujo de reprogramación (`RescheduleModal`) para la cita correspondiente. El token ya se genera y se envía como sufijo del botón "Reprogramar" desde Fase 1.
- [ ] **Carrusel "Spotlight" para sección "Características" de la landing** — reemplaza `feature-grid` (3×2) por un carrusel de 1 tarjeta grande centrada (`FeatureCarousel`) con autoplay en bucle, drag/swipe y controles (flechas + puntos); pausa con hover/drag, respeta `prefers-reduced-motion`. Spec: `docs/superpowers/specs/2026-06-11-feature-carousel-landing.md`. Plan: `docs/superpowers/plans/2026-06-11-feature-carousel-landing.md`.

---

### PRIORIDAD BAJA — Features avanzadas / APIs externas

- [ ] **Multi-servicio por cita** *(diferido — implementar cuando el volumen lo justifique)* — Decisión: usar "paquetes" como servicio compuesto (admin crea "Corte + Cejas $25 / 60min") en lugar de junction table, para no romper el modelo actual. Cuando se requiera flexibilidad total, migrar a tabla `AppointmentServices (AppointmentId, ServiceId)` con duración y precio calculados como suma.

---

### Mejoras técnicas pendientes

- [ ] Dockerización del proyecto completo (`Dockerfile` para WebApi + Nginx para Web)
- [ ] `ForwardedHeadersMiddleware` para deploy detrás de reverse proxy (nginx/Cloudflare)

---

## Decisiones de Diseño

> Tabla completa de decisiones de arquitectura/UI y su razón: **`docs/DECISIONES_DISENO.md`**.

---

## Clases CSS utilitarias de `index.css`

> Referencia completa de clases responsive: **`docs/CSS_UTILITIES.md`**.

---

## Reglas de negocio importantes

NO romper estas decisiones en el futuro:

### Citas
- El admin NO puede crear citas manualmente
- Las citas solo se crean desde:
  1. Booking público `/book/{subdomain}`
  2. El sistema automáticamente
- NUNCA agregar botón "Crear cita" en `AppointmentManagement.tsx`

### Panel Barbero
- Los botones completar/cancelar deben ser siempre prominentes y visibles
- COMPLETAR: verde grande (`#10b981`) mínimo 48px altura
- CANCELAR: rojo sutil con confirmación
- NUNCA reducir el tamaño de estos botones

---

## Skills recomendadas para Claude

> IMPORTANTE: Invocar la skill correspondiente ANTES de responder o actuar.

| Contexto | Skills a usar |
|----------|--------------|
| **Cualquier bug** (comportamiento inesperado, datos incorrectos, errores en consola) | superpowers:systematic-debugging |
| **Cualquier tarea de frontend** (nueva pantalla, componente, rediseño, ajuste visual) | superpowers:redesign-existing-projects · superpowers:minimalist-ui · superpowers:impeccable |

### Cuándo aplica cada skill de frontend

- **redesign-existing-projects** — antes de tocar cualquier componente o pantalla existente; guía cómo mejorar sin romper lo que funciona.
- **minimalist-ui** — orienta las decisiones de diseño hacia la claridad y la reducción de ruido visual.
- **impeccable** — estándar de calidad de código y UX; úsala para revisar el resultado antes de reportar la tarea como terminada.
