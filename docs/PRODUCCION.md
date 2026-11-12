# BarberBook SaaS — Guía de Producción

Documento consolidado con todo lo necesario para llevar la app a producción.

---

## Arquitectura de Hosting

| Servicio | Plataforma | Costo |
|----------|-----------|-------|
| Base de datos | Supabase PostgreSQL | Gratis (500MB) |
| Backend .NET | Railway | ~$5/mes |
| Frontend React | Vercel | Gratis |
| SSL | Automático (Railway + Vercel) | $0 |

---

## Fase 1 — Fixes de seguridad y optimización (COMPLETADA)

### Seguridad aplicada

| Fix | Detalle |
|-----|---------|
| Secrets fuera de git | JWT key, Mailtrap token, SuperAdmin password sacados de `appsettings.json`. Ahora se cargan desde `appsettings.Development.json` (gitignoreado) o variables de entorno |
| SuperAdmin externalizado | `DataSeeder.cs` lee credenciales de config. `MustChangePassword = true` por defecto |
| TenantMiddleware seguro | Valida firma JWT con `IOptionsMonitor<JwtBearerOptions>` antes de extraer TenantId. Ya no acepta tokens sin firmar |
| Rate limiting | Activo en todos los environments (solo deshabilitado en Testing). Policies: `auth` (10/15min), `public-register` (20/15min), `public-review` (5/15min) |
| Security headers | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS en producción |
| HTTPS forzado | `UseHttpsRedirection()` en todos los environments |
| CORS restringido | Headers y métodos específicos en vez de `AllowAny` |
| Password mínimo | 8 caracteres en `RegisterCustomerDto` (era 6) |

### Optimización aplicada

**Backend eliminado:**
- NuGet sin usar: `Google.Apis.Auth`, `MailKit`, `Microsoft.AspNetCore.OpenApi`
- Archivos muertos: `ForgotPasswordCustomerDto.cs`, `TwilioWhatsAppService.cs`
- Config obsoleta: sección Twilio, sección OpenAI
- Rename: `SmtpEmailService` → `MailtrapEmailService`

**Frontend eliminado:**
- Componentes: `PaperDesignBackground.tsx`, `Register.tsx`, `utils/tenant.ts`
- Assets: `react.svg`, `vite.svg`, `icons.svg`
- npm packages: `html2canvas`, `@paper-design/shaders-react`
- Código muerto: `authService.register`, `authService.logout`, `RegisterRequest`, `bookingService.getCustomerProfile`, `CustomerProfile`
- 8 clases CSS sin usar

---

## Fase 2 — Migración de base de datos (COMPLETADA en código)

### Lo que se hizo
- Paquete `Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.2 agregado
- `Program.cs` detecta automáticamente: si hay connection string → PostgreSQL, si no → SQLite (fallback local)
- `ApplicationDbContext` aplica conversión `Price→double` solo en SQLite
- Migraciones SQLite eliminadas, migración inicial limpia generada
- Tests siguen usando SQLite in-memory (sin cambios)

### Lo que falta (configuración)
Ver sección "Pasos de deploy" más abajo.

---

## Fase 3 — Features de producción (COMPLETADA en código)

### Email via Gmail
- `GmailEmailService` implementado para envío real de emails
- Lógica en `Program.cs`: si `Email:GmailUser` existe → Gmail, si no → Mailtrap (sandbox)
- Cuando se tenga dominio propio, migrar a Resend o similar

### Reset de password para clientes via WhatsApp
- Clientes se registran con teléfono (sin email), así que el reset va por WhatsApp
- Plantilla Meta: `recuperar_acceso` (en revisión de Meta)
- Backend: `ForgotPasswordByPhoneAsync` busca por teléfono → envía por WhatsApp
- Frontend: campo cambiado de email a teléfono en modal forgot-password

---

## Fase 4 — Features adicionales (Junio 2026)

### Filtro "Esta semana" en vista del barbero
- **Archivos:** BarberDashboard.tsx, appointmentService.ts
- Panel del barbero ("Mis citas") ahora tiene 3 filtros: **Hoy | Esta semana | 2 semanas**
- "Esta semana" calcula lunes a domingo de la semana actual y trae citas de ese rango
- Stats cards y empty states adaptados al filtro activo
- Sin cambios en el backend (reutiliza el endpoint `/api/appointments` con parámetros `from`/`to`)

---

## Pasos de Deploy (en orden)

### Paso 1 — Crear Supabase y conectar DB
1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ir a **Settings → Database → Connection string → URI**
3. Copiar la connection string (formato: `postgresql://postgres:PASSWORD@db.XXXX.supabase.co:5432/postgres`)
4. Pegarla en `appsettings.Development.json`:
   ```json
   "ConnectionStrings": {
     "DefaultConnection": "Host=db.XXXX.supabase.co;Port=5432;Database=postgres;Username=postgres;Password=TU_PASSWORD"
   }
   ```
5. Ejecutar migración:
   ```bash
   cd BarberBookSaaS.Infrastructure
   dotnet ef database update --startup-project ../BarberBookSaaS.WebApi
   ```
6. Verificar en SQL Editor de Supabase que las tablas se crearon

### Paso 2 — (Opcional) Regenerar migración nativa PostgreSQL
Con la connection string configurada:
```bash
cd BarberBookSaaS.Infrastructure
dotnet ef migrations remove --startup-project ../BarberBookSaaS.WebApi
dotnet ef migrations add InitialCreate --startup-project ../BarberBookSaaS.WebApi --output-dir Persistence/Migrations
```

### Paso 3 — Deploy backend en Railway
1. Crear proyecto en [railway.com](https://railway.com), conectar repo de GitHub
2. Agregar estas variables de entorno en Railway:
   ```
   ASPNETCORE_ENVIRONMENT=Production
   ConnectionStrings__DefaultConnection=postgresql://postgres:PASSWORD@db.XXXX.supabase.co:5432/postgres
   Jwt__Key=TU_JWT_KEY_SEGURA
   Jwt__Issuer=BarberBookSaaS
   Jwt__Audience=BarberBookSaaS
   Email__GmailUser=tu-correo@gmail.com
   Email__GmailAppPassword=xxxx xxxx xxxx xxxx
   SuperAdmin__Email=superadmin@barberbook.dev
   SuperAdmin__Password=TU_PASSWORD_SEGURO
   Meta__AccessToken=TU_TOKEN
   Meta__AppSecret=TU_SECRET
   Meta__VerifyToken=TU_VERIFY_TOKEN
   Meta__PhoneNumberId=TU_PHONE_ID
   Meta__TemplateLanguage=es_EC
   FrontendBaseUrl=https://TU-APP.vercel.app
   ```
3. Railway detecta .NET y despliega automáticamente
4. Copiar la URL generada (ej: `https://barberbook-api.up.railway.app`)

### Paso 4 — Deploy frontend en Vercel
1. Conectar repo en [vercel.com](https://vercel.com)
2. Configurar:
   - **Root Directory:** `BarberBookSaaS.Web`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Agregar variable de entorno:
   ```
   VITE_API_URL=https://barberbook-api.up.railway.app
   ```
4. Verificar que `publicApiClient.ts` y `apiClient.ts` usen esta variable para la baseURL

### Paso 5 — Ajustes post-deploy (código)
Estos requieren cambios de código que se pueden hacer en una sesión:

- [ ] **ForwardedHeadersMiddleware** — Railway pone un proxy delante. Sin esto, el rate limiter ve todas las requests como `127.0.0.1`:
  ```csharp
  app.UseForwardedHeaders(new ForwardedHeadersOptions {
      ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
  });
  ```
- [ ] **CORS con dominios reales** — Agregar URLs de Railway y Vercel a la política CORS en `Program.cs`
- [ ] **Health check** — Agregar `app.MapHealthChecks("/health")` para monitoreo
- [ ] **Webhook WhatsApp** — Configurar la URL de Railway en Meta Business como webhook URL (reemplazando localhost)
- [ ] **Verificar producción** — Confirmar que con `ASPNETCORE_ENVIRONMENT=Production` se activa HSTS y se desactiva Swagger

---

## Mejoras posteriores (no bloqueantes)

| Prioridad | Mejora | Detalle |
|-----------|--------|---------|
| Media | Refresh tokens en httpOnly cookies | Más seguro contra XSS que localStorage |
| Media | Logging centralizado (Serilog) | Logs persitidos para diagnóstico en producción |
| Media | Rate limit global | Fallback de 100 req/min por IP para endpoints sin policy |
| Media | Swagger deshabilitado por config | Flag explícito, no depender solo de environment |
| Baja | Content Security Policy (CSP) | Mitiga XSS |
| Baja | Auditoría de acciones admin | Log de quién hizo qué |
| Baja | 2FA para admin/superadmin | Capa extra de seguridad |
| Baja | Imágenes en S3/Cloudflare R2 | En vez de base64 en DB |
| Baja | Índice DB en RefreshToken | Performance en refresh token lookup |
| Baja | Vulnerability scanning en CI | `npm audit` + `dotnet list package --vulnerable` |

---

## Dominio personalizado

Para tener una URL profesional (ej: `barberbook.app`, `barberbook.com.ec`) en vez de `xxx.vercel.app`:

### Dónde comprar
- **Namecheap** o **Cloudflare Registrar** — los más baratos (~$10-15/año para .com)
- **Google Domains** (ahora Squarespace) — buena opción también
- Dominios `.dev` o `.app` cuestan ~$12/año e incluyen HTTPS obligatorio

### Configuración después de comprar
1. **Frontend (Vercel):** Vercel → tu proyecto → Settings → Domains → agregar tu dominio. Vercel te da los registros DNS que debes apuntar.
2. **Backend (Railway):** Railway → tu servicio → Settings → Networking → Custom Domain. Railway te da un CNAME para configurar (ej: `api.tudominio.com`).
3. **Actualizar configs:**
   - En Railway: cambiar `FrontendBaseUrl` a `https://tudominio.com`
   - En Vercel: cambiar `VITE_API_URL` a `https://api.tudominio.com`
   - En `Program.cs`: agregar dominios reales a la política CORS
4. **WhatsApp Meta:** Actualizar la URL de la plantilla `recuperar_acceso` con el dominio real (en vez de localhost)
5. **Email (futuro):** Con dominio propio puedes migrar de Gmail a **Resend** para emails más profesionales (desde `noreply@tudominio.com`)

---

## Limpieza del historial de git (antes de hacer público)

El repositorio tiene secrets en commits pasados (JWT key vieja, Mailtrap token, password de SuperAdmin, archivo `barberbook.db`). Antes de hacer público el repo hay que aplastar todo el historial en un solo commit limpio.

### Paso 1 — Tú (owner del repo)
```bash
# Asegúrate de tener todo commiteado y pusheado
git checkout main
git pull origin main

# Aplasta todo el historial en un solo commit
git reset --soft $(git rev-list --max-parents=0 HEAD)
git commit -m "feat: BarberBook SaaS - plataforma multi-tenant de agendamiento para barberías"

# Fuerza la subida (reescribe el historial remoto)
git push --force origin main
```

### Paso 2 — Tu compañero (después del force push)
El force push reescribe el historial, así que el repo local de tu compañero queda desincronizado. Tiene dos opciones:

**Opción A — Re-clonar (más simple y seguro):**
```bash
# Borrar la carpeta vieja del repo
rm -rf BarberBookSaaS  # o como se llame su carpeta

# Clonar de nuevo
git clone https://github.com/Santiagoo27/BarberBookSaaS.git
```

**Opción B — Reset al remoto (si tiene cambios que quiere conservar):**
```bash
# Si tiene cambios locales sin pushear, primero guardarlos
git stash  # solo si tiene cambios pendientes

# Descargar el nuevo historial y resetear
git fetch origin
git reset --hard origin/main

# Si guardó cambios, re-aplicarlos
git stash pop  # solo si hizo stash antes
```

**¿Por qué tiene que hacer esto?** Cuando haces `git push --force`, el historial remoto cambia completamente — los 50+ commits viejos desaparecen y queda solo 1 commit nuevo. El repo local de tu compañero sigue apuntando a los commits viejos que ya no existen en el remoto. Si intenta hacer `git pull` normal, Git va a intentar mergear dos historiales incompatibles y creará un desastre. Por eso necesita re-clonar o hacer reset --hard al nuevo remoto.
