# WhatsApp Meta Cloud API — Fase 1 (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar/complementar el envío de WhatsApp basado en Twilio con la **Meta WhatsApp Business Cloud API** (mensajes de plantilla con botones interactivos), añadir un webhook que reciba respuestas del cliente (cancelación vía botón "Cancelar cita"), y dejar infraestructura lista (tokens firmados por cita) para la Fase 2 (reprogramar desde WhatsApp).

**Architecture:** `MetaWhatsAppService` implementa `IWhatsAppService` (mismo contrato que `ConsoleWhatsAppService`/`TwilioWhatsAppService`) y se selecciona en `Program.cs` según configuración (`Twilio` > `Meta` > `Console`, en ese orden de prioridad). Cada tenant configura su propio `MetaPhoneNumberId` desde `/branding`. Los mensajes salientes son plantillas (`cita_confirmada`, `cita_reprogramada`, `cita_recordatorio`, `cita_cancelada`) con 3 variables de cuerpo y botones (Reprogramar / Cancelar cita). Un nuevo `IAppointmentTokenService` genera tokens HMAC-SHA256 firmados por cita, usados como sufijo dinámico del botón "Reprogramar" (consumo en Fase 2). Un nuevo `WhatsAppWebhookController` verifica el webhook (GET) y procesa eventos `messages` (POST) — en Fase 1 solo el payload `CANCELAR_CITA`, resolviendo el tenant por `MetaPhoneNumberId` y cancelando la cita correspondiente.

**Tech Stack:** .NET 10 / ASP.NET Core / EF Core / SQLite, `HttpClient` + `System.Text.Json` (sin SDK de Meta), `System.Security.Cryptography.HMACSHA256`, xUnit + `WebApplicationFactory`.

---

## Decisiones de diseño para esta fase

**B. Nuevas firmas de `IWhatsAppService`.** Los 4 métodos (`SendReminderAsync`, `SendConfirmationAsync`, `SendRescheduleAsync`, `SendCancellationAsync`) ganan un primer parámetro `Guid appointmentId` y un último parámetro `string? metaPhoneNumberId`. Ningún test existente referencia `IWhatsAppService` (confirmado por grep), así que el refactor de firma no rompe la suite actual.

**C. `IAppointmentTokenService`.** `GenerateToken(Guid appointmentId, DateTime expiresAtUtc) -> string` / `ValidateToken(string token) -> Guid?`. Firma HMAC-SHA256 reutilizando `Jwt:Key`. Formato: `{base64url(payload)}.{base64url(firma)}`, donde `payload = "{appointmentId:N}|{expiresAtUtc.Ticks}"`.

**D. Plantillas — variables y botones.** Las 4 plantillas comparten 3 variables de cuerpo: `{{1}}` = `customerName`, `{{2}}` = fecha/hora formateada `dd/MM/yyyy 'a las' HH:mm`, `{{3}}` = `barberName`. `cita_confirmada`, `cita_reprogramada` y `cita_recordatorio` añaden 2 botones en este orden: índice 0 = "Reprogramar" (CTA-URL con sufijo dinámico), índice 1 = "Cancelar cita" (Quick Reply, payload `CANCELAR_CITA`).

**E. Expiración del token = `appointmentDate` directo.** `AppointmentTokenService` recibe `appointmentDate` como `expiresAtUtc` sin convertir a UTC, y `ValidateToken` compara contra `DateTime.UtcNow`. Es una simplificación deliberada, consistente con el manejo laxo de fechas que ya existe en `AppointmentService` (`newStart < DateTime.Now`).

**F. `cita_cancelada` sin botones.** No tiene sentido reprogramar/cancelar una cita ya cancelada. Las otras 3 plantillas comparten body (3 vars) + 2 botones.

**G. Sin `Meta:PhoneNumberId` global.** La sección `Meta` de `appsettings.json` solo tiene `AccessToken`, `AppSecret`, `VerifyToken`, `ApiVersion`, `TemplateLanguage`. El `phone_number_id` es estrictamente por-tenant (`Tenant.MetaPhoneNumberId`). Si está vacío, `MetaWhatsAppService` registra un warning y no envía (sin fallback).

**H. Sufijo del botón "Reprogramar" = token firmado.** `IAppointmentTokenService.GenerateToken(appointmentId, appointmentDate)`. La ruta `/r/:token` que consumirá ese token en el frontend es **Fase 2 / fuera de alcance** — `AppointmentTokenService` se construye ahora como infraestructura testeada y forward-compatible.

**I. Webhook Fase 1 — solo `CANCELAR_CITA`.** El controlador resuelve el tenant comparando `Tenant.MetaPhoneNumberId == metadata.phone_number_id` del payload, fija `_tenantService.TenantId = tenant.Id` explícitamente (el webhook no trae JWT ni `X-Tenant-Id`), busca entre las citas `Pending` del tenant la que coincide por teléfono y toma la más próxima por `AppointmentDate`, y llama `_appointmentService.UpdateStatusAsync(appointment.Id, AppointmentStatus.Cancelled, "whatsapp")` (que a su vez dispara `SendCancellationAsync` como confirmación al cliente).

**J. Idioma de plantilla configurable.** Nueva clave `Meta:TemplateLanguage` (default `es_MX`). Debe coincidir exactamente con el idioma configurado para las 4 plantillas en Meta Business Manager.

**K. Emparejamiento de teléfono en el webhook = igualdad exacta de dígitos.** Se normalizan `Appointment.CustomerPhone` y el `from` del webhook a solo dígitos y se comparan con `==` (no `EndsWith`). Esto requiere que `CustomerPhone` incluya el código de país — ya es el caso en el flujo de registro actual. Limitación conocida para Fase 2 si se requiere mayor tolerancia.

---

## Prerrequisitos — Meta Business Manager

Estos pasos se hacen en [developers.facebook.com](https://developers.facebook.com) (Meta for Developers), **fuera del código**. No bloquean el desarrollo de Tareas 1-9 (que usan stubs/config vacía + tests), pero son necesarios para probar contra la API real.

1. **Crear la app de Meta.** En "My Apps" → "Create App" → tipo "Business" → añadir el producto **WhatsApp**.

2. **Número de prueba + token temporal.** En "WhatsApp" → "API Setup" verás un número de prueba con su **Phone number ID** y un **Temporary access token** (expira en 24h) — sirve para las primeras pruebas manuales.

3. **Token permanente (System User).** En "Business Settings" → "Users" → "System Users" → crear uno con rol Admin, asignarle la app de WhatsApp con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`, y generar un token sin expiración. Este es el valor de `Meta:AccessToken`.

4. **Elegir `Meta:VerifyToken`.** Es un string secreto que tú defines (ej. generado con `openssl rand -hex 16`). Meta lo reenvía sin modificar durante la verificación del webhook; tu endpoint debe compararlo con el valor configurado.

5. **Configurar el webhook.** En "WhatsApp" → "Configuration" → "Webhook": Callback URL = `https://<tu-dominio-publico>/api/whatsapp/webhook`, Verify Token = el del paso 4. Requiere HTTPS público — en desarrollo usa `ngrok http 5299` o Cloudflare Tunnel. Tras verificar, suscríbete al campo **`messages`**.

6. **Crear las 4 plantillas** en "WhatsApp" → "Message Templates" (categoría **Utility**, idioma = el valor de `Meta:TemplateLanguage`, default `es_MX`):
   - `cita_confirmada`, `cita_reprogramada`, `cita_recordatorio`: cuerpo con 3 variables `{{1}} {{2}} {{3}}` + 2 botones — botón 1 "Reprogramar" (tipo **Call to action → Visit website**, URL dinámica con sufijo `{{1}}`), botón 2 "Cancelar cita" (tipo **Quick reply**).
   - `cita_cancelada`: mismo cuerpo de 3 variables, **sin botones**.
   - Espera la aprobación de Meta (minutos a horas).

7. **Obtener `AppSecret`.** En "App settings" → "Basic" → "App secret" → "Show". Es el valor de `Meta:AppSecret`, usado para validar la firma `X-Hub-Signature-256` del webhook.

8. **Configurar `MetaPhoneNumberId` por tenant.** Desde `/branding` (Admin, implementado en Tareas 2-3), cada barbería pega el `phone_number_id` de su número de WhatsApp (el de prueba del paso 2, o el de producción una vez migrado el número de la barbería a la app de Meta).

9. **Cargar config en `appsettings.json`** (o variables de entorno en producción: `Meta__AccessToken`, `Meta__AppSecret`, `Meta__VerifyToken`): `AccessToken` (token del paso 3), `AppSecret` (paso 7), `VerifyToken` (paso 4).

---

## File Structure

**Crear:**
- `BarberBookSaaS.Application/Common/IAppointmentTokenService.cs`
- `BarberBookSaaS.Infrastructure/Services/AppointmentTokenService.cs`
- `BarberBookSaaS.Infrastructure/Services/MetaWhatsAppService.cs`
- `BarberBookSaaS.WebApi/Controllers/WhatsAppWebhookController.cs`
- `BarberBookSaaS.Tests/Helpers/CapturingHttpMessageHandler.cs`
- `BarberBookSaaS.Tests/BrandingMetaPhoneNumberTests.cs`
- `BarberBookSaaS.Tests/AppointmentTokenServiceTests.cs`
- `BarberBookSaaS.Tests/MetaWhatsAppServiceTests.cs`
- `BarberBookSaaS.Tests/WhatsAppWebhookTests.cs`

**Modificar:**
- `BarberBookSaaS.Domain/Entities/Tenant.cs` (+`MetaPhoneNumberId`)
- `BarberBookSaaS.Application/DTOs/Branding/TenantBrandingDto.cs` (+`MetaPhoneNumberId`)
- `BarberBookSaaS.Application/DTOs/Branding/UpdateWhatsAppDto.cs` (+`MetaPhoneNumberId`)
- `BarberBookSaaS.Application/Common/IBrandingService.cs` (firma `UpdateWhatsAppAsync`)
- `BarberBookSaaS.Infrastructure/Services/BrandingService.cs` (GetBrandingAsync + UpdateWhatsAppAsync)
- `BarberBookSaaS.WebApi/Controllers/BrandingController.cs` (UpdateWhatsApp action)
- `BarberBookSaaS.Web/src/features/branding/brandingTypes.ts` (+`metaPhoneNumberId`)
- `BarberBookSaaS.Web/src/features/branding/brandingService.ts` (updateWhatsApp 3er param)
- `BarberBookSaaS.Web/src/features/branding/BrandingPage.tsx` (UI campo MetaPhoneNumberId)
- `BarberBookSaaS.WebApi/appsettings.json` (sección `Meta`)
- `BarberBookSaaS.Tests/Helpers/TestWebApplicationFactory.cs` (config `Meta:AppSecret`/`Meta:VerifyToken`)
- `BarberBookSaaS.Application/Common/IWhatsAppService.cs` (nuevas firmas)
- `BarberBookSaaS.Infrastructure/Services/ConsoleWhatsAppService.cs` (nuevas firmas)
- `BarberBookSaaS.Infrastructure/Services/TwilioWhatsAppService.cs` (nuevas firmas)
- `BarberBookSaaS.Infrastructure/Services/AppointmentService.cs` (2 call sites)
- `BarberBookSaaS.WebApi/Controllers/PublicBookingController.cs` (2 call sites)
- `BarberBookSaaS.WebApi/AppointmentReminderHostedService.cs` (1 call site)
- `BarberBookSaaS.WebApi/Program.cs` (DI: `IAppointmentTokenService` + selección 3 vías de `IWhatsAppService`)
- `docs/HISTORIAL.md`, `docs/API_REFERENCE.md`, `docs/BASE_DE_DATOS.md`, `docs/DECISIONES_DISENO.md`, `CLAUDE.md`

---

### Task 1: `Tenant.MetaPhoneNumberId` + Migración

**Files:**
- Modify: `BarberBookSaaS.Domain/Entities/Tenant.cs:22`
- Create: migración EF (generada por CLI)

- [ ] **Step 1: Agregar la propiedad a `Tenant`**

En `BarberBookSaaS.Domain/Entities/Tenant.cs`, después de la línea 22 (`public string? WhatsAppPhone { get; set; }`):

```csharp
    public string? WhatsAppPhone { get; set; }
    public string? MetaPhoneNumberId { get; set; }
}
```

- [ ] **Step 2: Generar la migración**

```bash
cd BarberBookSaaS.Infrastructure
dotnet ef migrations add AgregarMetaPhoneNumberId --startup-project ../BarberBookSaaS.WebApi
```

Expected: se crea `Migrations/<timestamp>_AgregarMetaPhoneNumberId.cs` cuyo `Up()` contiene:

```csharp
migrationBuilder.AddColumn<string>(
    name: "MetaPhoneNumberId",
    table: "Tenants",
    type: "TEXT",
    nullable: true);
```

y `Down()` contiene `migrationBuilder.DropColumn(name: "MetaPhoneNumberId", table: "Tenants");`.

- [ ] **Step 3: Aplicar la migración a la base de datos local**

```bash
dotnet ef database update --startup-project ../BarberBookSaaS.WebApi
```

Expected: `Done.` sin errores.

- [ ] **Step 4: Commit**

```bash
git add BarberBookSaaS.Domain/Entities/Tenant.cs BarberBookSaaS.Infrastructure/Persistence/Migrations/
git commit -m "feat: agrega MetaPhoneNumberId a Tenant (migracion 14)"
```

---

### Task 2: Branding — persistencia de `MetaPhoneNumberId` (backend)

**Files:**
- Modify: `BarberBookSaaS.Application/DTOs/Branding/TenantBrandingDto.cs`
- Modify: `BarberBookSaaS.Application/DTOs/Branding/UpdateWhatsAppDto.cs`
- Modify: `BarberBookSaaS.Application/Common/IBrandingService.cs`
- Modify: `BarberBookSaaS.Infrastructure/Services/BrandingService.cs`
- Modify: `BarberBookSaaS.WebApi/Controllers/BrandingController.cs`
- Test: `BarberBookSaaS.Tests/BrandingMetaPhoneNumberTests.cs`

- [ ] **Step 1: Escribir el test (fallará — DTO/endpoint aún no soportan `metaPhoneNumberId`)**

Crear `BarberBookSaaS.Tests/BrandingMetaPhoneNumberTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using BarberBookSaaS.Tests.Helpers;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BarberBookSaaS.Tests;

public class BrandingMetaPhoneNumberTests : IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory = new();
    private HttpClient _client = null!;
    private const string TenantId = "meta-t1";

    public async Task InitializeAsync()
    {
        await _factory.InitializeDbAsync();
        _client = _factory.CreateClient();
        await SeedAsync();
        _client.SetAuth(TestAuthHelper.AdminToken(TenantId), TenantId);
    }

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private async Task SeedAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.Tenants.Add(new Tenant { Id = TenantId, Name = "Meta Test", Subdomain = TenantId });
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task UpdateWhatsApp_PersistsMetaPhoneNumberId()
    {
        var response = await _client.PutAsJsonAsync("/api/tenant/whatsapp", new
        {
            enabled = true,
            phone = "+573001234567",
            metaPhoneNumberId = "123456789012345"
        });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var getResponse = await _client.GetAsync("/api/tenant/branding");
        var body = await getResponse.Content.ReadFromJsonAsync<JsonElement>();

        Assert.True(body.GetProperty("whatsAppEnabled").GetBoolean());
        Assert.Equal("+573001234567", body.GetProperty("whatsAppPhone").GetString());
        Assert.Equal("123456789012345", body.GetProperty("metaPhoneNumberId").GetString());
    }

    [Fact]
    public async Task UpdateWhatsApp_BlankMetaPhoneNumberId_StoresNull()
    {
        await _client.PutAsJsonAsync("/api/tenant/whatsapp", new
        {
            enabled = false,
            phone = "",
            metaPhoneNumberId = "  "
        });

        var getResponse = await _client.GetAsync("/api/tenant/branding");
        var body = await getResponse.Content.ReadFromJsonAsync<JsonElement>();

        Assert.False(body.GetProperty("whatsAppEnabled").GetBoolean());
        Assert.Equal(JsonValueKind.Null, body.GetProperty("metaPhoneNumberId").ValueKind);
    }
}
```

- [ ] **Step 2: Ejecutar y verificar que falla**

```bash
dotnet test --filter BrandingMetaPhoneNumberTests
```

Expected: FAIL — el cuerpo del PUT no tiene `metaPhoneNumberId` en `UpdateWhatsAppDto`, y `GetBrandingAsync` no devuelve esa propiedad (la aserción `GetProperty("metaPhoneNumberId")` lanza `KeyNotFoundException`).

- [ ] **Step 3: Agregar `MetaPhoneNumberId` a `TenantBrandingDto`**

En `BarberBookSaaS.Application/DTOs/Branding/TenantBrandingDto.cs`, después de `WhatsAppPhone`:

```csharp
public class TenantBrandingDto
{
    public string Theme { get; set; } = "dark-premium";
    public string PrimaryColor { get; set; } = "#D4AF37";
    public string SecondaryColor { get; set; } = "#6366F1";
    public string? LogoBase64 { get; set; }
    public string? Name { get; set; }
    public string? Address { get; set; }
    public string Plan { get; set; } = "Standard";
    public bool WhatsAppEnabled { get; set; } = false;
    public string? WhatsAppPhone { get; set; }
    public string? MetaPhoneNumberId { get; set; }
}
```

- [ ] **Step 4: Agregar `MetaPhoneNumberId` a `UpdateWhatsAppDto`**

`BarberBookSaaS.Application/DTOs/Branding/UpdateWhatsAppDto.cs`:

```csharp
namespace BarberBookSaaS.Application.DTOs.Branding;

public class UpdateWhatsAppDto
{
    public bool Enabled { get; set; }
    public string? Phone { get; set; }
    public string? MetaPhoneNumberId { get; set; }
}
```

- [ ] **Step 5: Actualizar `IBrandingService`**

En `BarberBookSaaS.Application/Common/IBrandingService.cs`, cambiar la línea 11:

```csharp
    Task<bool> UpdateWhatsAppAsync(bool enabled, string? phone, string? metaPhoneNumberId);
```

- [ ] **Step 6: Actualizar `BrandingService`**

En `BarberBookSaaS.Infrastructure/Services/BrandingService.cs`, dentro de `GetBrandingAsync` (líneas 26-35), agregar la nueva propiedad al `return new TenantBrandingDto { ... }`:

```csharp
        return new TenantBrandingDto
        {
            Theme = tenant.Theme,
            PrimaryColor = tenant.PrimaryColor,
            SecondaryColor = tenant.SecondaryColor,
            LogoBase64 = tenant.LogoBase64,
            Plan = tenant.Plan,
            WhatsAppEnabled = tenant.WhatsAppEnabled,
            WhatsAppPhone = tenant.WhatsAppPhone,
            MetaPhoneNumberId = tenant.MetaPhoneNumberId
        };
```

Y reemplazar `UpdateWhatsAppAsync` (líneas 65-77) completo:

```csharp
    public async Task<bool> UpdateWhatsAppAsync(bool enabled, string? phone, string? metaPhoneNumberId)
    {
        var tenant = await _context.Tenants
            .FirstOrDefaultAsync(t => t.Subdomain == _tenantService.TenantId);

        if (tenant is null) return false;

        tenant.WhatsAppEnabled = enabled;
        tenant.WhatsAppPhone = string.IsNullOrWhiteSpace(phone) ? null : phone.Trim();
        tenant.MetaPhoneNumberId = string.IsNullOrWhiteSpace(metaPhoneNumberId) ? null : metaPhoneNumberId.Trim();

        await _context.SaveChangesAsync();
        return true;
    }
```

- [ ] **Step 7: Actualizar `BrandingController`**

En `BarberBookSaaS.WebApi/Controllers/BrandingController.cs`, línea 87:

```csharp
        var success = await _brandingService.UpdateWhatsAppAsync(dto.Enabled, dto.Phone, dto.MetaPhoneNumberId);
```

- [ ] **Step 8: Ejecutar y verificar que pasa**

```bash
dotnet test --filter BrandingMetaPhoneNumberTests
```

Expected: PASS (2/2). Suite completa: 22/22.

- [ ] **Step 9: Commit**

```bash
git add BarberBookSaaS.Application BarberBookSaaS.Infrastructure/Services/BrandingService.cs BarberBookSaaS.WebApi/Controllers/BrandingController.cs BarberBookSaaS.Tests/BrandingMetaPhoneNumberTests.cs
git commit -m "feat: persiste MetaPhoneNumberId en branding (tenant.whatsapp)"
```

---

### Task 3: Branding — UI de `MetaPhoneNumberId` (frontend)

**Files:**
- Modify: `BarberBookSaaS.Web/src/features/branding/brandingTypes.ts`
- Modify: `BarberBookSaaS.Web/src/features/branding/brandingService.ts`
- Modify: `BarberBookSaaS.Web/src/features/branding/BrandingPage.tsx`

No hay test automatizado de frontend en este repo (no hay suite de Vitest/Jest configurada) — la verificación de este task es manual en el navegador (Step 5).

- [ ] **Step 1: Agregar el campo al tipo `TenantBranding`**

En `BarberBookSaaS.Web/src/features/branding/brandingTypes.ts`:

```typescript
export interface TenantBranding {
  theme: string;
  primaryColor: string;
  secondaryColor: string;
  logoBase64?: string;
  name?: string;
  address?: string;
  whatsAppEnabled?: boolean;
  whatsAppPhone?: string;
  metaPhoneNumberId?: string;
}

export interface UpdateBrandingDto {
  theme: string;
  primaryColor: string;
  secondaryColor: string;
}
```

- [ ] **Step 2: Actualizar `brandingService.updateWhatsApp`**

En `BarberBookSaaS.Web/src/features/branding/brandingService.ts`, líneas 25-27:

```typescript
  updateWhatsApp: async (enabled: boolean, phone: string, metaPhoneNumberId: string): Promise<void> => {
    await apiClient.put("/api/tenant/whatsapp", { enabled, phone, metaPhoneNumberId });
  },
```

- [ ] **Step 3: Agregar estado y carga inicial en `BrandingPage.tsx`**

Agregar el estado, junto a `whatsAppPhone`/`setWhatsAppPhone` (línea 88):

```typescript
  const [whatsAppPhone, setWhatsAppPhone]       = useState("");
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState("");
```

En el `useEffect` de carga (líneas 98-105), junto a `setWhatsAppPhone`:

```typescript
    brandingService.getBranding().then((b) => {
      setBranding(b);
      setSelectedTheme(b.theme || "dark-premium");
      setPrimaryColor(b.primaryColor || "#D4AF37");
      setSecondaryColor(b.secondaryColor || "#6366F1");
      setWhatsAppEnabled(b.whatsAppEnabled ?? false);
      setWhatsAppPhone(b.whatsAppPhone ?? "");
      setMetaPhoneNumberId(b.metaPhoneNumberId ?? "");
    });
```

- [ ] **Step 4: Actualizar `handleSaveWA` y agregar el campo en el JSX**

`handleSaveWA` (líneas 152-159):

```typescript
  const handleSaveWA = async () => {
    setSavingWA(true);
    try {
      await brandingService.updateWhatsApp(whatsAppEnabled, whatsAppPhone, metaPhoneNumberId);
      setSavedWA(true);
      setTimeout(() => setSavedWA(false), 2500);
    } finally { setSavingWA(false); }
  };
```

En el JSX de la `SectionCard` "Recordatorios por WhatsApp" (después del bloque "Phone input", líneas 412-428, y antes del botón "Guardar configuración"):

```tsx
          {/* Phone input */}
          <div>
            <p style={{ color: "var(--color-text-muted)", fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
              Número de WhatsApp (ej: +573001234567)
            </p>
            <input
              type="tel"
              value={whatsAppPhone}
              onChange={e => setWhatsAppPhone(e.target.value)}
              placeholder="+57 300 123 4567"
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 13,
                background: "var(--color-surface)", color: "var(--color-text)",
                border: "1px solid var(--color-border)", outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Meta Phone Number ID input */}
          <div>
            <p style={{ color: "var(--color-text-muted)", fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
              Meta Phone Number ID (API de WhatsApp Business)
            </p>
            <input
              type="text"
              value={metaPhoneNumberId}
              onChange={e => setMetaPhoneNumberId(e.target.value)}
              placeholder="123456789012345"
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 13,
                background: "var(--color-surface)", color: "var(--color-text)",
                border: "1px solid var(--color-border)", outline: "none",
                boxSizing: "border-box",
              }}
            />
            <p style={{ color: "var(--color-text-muted)", fontSize: 11, marginTop: 6 }}>
              Lo obtienes en Meta Business Manager → WhatsApp → API Setup. Requerido para enviar plantillas vía Meta.
            </p>
          </div>

          <button
            onClick={handleSaveWA}
            disabled={savingWA}
            className="btn-primary"
            style={{ alignSelf: "flex-start", padding: "8px 20px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: savingWA ? 0.6 : 1 }}
          >
            {savingWA ? "Guardando..." : savedWA ? "Guardado" : "Guardar configuración"}
          </button>
```

- [ ] **Step 5: Verificación manual en el navegador**

```bash
cd BarberBookSaaS.WebApi && dotnet run
```
```bash
cd BarberBookSaaS.Web && npm run dev
```

Ir a `http://localhost:5173/branding` con sesión Admin. Verificar: el nuevo campo "Meta Phone Number ID" aparece bajo el teléfono de WhatsApp, guarda correctamente (toast "Guardado") y persiste tras recargar la página.

- [ ] **Step 6: Commit**

```bash
git add BarberBookSaaS.Web/src/features/branding
git commit -m "feat: agrega campo MetaPhoneNumberId al panel de branding"
```

---

### Task 4: Configuración Meta — `appsettings.json` + `TestWebApplicationFactory`

**Files:**
- Modify: `BarberBookSaaS.WebApi/appsettings.json`
- Modify: `BarberBookSaaS.Tests/Helpers/TestWebApplicationFactory.cs`

- [ ] **Step 1: Agregar la sección `Meta` a `appsettings.json`**

En `BarberBookSaaS.WebApi/appsettings.json`, después de la sección `Twilio` (línea 21):

```json
  "Twilio": {
    "AccountSid": "",
    "AuthToken": "",
    "WhatsAppFrom": ""
  },
  "Meta": {
    "AccessToken": "",
    "AppSecret": "",
    "VerifyToken": "",
    "ApiVersion": "v21.0",
    "TemplateLanguage": "es_MX"
  },
```

- [ ] **Step 2: Inyectar config de test (`Meta:AppSecret` / `Meta:VerifyToken`)**

En `BarberBookSaaS.Tests/Helpers/TestWebApplicationFactory.cs`, agregar el using y el bloque `ConfigureAppConfiguration` antes de `ConfigureServices`:

```csharp
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
                ["Meta:AppSecret"] = "test-app-secret",
                ["Meta:VerifyToken"] = "test-verify-token"
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
```

- [ ] **Step 3: Ejecutar la suite completa para confirmar que nada se rompió**

```bash
dotnet test
```

Expected: PASS (22/22).

- [ ] **Step 4: Commit**

```bash
git add BarberBookSaaS.WebApi/appsettings.json BarberBookSaaS.Tests/Helpers/TestWebApplicationFactory.cs
git commit -m "feat: agrega configuracion Meta (appsettings + test factory)"
```

---

### Task 5: `IAppointmentTokenService` (HMAC)

**Files:**
- Create: `BarberBookSaaS.Application/Common/IAppointmentTokenService.cs`
- Create: `BarberBookSaaS.Infrastructure/Services/AppointmentTokenService.cs`
- Test: `BarberBookSaaS.Tests/AppointmentTokenServiceTests.cs`

- [ ] **Step 1: Escribir los tests (fallarán — la clase no existe)**

Crear `BarberBookSaaS.Tests/AppointmentTokenServiceTests.cs`:

```csharp
using BarberBookSaaS.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace BarberBookSaaS.Tests;

public class AppointmentTokenServiceTests
{
    private static AppointmentTokenService CreateService()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "YOUR_JWT_KEY_HERE"
            })
            .Build();

        return new AppointmentTokenService(config);
    }

    [Fact]
    public void GenerateAndValidate_RoundTrip_ReturnsAppointmentId()
    {
        var service = CreateService();
        var appointmentId = Guid.NewGuid();
        var expiresAt = DateTime.UtcNow.AddDays(1);

        var token = service.GenerateToken(appointmentId, expiresAt);
        var result = service.ValidateToken(token);

        Assert.Equal(appointmentId, result);
    }

    [Fact]
    public void Validate_ExpiredToken_ReturnsNull()
    {
        var service = CreateService();
        var appointmentId = Guid.NewGuid();
        var expiresAt = DateTime.UtcNow.AddDays(-1);

        var token = service.GenerateToken(appointmentId, expiresAt);
        var result = service.ValidateToken(token);

        Assert.Null(result);
    }

    [Fact]
    public void Validate_TamperedToken_ReturnsNull()
    {
        var service = CreateService();
        var appointmentId = Guid.NewGuid();
        var expiresAt = DateTime.UtcNow.AddDays(1);

        var token = service.GenerateToken(appointmentId, expiresAt);
        var tampered = token[..^1] + (token[^1] == 'A' ? 'B' : 'A');
        var result = service.ValidateToken(tampered);

        Assert.Null(result);
    }

    [Fact]
    public void Validate_MalformedToken_ReturnsNull()
    {
        var service = CreateService();

        Assert.Null(service.ValidateToken("not-a-valid-token"));
        Assert.Null(service.ValidateToken(""));
        Assert.Null(service.ValidateToken("onlyonepart"));
    }
}
```

- [ ] **Step 2: Ejecutar y verificar que falla**

```bash
dotnet test --filter AppointmentTokenServiceTests
```

Expected: FAIL — `AppointmentTokenService` no existe (error de compilación).

- [ ] **Step 3: Crear `IAppointmentTokenService`**

`BarberBookSaaS.Application/Common/IAppointmentTokenService.cs`:

```csharp
namespace BarberBookSaaS.Application.Common;

public interface IAppointmentTokenService
{
    string GenerateToken(Guid appointmentId, DateTime expiresAtUtc);

    Guid? ValidateToken(string token);
}
```

- [ ] **Step 4: Crear `AppointmentTokenService`**

`BarberBookSaaS.Infrastructure/Services/AppointmentTokenService.cs`:

```csharp
using System.Security.Cryptography;
using System.Text;
using BarberBookSaaS.Application.Common;
using Microsoft.Extensions.Configuration;

namespace BarberBookSaaS.Infrastructure.Services;

public class AppointmentTokenService : IAppointmentTokenService
{
    private readonly byte[] _key;

    public AppointmentTokenService(IConfiguration config)
    {
        var jwtKey = config["Jwt:Key"]
            ?? throw new InvalidOperationException("JWT key 'Jwt:Key' is not configured in appsettings.json.");

        _key = Encoding.UTF8.GetBytes(jwtKey);
    }

    public string GenerateToken(Guid appointmentId, DateTime expiresAtUtc)
    {
        var payload = $"{appointmentId:N}|{expiresAtUtc.Ticks}";
        var payloadBytes = Encoding.UTF8.GetBytes(payload);

        using var hmac = new HMACSHA256(_key);
        var signatureBytes = hmac.ComputeHash(payloadBytes);

        return $"{Base64UrlEncode(payloadBytes)}.{Base64UrlEncode(signatureBytes)}";
    }

    public Guid? ValidateToken(string token)
    {
        var segments = token.Split('.');
        if (segments.Length != 2) return null;

        byte[] payloadBytes;
        byte[] signatureBytes;
        try
        {
            payloadBytes = Base64UrlDecode(segments[0]);
            signatureBytes = Base64UrlDecode(segments[1]);
        }
        catch (FormatException)
        {
            return null;
        }

        using var hmac = new HMACSHA256(_key);
        var expectedSignature = hmac.ComputeHash(payloadBytes);

        if (!CryptographicOperations.FixedTimeEquals(expectedSignature, signatureBytes))
            return null;

        var payload = Encoding.UTF8.GetString(payloadBytes);
        var parts = payload.Split('|');
        if (parts.Length != 2) return null;

        if (!Guid.TryParseExact(parts[0], "N", out var appointmentId)) return null;
        if (!long.TryParse(parts[1], out var expiresAtTicks)) return null;

        var expiresAtUtc = new DateTime(expiresAtTicks, DateTimeKind.Utc);
        if (DateTime.UtcNow > expiresAtUtc) return null;

        return appointmentId;
    }

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=');

    private static byte[] Base64UrlDecode(string value)
    {
        var padded = value.Replace('-', '+').Replace('_', '/');
        switch (padded.Length % 4)
        {
            case 2: padded += "=="; break;
            case 3: padded += "="; break;
        }
        return Convert.FromBase64String(padded);
    }
}
```

- [ ] **Step 5: Registrar en `Program.cs`**

En `BarberBookSaaS.WebApi/Program.cs`, después de la línea 58 (`builder.Services.AddScoped<ISuperAdminService, SuperAdminService>();`):

```csharp
builder.Services.AddScoped<ISuperAdminService, SuperAdminService>();
builder.Services.AddSingleton<IAppointmentTokenService, AppointmentTokenService>();
builder.Services.AddHttpClient<IEmailService, SmtpEmailService>();
```

- [ ] **Step 6: Ejecutar y verificar que pasa**

```bash
dotnet test --filter AppointmentTokenServiceTests
```

Expected: PASS (4/4). Suite completa: 26/26.

- [ ] **Step 7: Commit**

```bash
git add BarberBookSaaS.Application/Common/IAppointmentTokenService.cs BarberBookSaaS.Infrastructure/Services/AppointmentTokenService.cs BarberBookSaaS.Tests/AppointmentTokenServiceTests.cs BarberBookSaaS.WebApi/Program.cs
git commit -m "feat: agrega AppointmentTokenService (tokens HMAC firmados por cita)"
```

---

### Task 6: Refactor `IWhatsAppService` — nuevas firmas + call sites

**Files:**
- Modify: `BarberBookSaaS.Application/Common/IWhatsAppService.cs`
- Modify: `BarberBookSaaS.Infrastructure/Services/ConsoleWhatsAppService.cs`
- Modify: `BarberBookSaaS.Infrastructure/Services/TwilioWhatsAppService.cs`
- Modify: `BarberBookSaaS.Infrastructure/Services/AppointmentService.cs:71-82,162-175`
- Modify: `BarberBookSaaS.WebApi/Controllers/PublicBookingController.cs:276-286,339-349`
- Modify: `BarberBookSaaS.WebApi/AppointmentReminderHostedService.cs:68-74`

Este task es un refactor puro de firmas (sin nuevo comportamiento) — la verificación es que la suite completa siga pasando antes y después.

- [ ] **Step 1: Ejecutar la suite completa como línea base**

```bash
dotnet test
```

Expected: PASS (26/26).

- [ ] **Step 2: Actualizar `IWhatsAppService`**

`BarberBookSaaS.Application/Common/IWhatsAppService.cs`:

```csharp
namespace BarberBookSaaS.Application.Common;

public interface IWhatsAppService
{
    Task SendReminderAsync(Guid appointmentId, string toPhone, string customerName, string tenantName, DateTime appointmentDate, string barberName, string? metaPhoneNumberId);

    Task SendConfirmationAsync(Guid appointmentId, string toPhone, string customerName, string tenantName, DateTime appointmentDate, string barberName, string? metaPhoneNumberId);

    Task SendRescheduleAsync(Guid appointmentId, string toPhone, string customerName, string tenantName, DateTime newAppointmentDate, string barberName, string? metaPhoneNumberId);

    Task SendCancellationAsync(Guid appointmentId, string toPhone, string customerName, string tenantName, DateTime appointmentDate, string barberName, string? metaPhoneNumberId);
}
```

- [ ] **Step 3: Actualizar `ConsoleWhatsAppService`**

`BarberBookSaaS.Infrastructure/Services/ConsoleWhatsAppService.cs` — reemplazar el contenido completo:

```csharp
using BarberBookSaaS.Application.Common;
using Microsoft.Extensions.Logging;

namespace BarberBookSaaS.Infrastructure.Services;

public class ConsoleWhatsAppService : IWhatsAppService
{
    private readonly ILogger<ConsoleWhatsAppService> _logger;

    public ConsoleWhatsAppService(ILogger<ConsoleWhatsAppService> logger)
    {
        _logger = logger;
    }

    public Task SendReminderAsync(Guid appointmentId, string toPhone, string customerName, string tenantName, DateTime appointmentDate, string barberName, string? metaPhoneNumberId)
    {
        var message = $"Hola {customerName}, te recordamos tu cita en {tenantName} hoy a las {appointmentDate:HH:mm} con {barberName}. ¿Confirmas tu asistencia?";
        _logger.LogInformation("[WhatsApp SIMULADO] (cita {AppointmentId}) → {Phone}: {Message}", appointmentId, toPhone, message);
        return Task.CompletedTask;
    }

    public Task SendConfirmationAsync(Guid appointmentId, string toPhone, string customerName, string tenantName, DateTime appointmentDate, string barberName, string? metaPhoneNumberId)
    {
        var message = $"Hola {customerName}, tu cita en {tenantName} quedó confirmada para el {appointmentDate:dd/MM} a las {appointmentDate:HH:mm} con {barberName}. Puedes cancelarla o reprogramarla hasta 1 hora antes. ¡Te esperamos!";
        _logger.LogInformation("[WhatsApp SIMULADO] (cita {AppointmentId}) → {Phone}: {Message}", appointmentId, toPhone, message);
        return Task.CompletedTask;
    }

    public Task SendRescheduleAsync(Guid appointmentId, string toPhone, string customerName, string tenantName, DateTime newAppointmentDate, string barberName, string? metaPhoneNumberId)
    {
        var message = $"Hola {customerName}, tu cita en {tenantName} fue reprogramada para el {newAppointmentDate:dd/MM} a las {newAppointmentDate:HH:mm} con {barberName}. ¡Te esperamos!";
        _logger.LogInformation("[WhatsApp SIMULADO] (cita {AppointmentId}) → {Phone}: {Message}", appointmentId, toPhone, message);
        return Task.CompletedTask;
    }

    public Task SendCancellationAsync(Guid appointmentId, string toPhone, string customerName, string tenantName, DateTime appointmentDate, string barberName, string? metaPhoneNumberId)
    {
        var message = $"Hola {customerName}, tu cita en {tenantName} para el {appointmentDate:dd/MM} a las {appointmentDate:HH:mm} con {barberName} fue cancelada. Si fue un error, puedes agendar de nuevo cuando quieras.";
        _logger.LogInformation("[WhatsApp SIMULADO] (cita {AppointmentId}) → {Phone}: {Message}", appointmentId, toPhone, message);
        return Task.CompletedTask;
    }
}
```

- [ ] **Step 4: Actualizar `TwilioWhatsAppService`**

`BarberBookSaaS.Infrastructure/Services/TwilioWhatsAppService.cs` — reemplazar el contenido completo:

```csharp
using System.Net.Http.Headers;
using System.Text;
using BarberBookSaaS.Application.Common;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BarberBookSaaS.Infrastructure.Services;

public class TwilioWhatsAppService : IWhatsAppService
{
    private readonly HttpClient _httpClient;
    private readonly string _accountSid;
    private readonly string _fromNumber;
    private readonly ILogger<TwilioWhatsAppService> _logger;

    public TwilioWhatsAppService(HttpClient httpClient, IConfiguration config, ILogger<TwilioWhatsAppService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;

        _accountSid = config["Twilio:AccountSid"]!;
        var authToken = config["Twilio:AuthToken"]!;
        _fromNumber = config["Twilio:WhatsAppFrom"]!;

        var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_accountSid}:{authToken}"));
        _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);
    }

    public Task SendReminderAsync(Guid appointmentId, string toPhone, string customerName, string tenantName, DateTime appointmentDate, string barberName, string? metaPhoneNumberId)
    {
        var body = $"Hola {customerName}, te recordamos tu cita en {tenantName} hoy a las {appointmentDate:HH:mm} con {barberName}. ¿Confirmas tu asistencia?";
        return SendMessageAsync(toPhone, body);
    }

    public Task SendConfirmationAsync(Guid appointmentId, string toPhone, string customerName, string tenantName, DateTime appointmentDate, string barberName, string? metaPhoneNumberId)
    {
        var body = $"Hola {customerName}, tu cita en {tenantName} quedó confirmada para el {appointmentDate:dd/MM} a las {appointmentDate:HH:mm} con {barberName}. Puedes cancelarla o reprogramarla hasta 1 hora antes. ¡Te esperamos!";
        return SendMessageAsync(toPhone, body);
    }

    public Task SendRescheduleAsync(Guid appointmentId, string toPhone, string customerName, string tenantName, DateTime newAppointmentDate, string barberName, string? metaPhoneNumberId)
    {
        var body = $"Hola {customerName}, tu cita en {tenantName} fue reprogramada para el {newAppointmentDate:dd/MM} a las {newAppointmentDate:HH:mm} con {barberName}. ¡Te esperamos!";
        return SendMessageAsync(toPhone, body);
    }

    public Task SendCancellationAsync(Guid appointmentId, string toPhone, string customerName, string tenantName, DateTime appointmentDate, string barberName, string? metaPhoneNumberId)
    {
        var body = $"Hola {customerName}, tu cita en {tenantName} para el {appointmentDate:dd/MM} a las {appointmentDate:HH:mm} con {barberName} fue cancelada. Si fue un error, puedes agendar de nuevo cuando quieras.";
        return SendMessageAsync(toPhone, body);
    }

    private async Task SendMessageAsync(string toPhone, string body)
    {
        var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["From"] = $"whatsapp:{_fromNumber}",
            ["To"]   = $"whatsapp:{toPhone}",
            ["Body"] = body
        });

        var url = $"https://api.twilio.com/2010-04-01/Accounts/{_accountSid}/Messages.json";
        var response = await _httpClient.PostAsync(url, content);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            _logger.LogError("Twilio error {Status} al enviar a {Phone}: {Error}", response.StatusCode, toPhone, error);
        }
        else
        {
            _logger.LogInformation("[WhatsApp] Mensaje enviado a {Phone}", toPhone);
        }
    }
}
```

- [ ] **Step 5: Actualizar `AppointmentService.CreateAppointmentAsync`**

En `BarberBookSaaS.Infrastructure/Services/AppointmentService.cs:71-82`, reemplazar:

```csharp
        var tenant = await _context.Tenants.FindAsync(newAppointment.TenantId);
        if (tenant is { WhatsAppEnabled: true } && !string.IsNullOrWhiteSpace(newAppointment.CustomerPhone))
        {
            var barber = await _context.Barbers.FirstOrDefaultAsync(b => b.Id == newAppointment.BarberId);
            await _whatsAppService.SendConfirmationAsync(
                appointmentId: newAppointment.Id,
                toPhone: newAppointment.CustomerPhone!,
                customerName: newAppointment.CustomerName,
                tenantName: tenant.Name,
                appointmentDate: newAppointment.AppointmentDate,
                barberName: barber?.Name ?? "tu barbero",
                metaPhoneNumberId: tenant.MetaPhoneNumberId
            );
        }
```

- [ ] **Step 6: Actualizar `AppointmentService.UpdateStatusAsync`**

En `BarberBookSaaS.Infrastructure/Services/AppointmentService.cs:162-175`, reemplazar:

```csharp
        if (status == AppointmentStatus.Cancelled && !string.IsNullOrWhiteSpace(appointment.CustomerPhone))
        {
            var tenant = await _context.Tenants.FindAsync(appointment.TenantId);
            if (tenant is { WhatsAppEnabled: true })
            {
                await _whatsAppService.SendCancellationAsync(
                    appointmentId: appointment.Id,
                    toPhone: appointment.CustomerPhone!,
                    customerName: appointment.CustomerName,
                    tenantName: tenant.Name,
                    appointmentDate: appointment.AppointmentDate,
                    barberName: appointment.Barber?.Name ?? "tu barbero",
                    metaPhoneNumberId: tenant.MetaPhoneNumberId
                );
            }
        }
```

- [ ] **Step 7: Actualizar `PublicBookingController.CancelAppointment`**

En `BarberBookSaaS.WebApi/Controllers/PublicBookingController.cs:276-286`, reemplazar:

```csharp
        var tenant = await _context.Tenants.FindAsync(subdomain);
        if (tenant is { WhatsAppEnabled: true } && !string.IsNullOrWhiteSpace(appointment.CustomerPhone))
        {
            await _whatsAppService.SendCancellationAsync(
                appointmentId: appointment.Id,
                toPhone: appointment.CustomerPhone!,
                customerName: appointment.CustomerName,
                tenantName: tenant.Name,
                appointmentDate: appointment.AppointmentDate,
                barberName: appointment.Barber?.Name ?? "tu barbero",
                metaPhoneNumberId: tenant.MetaPhoneNumberId
            );
        }
```

- [ ] **Step 8: Actualizar `PublicBookingController.RescheduleAppointment`**

En `BarberBookSaaS.WebApi/Controllers/PublicBookingController.cs:339-349`, reemplazar:

```csharp
        var tenant = await _context.Tenants.FindAsync(subdomain);
        if (tenant is { WhatsAppEnabled: true } && !string.IsNullOrWhiteSpace(appointment.CustomerPhone))
        {
            await _whatsAppService.SendRescheduleAsync(
                appointmentId: appointment.Id,
                toPhone: appointment.CustomerPhone!,
                customerName: appointment.CustomerName,
                tenantName: tenant.Name,
                newAppointmentDate: appointment.AppointmentDate,
                barberName: appointment.Barber?.Name ?? "tu barbero",
                metaPhoneNumberId: tenant.MetaPhoneNumberId
            );
        }
```

- [ ] **Step 9: Actualizar `AppointmentReminderHostedService`**

En `BarberBookSaaS.WebApi/AppointmentReminderHostedService.cs:68-74`, reemplazar:

```csharp
            await whatsApp.SendReminderAsync(
                appointmentId: appt.Id,
                toPhone: appt.CustomerPhone!,
                customerName: appt.CustomerName,
                tenantName: tenant.Name,
                appointmentDate: appt.AppointmentDate,
                barberName: appt.Barber?.Name ?? "tu barbero",
                metaPhoneNumberId: tenant.MetaPhoneNumberId
            );
```

- [ ] **Step 10: Ejecutar la suite completa y verificar que sigue pasando**

```bash
dotnet test
```

Expected: PASS (26/26).

- [ ] **Step 11: Commit**

```bash
git add BarberBookSaaS.Application/Common/IWhatsAppService.cs BarberBookSaaS.Infrastructure/Services/ConsoleWhatsAppService.cs BarberBookSaaS.Infrastructure/Services/TwilioWhatsAppService.cs BarberBookSaaS.Infrastructure/Services/AppointmentService.cs BarberBookSaaS.WebApi/Controllers/PublicBookingController.cs BarberBookSaaS.WebApi/AppointmentReminderHostedService.cs
git commit -m "refactor: IWhatsAppService incluye appointmentId y metaPhoneNumberId"
```

---

### Task 7: `MetaWhatsAppService` — envío de plantillas

**Files:**
- Create: `BarberBookSaaS.Infrastructure/Services/MetaWhatsAppService.cs`
- Create: `BarberBookSaaS.Tests/Helpers/CapturingHttpMessageHandler.cs`
- Test: `BarberBookSaaS.Tests/MetaWhatsAppServiceTests.cs`

- [ ] **Step 1: Crear el helper de testing `CapturingHttpMessageHandler`**

`BarberBookSaaS.Tests/Helpers/CapturingHttpMessageHandler.cs`:

```csharp
using System.Net;

namespace BarberBookSaaS.Tests.Helpers;

public class CapturingHttpMessageHandler : DelegatingHandler
{
    public HttpRequestMessage? LastRequest { get; private set; }
    public string? LastRequestBody { get; private set; }
    public HttpStatusCode ResponseStatusCode { get; set; } = HttpStatusCode.OK;
    public string ResponseBody { get; set; } = "{}";

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        LastRequest = request;
        LastRequestBody = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);

        return new HttpResponseMessage(ResponseStatusCode)
        {
            Content = new StringContent(ResponseBody, System.Text.Encoding.UTF8, "application/json")
        };
    }
}
```

- [ ] **Step 2: Escribir los tests (fallarán — `MetaWhatsAppService` no existe)**

`BarberBookSaaS.Tests/MetaWhatsAppServiceTests.cs`:

```csharp
using System.Net;
using System.Text.Json;
using BarberBookSaaS.Infrastructure.Services;
using BarberBookSaaS.Tests.Helpers;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace BarberBookSaaS.Tests;

public class MetaWhatsAppServiceTests
{
    private static (MetaWhatsAppService Service, CapturingHttpMessageHandler Handler) CreateService()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "YOUR_JWT_KEY_HERE",
                ["Meta:AccessToken"] = "test-access-token",
                ["Meta:ApiVersion"] = "v21.0",
                ["Meta:TemplateLanguage"] = "es_MX"
            })
            .Build();

        var handler = new CapturingHttpMessageHandler();
        var httpClient = new HttpClient(handler);
        var tokenService = new AppointmentTokenService(config);

        var service = new MetaWhatsAppService(config, httpClient, tokenService, NullLogger<MetaWhatsAppService>.Instance);
        return (service, handler);
    }

    [Fact]
    public async Task SendConfirmationAsync_SendsTemplateWithBodyVarsAndButtons()
    {
        var (service, handler) = CreateService();
        var appointmentId = Guid.NewGuid();
        var appointmentDate = new DateTime(2026, 6, 15, 14, 30, 0);

        await service.SendConfirmationAsync(
            appointmentId, "+573001234567", "Juan Pérez", "Barbería Test",
            appointmentDate, "Carlos", "1234567890");

        Assert.NotNull(handler.LastRequest);
        Assert.Equal("https://graph.facebook.com/v21.0/1234567890/messages", handler.LastRequest!.RequestUri!.ToString());

        var body = JsonDocument.Parse(handler.LastRequestBody!).RootElement;
        Assert.Equal("cita_confirmada", body.GetProperty("template").GetProperty("name").GetString());
        Assert.Equal("es_MX", body.GetProperty("template").GetProperty("language").GetProperty("code").GetString());

        var components = body.GetProperty("template").GetProperty("components");
        Assert.Equal(3, components.GetArrayLength());

        var bodyParams = components[0].GetProperty("parameters");
        Assert.Equal("Juan Pérez", bodyParams[0].GetProperty("text").GetString());
        Assert.Equal("15/06/2026 a las 14:30", bodyParams[1].GetProperty("text").GetString());
        Assert.Equal("Carlos", bodyParams[2].GetProperty("text").GetString());

        Assert.Equal("url", components[1].GetProperty("sub_type").GetString());
        Assert.Equal("quick_reply", components[2].GetProperty("sub_type").GetString());
        Assert.Equal("CANCELAR_CITA", components[2].GetProperty("parameters")[0].GetProperty("payload").GetString());
    }

    [Fact]
    public async Task SendCancellationAsync_SendsTemplateWithoutButtons()
    {
        var (service, handler) = CreateService();

        await service.SendCancellationAsync(
            Guid.NewGuid(), "+573001234567", "Juan Pérez", "Barbería Test",
            new DateTime(2026, 6, 15, 14, 30, 0), "Carlos", "1234567890");

        Assert.NotNull(handler.LastRequest);

        var body = JsonDocument.Parse(handler.LastRequestBody!).RootElement;
        Assert.Equal("cita_cancelada", body.GetProperty("template").GetProperty("name").GetString());

        var components = body.GetProperty("template").GetProperty("components");
        Assert.Equal(1, components.GetArrayLength());
    }

    [Fact]
    public async Task SendConfirmationAsync_WithoutMetaPhoneNumberId_SkipsSend()
    {
        var (service, handler) = CreateService();

        await service.SendConfirmationAsync(
            Guid.NewGuid(), "+573001234567", "Juan Pérez", "Barbería Test",
            new DateTime(2026, 6, 15, 14, 30, 0), "Carlos", metaPhoneNumberId: null);

        Assert.Null(handler.LastRequest);
    }

    [Fact]
    public async Task SendConfirmationAsync_WhenMetaReturnsError_DoesNotThrow()
    {
        var (service, handler) = CreateService();
        handler.ResponseStatusCode = HttpStatusCode.BadRequest;
        handler.ResponseBody = "{\"error\":{\"message\":\"Invalid template\"}}";

        await service.SendConfirmationAsync(
            Guid.NewGuid(), "+573001234567", "Juan Pérez", "Barbería Test",
            new DateTime(2026, 6, 15, 14, 30, 0), "Carlos", "1234567890");

        Assert.NotNull(handler.LastRequest);
    }
}
```

- [ ] **Step 3: Ejecutar y verificar que falla**

```bash
dotnet test --filter MetaWhatsAppServiceTests
```

Expected: FAIL — `MetaWhatsAppService` no existe (error de compilación).

- [ ] **Step 4: Crear `MetaWhatsAppService`**

`BarberBookSaaS.Infrastructure/Services/MetaWhatsAppService.cs`:

```csharp
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using BarberBookSaaS.Application.Common;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BarberBookSaaS.Infrastructure.Services;

public class MetaWhatsAppService : IWhatsAppService
{
    private readonly HttpClient _http;
    private readonly IAppointmentTokenService _tokenService;
    private readonly ILogger<MetaWhatsAppService> _logger;
    private readonly string _apiVersion;
    private readonly string _templateLanguage;

    public MetaWhatsAppService(IConfiguration config, HttpClient http, IAppointmentTokenService tokenService, ILogger<MetaWhatsAppService> logger)
    {
        _http = http;
        _tokenService = tokenService;
        _logger = logger;
        _apiVersion = config["Meta:ApiVersion"] ?? "v21.0";
        _templateLanguage = config["Meta:TemplateLanguage"] ?? "es_MX";
        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", config["Meta:AccessToken"] ?? string.Empty);
    }

    public Task SendReminderAsync(Guid appointmentId, string toPhone, string customerName, string tenantName, DateTime appointmentDate, string barberName, string? metaPhoneNumberId) =>
        SendTemplateAsync("cita_recordatorio", includeButtons: true, appointmentId, toPhone, customerName, appointmentDate, barberName, metaPhoneNumberId);

    public Task SendConfirmationAsync(Guid appointmentId, string toPhone, string customerName, string tenantName, DateTime appointmentDate, string barberName, string? metaPhoneNumberId) =>
        SendTemplateAsync("cita_confirmada", includeButtons: true, appointmentId, toPhone, customerName, appointmentDate, barberName, metaPhoneNumberId);

    public Task SendRescheduleAsync(Guid appointmentId, string toPhone, string customerName, string tenantName, DateTime newAppointmentDate, string barberName, string? metaPhoneNumberId) =>
        SendTemplateAsync("cita_reprogramada", includeButtons: true, appointmentId, toPhone, customerName, newAppointmentDate, barberName, metaPhoneNumberId);

    public Task SendCancellationAsync(Guid appointmentId, string toPhone, string customerName, string tenantName, DateTime appointmentDate, string barberName, string? metaPhoneNumberId) =>
        SendTemplateAsync("cita_cancelada", includeButtons: false, appointmentId, toPhone, customerName, appointmentDate, barberName, metaPhoneNumberId);

    private async Task SendTemplateAsync(string templateName, bool includeButtons, Guid appointmentId, string toPhone, string customerName, DateTime appointmentDate, string barberName, string? metaPhoneNumberId)
    {
        if (string.IsNullOrWhiteSpace(metaPhoneNumberId))
        {
            _logger.LogWarning("[Meta WhatsApp] Tenant sin MetaPhoneNumberId configurado — no se envía la plantilla {Template} para la cita {AppointmentId}.", templateName, appointmentId);
            return;
        }

        var payload = BuildPayload(templateName, toPhone, customerName, appointmentDate, barberName, appointmentId, includeButtons);
        var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        var url = $"https://graph.facebook.com/{_apiVersion}/{metaPhoneNumberId}/messages";
        var response = await _http.PostAsync(url, content);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            _logger.LogError("[Meta WhatsApp] Error {Status} al enviar plantilla {Template} para la cita {AppointmentId}: {Error}", response.StatusCode, templateName, appointmentId, error);
        }
        else
        {
            _logger.LogInformation("[Meta WhatsApp] Plantilla {Template} enviada para la cita {AppointmentId}", templateName, appointmentId);
        }
    }

    private object BuildPayload(string templateName, string toPhone, string customerName, DateTime appointmentDate, string barberName, Guid appointmentId, bool includeButtons)
    {
        var components = new List<object>
        {
            new
            {
                type = "body",
                parameters = new object[]
                {
                    new { type = "text", text = customerName },
                    new { type = "text", text = appointmentDate.ToString("dd/MM/yyyy 'a las' HH:mm") },
                    new { type = "text", text = barberName }
                }
            }
        };

        if (includeButtons)
        {
            var token = _tokenService.GenerateToken(appointmentId, appointmentDate);

            components.Add(new
            {
                type = "button",
                sub_type = "url",
                index = "0",
                parameters = new object[] { new { type = "text", text = token } }
            });

            components.Add(new
            {
                type = "button",
                sub_type = "quick_reply",
                index = "1",
                parameters = new object[] { new { type = "payload", payload = "CANCELAR_CITA" } }
            });
        }

        return new
        {
            messaging_product = "whatsapp",
            to = NormalizePhone(toPhone),
            type = "template",
            template = new
            {
                name = templateName,
                language = new { code = _templateLanguage },
                components
            }
        };
    }

    private static string NormalizePhone(string phone) =>
        new string(phone.Where(char.IsDigit).ToArray());
}
```

- [ ] **Step 5: Ejecutar y verificar que pasa**

```bash
dotnet test --filter MetaWhatsAppServiceTests
```

Expected: PASS (4/4). Suite completa: 30/30.

- [ ] **Step 6: Commit**

```bash
git add BarberBookSaaS.Infrastructure/Services/MetaWhatsAppService.cs BarberBookSaaS.Tests/Helpers/CapturingHttpMessageHandler.cs BarberBookSaaS.Tests/MetaWhatsAppServiceTests.cs
git commit -m "feat: agrega MetaWhatsAppService (plantillas WhatsApp Cloud API)"
```

---

### Task 8: `Program.cs` — selección de proveedor WhatsApp (3 vías)

**Files:**
- Modify: `BarberBookSaaS.WebApi/Program.cs:67-71`

- [ ] **Step 1: Reemplazar la selección de proveedor**

En `BarberBookSaaS.WebApi/Program.cs:67-71`, reemplazar:

```csharp
var twilioSid = builder.Configuration["Twilio:AccountSid"];
var metaAccessToken = builder.Configuration["Meta:AccessToken"];
if (!string.IsNullOrEmpty(twilioSid))
    builder.Services.AddHttpClient<IWhatsAppService, TwilioWhatsAppService>();
else if (!string.IsNullOrEmpty(metaAccessToken))
    builder.Services.AddHttpClient<IWhatsAppService, MetaWhatsAppService>();
else
    builder.Services.AddSingleton<IWhatsAppService, ConsoleWhatsAppService>();
```

- [ ] **Step 2: Compilar y ejecutar la suite completa**

```bash
dotnet build
dotnet test
```

Expected: build sin errores, suite PASS (30/30) — en el entorno `Testing`, ni `Twilio:AccountSid` ni `Meta:AccessToken` están configurados, así que `ConsoleWhatsAppService` sigue siendo el proveedor usado por los tests.

- [ ] **Step 3: Commit**

```bash
git add BarberBookSaaS.WebApi/Program.cs
git commit -m "feat: selecciona proveedor WhatsApp (Twilio > Meta > Console)"
```

---

### Task 9: Webhook de WhatsApp — verificación + cancelación

**Files:**
- Create: `BarberBookSaaS.WebApi/Controllers/WhatsAppWebhookController.cs`
- Test: `BarberBookSaaS.Tests/WhatsAppWebhookTests.cs`

- [ ] **Step 1: Escribir los tests (fallarán — el controlador no existe, ruta 404)**

`BarberBookSaaS.Tests/WhatsAppWebhookTests.cs`:

```csharp
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using BarberBookSaaS.Tests.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BarberBookSaaS.Tests;

public class WhatsAppWebhookTests : IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory = new();
    private HttpClient _client = null!;
    private const string TenantId = "webhook-t1";
    private Guid _appointmentId;

    public async Task InitializeAsync()
    {
        await _factory.InitializeDbAsync();
        _client = _factory.CreateClient();
        await SeedAsync();
    }

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private async Task SeedAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        db.Tenants.Add(new Tenant
        {
            Id = TenantId,
            Name = "Webhook Test",
            Subdomain = TenantId,
            WhatsAppEnabled = true,
            MetaPhoneNumberId = "1234567890"
        });

        var barberId = Guid.NewGuid();
        var serviceId = Guid.NewGuid();
        db.Barbers.Add(new Barber { Id = barberId, TenantId = TenantId, Name = "Carlos", IsActive = true });
        db.Services.Add(new Service { Id = serviceId, TenantId = TenantId, Name = "Corte", DurationMinutes = 30, Price = 10, IsActive = true });

        _appointmentId = Guid.NewGuid();
        db.Appointments.Add(new Appointment
        {
            Id = _appointmentId,
            TenantId = TenantId,
            BarberId = barberId,
            ServiceId = serviceId,
            CustomerName = "Cliente Test",
            CustomerPhone = "+573001234567",
            AppointmentDate = DateTime.Now.AddDays(1),
            Status = AppointmentStatus.Pending,
            CreatedAt = DateTime.UtcNow
        });

        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task Verify_WithCorrectToken_ReturnsChallenge()
    {
        var response = await _client.GetAsync("/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=12345");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("12345", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Verify_WithIncorrectToken_ReturnsForbidden()
    {
        var response = await _client.GetAsync("/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=12345");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Receive_WithInvalidSignature_ReturnsUnauthorized()
    {
        var body = "{}";
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/whatsapp/webhook")
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };
        request.Headers.Add("X-Hub-Signature-256", "sha256=invalidsignature");

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Receive_WithCancelButtonPayload_CancelsAppointment()
    {
        var payload = new
        {
            entry = new[]
            {
                new
                {
                    changes = new[]
                    {
                        new
                        {
                            value = new
                            {
                                metadata = new { phone_number_id = "1234567890" },
                                messages = new[]
                                {
                                    new
                                    {
                                        from = "573001234567",
                                        type = "button",
                                        button = new { payload = "CANCELAR_CITA", text = "Cancelar cita" }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };

        var body = JsonSerializer.Serialize(payload);
        var signature = ComputeSignature(body, "test-app-secret");

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/whatsapp/webhook")
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };
        request.Headers.Add("X-Hub-Signature-256", $"sha256={signature}");

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var appointment = await db.Appointments.IgnoreQueryFilters().FirstAsync(a => a.Id == _appointmentId);

        Assert.Equal(AppointmentStatus.Cancelled, appointment.Status);
    }

    private static string ComputeSignature(string body, string secret)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(body));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
```

- [ ] **Step 2: Ejecutar y verificar que falla**

```bash
dotnet test --filter WhatsAppWebhookTests
```

Expected: FAIL — la ruta `/api/whatsapp/webhook` no existe (404 en lugar de 200/403/401).

- [ ] **Step 3: Crear `WhatsAppWebhookController`**

`BarberBookSaaS.WebApi/Controllers/WhatsAppWebhookController.cs`:

```csharp
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace BarberBookSaaS.WebApi.Controllers;

[ApiController]
[Route("api/whatsapp/webhook")]
public class WhatsAppWebhookController : ControllerBase
{
    private const string CancelPayload = "CANCELAR_CITA";

    private readonly ApplicationDbContext _context;
    private readonly ITenantService _tenantService;
    private readonly IAppointmentService _appointmentService;
    private readonly IConfiguration _config;
    private readonly ILogger<WhatsAppWebhookController> _logger;

    public WhatsAppWebhookController(
        ApplicationDbContext context,
        ITenantService tenantService,
        IAppointmentService appointmentService,
        IConfiguration config,
        ILogger<WhatsAppWebhookController> logger)
    {
        _context = context;
        _tenantService = tenantService;
        _appointmentService = appointmentService;
        _config = config;
        _logger = logger;
    }

    [HttpGet]
    [AllowAnonymous]
    public IActionResult Verify(
        [FromQuery(Name = "hub.mode")] string? mode,
        [FromQuery(Name = "hub.verify_token")] string? verifyToken,
        [FromQuery(Name = "hub.challenge")] string? challenge)
    {
        var expectedToken = _config["Meta:VerifyToken"];

        if (mode == "subscribe" && !string.IsNullOrEmpty(expectedToken) && verifyToken == expectedToken)
            return Content(challenge ?? string.Empty, "text/plain");

        return Forbid();
    }

    [HttpPost]
    [AllowAnonymous]
    public async Task<IActionResult> Receive()
    {
        using var reader = new StreamReader(Request.Body, Encoding.UTF8);
        var rawBody = await reader.ReadToEndAsync();

        if (!IsValidSignature(rawBody))
            return Unauthorized();

        using var doc = JsonDocument.Parse(rawBody);
        await ProcessEntriesAsync(doc.RootElement);

        return Ok();
    }

    private bool IsValidSignature(string rawBody)
    {
        var appSecret = _config["Meta:AppSecret"];
        if (string.IsNullOrEmpty(appSecret)) return false;

        var signatureHeader = Request.Headers["X-Hub-Signature-256"].FirstOrDefault();
        if (string.IsNullOrEmpty(signatureHeader) || !signatureHeader.StartsWith("sha256=", StringComparison.OrdinalIgnoreCase))
            return false;

        var providedHex = signatureHeader["sha256=".Length..];

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(appSecret));
        var computedBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(rawBody));
        var computedHex = Convert.ToHexString(computedBytes).ToLowerInvariant();

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(computedHex),
            Encoding.UTF8.GetBytes(providedHex.ToLowerInvariant()));
    }

    private async Task ProcessEntriesAsync(JsonElement root)
    {
        if (!root.TryGetProperty("entry", out var entries)) return;

        foreach (var entry in entries.EnumerateArray())
        {
            if (!entry.TryGetProperty("changes", out var changes)) continue;

            foreach (var change in changes.EnumerateArray())
            {
                if (!change.TryGetProperty("value", out var value)) continue;
                await ProcessChangeValueAsync(value);
            }
        }
    }

    private async Task ProcessChangeValueAsync(JsonElement value)
    {
        if (!value.TryGetProperty("metadata", out var metadata)
            || !metadata.TryGetProperty("phone_number_id", out var phoneNumberIdProp))
            return;

        var phoneNumberId = phoneNumberIdProp.GetString();
        if (string.IsNullOrEmpty(phoneNumberId)) return;

        if (!value.TryGetProperty("messages", out var messages)) return;

        var tenant = await _context.Tenants
            .FirstOrDefaultAsync(t => t.MetaPhoneNumberId == phoneNumberId);

        if (tenant is null)
        {
            _logger.LogWarning("[WhatsApp Webhook] No se encontró tenant con MetaPhoneNumberId {PhoneNumberId}", phoneNumberId);
            return;
        }

        foreach (var message in messages.EnumerateArray())
        {
            await ProcessMessageAsync(tenant.Id, message);
        }
    }

    private async Task ProcessMessageAsync(string tenantId, JsonElement message)
    {
        if (!message.TryGetProperty("type", out var typeProp) || typeProp.GetString() != "button")
            return;

        if (!message.TryGetProperty("button", out var button)
            || !button.TryGetProperty("payload", out var payloadProp)
            || payloadProp.GetString() != CancelPayload)
            return;

        if (!message.TryGetProperty("from", out var fromProp))
            return;

        var fromDigits = NormalizePhone(fromProp.GetString() ?? string.Empty);
        if (fromDigits.Length == 0) return;

        _tenantService.TenantId = tenantId;

        var pendingAppointments = await _context.Appointments
            .Where(a => a.Status == AppointmentStatus.Pending && a.CustomerPhone != null)
            .OrderBy(a => a.AppointmentDate)
            .ToListAsync();

        var match = pendingAppointments.FirstOrDefault(a => NormalizePhone(a.CustomerPhone!) == fromDigits);

        if (match is null)
        {
            _logger.LogWarning("[WhatsApp Webhook] No se encontró cita pendiente para el teléfono {From} en el tenant {TenantId}", fromDigits, tenantId);
            return;
        }

        await _appointmentService.UpdateStatusAsync(match.Id, AppointmentStatus.Cancelled, "whatsapp");
        _logger.LogInformation("[WhatsApp Webhook] Cita {AppointmentId} cancelada vía botón de WhatsApp", match.Id);
    }

    private static string NormalizePhone(string phone) =>
        new string(phone.Where(char.IsDigit).ToArray());
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

```bash
dotnet test --filter WhatsAppWebhookTests
```

Expected: PASS (4/4). Suite completa: 34/34.

- [ ] **Step 5: Commit**

```bash
git add BarberBookSaaS.WebApi/Controllers/WhatsAppWebhookController.cs BarberBookSaaS.Tests/WhatsAppWebhookTests.cs
git commit -m "feat: agrega webhook de WhatsApp (verificacion + cancelacion via boton)"
```

---

### Task 10: Suite completa + actualización de documentación

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/HISTORIAL.md`
- Modify: `docs/API_REFERENCE.md`
- Modify: `docs/BASE_DE_DATOS.md`
- Modify: `docs/DECISIONES_DISENO.md`

- [ ] **Step 1: Ejecutar la suite completa**

```bash
dotnet test
```

Expected: PASS (34/34).

- [ ] **Step 2: Actualizar `CLAUDE.md`**

Reemplazar la línea del grupo de rutas en la sección "API Reference":

```markdown
Grupos de rutas: `/api/auth/*`, `/api/barbers/*`, `/api/services/*`, `/api/appointments/*`, `/api/tenant/branding|loyalty|reviews|whatsapp`, `/api/dashboard/stats`, `/api/customer/*`, `/api/public/{subdomain}/*`, `/api/whatsapp/webhook`, `/api/superadmin/*`.
```

Reemplazar el párrafo de "Estado del Proyecto":

```markdown
28 fases completadas: dominio y persistencia, auth JWT multi-tenant, paneles Admin/Barbero/SuperAdmin, booking público con loyalty, theming/branding, diagnóstico IA (Plan Premium), reseñas por QR, recordatorios WhatsApp, rediseño glassmorphism, fotos + carruseles 3D, landing pública, integración WhatsApp Business Cloud API (Meta) Fase 1 (plantillas con botones interactivos + webhook de cancelación). Historial detallado por fase y fixes aplicados: **`docs/HISTORIAL.md`**.

**Tests:** 34/34 pasan.
```

Bajo "PRIORIDAD MEDIA — Features importantes", agregar un nuevo ítem (antes del carrusel "Spotlight"):

```markdown
- [ ] **WhatsApp Meta Fase 2 — consumo del botón "Reprogramar"** — implementar la ruta pública `/r/:token` (frontend) que reciba el token generado por `IAppointmentTokenService.GenerateToken`, lo valide con `ValidateToken`, y abra el flujo de reprogramación (`RescheduleModal`) para la cita correspondiente. El token ya se genera y se envía como sufijo del botón "Reprogramar" desde Fase 1.
```

- [ ] **Step 3: Actualizar `docs/API_REFERENCE.md`**

Agregar una nueva sección con los endpoints del webhook:

```markdown
### WhatsApp Webhook (Meta Cloud API)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/whatsapp/webhook` | Anónimo | Verificación del webhook (Meta). Query params: `hub.mode`, `hub.verify_token`, `hub.challenge`. Devuelve `hub.challenge` como texto plano si `hub.verify_token` coincide con `Meta:VerifyToken`; si no, `403 Forbidden`. |
| POST | `/api/whatsapp/webhook` | Anónimo (firma `X-Hub-Signature-256`) | Recibe eventos `messages` de Meta. Valida la firma HMAC-SHA256 del cuerpo con `Meta:AppSecret`; `401 Unauthorized` si no coincide. Si el mensaje es un botón con payload `CANCELAR_CITA`, resuelve el tenant por `Tenant.MetaPhoneNumberId` y cancela la cita `Pending` cuyo `CustomerPhone` coincide con el remitente. Siempre responde `200 OK` (incluso si no encuentra coincidencia, para que Meta no reintente). |
```

Actualizar el body del endpoint `PUT /api/tenant/whatsapp` (sección de branding) para incluir el nuevo campo:

```json
{
  "enabled": true,
  "phone": "+573001234567",
  "metaPhoneNumberId": "123456789012345"
}
```

- [ ] **Step 4: Actualizar `docs/BASE_DE_DATOS.md`**

Agregar una fila a la tabla de historial de migraciones:

```markdown
| 14 | `AgregarMetaPhoneNumberId` | Agrega `Tenant.MetaPhoneNumberId` (ID del número de WhatsApp Business en Meta Cloud API, por tenant) |
```

- [ ] **Step 5: Actualizar `docs/DECISIONES_DISENO.md`**

Agregar las siguientes filas a la tabla de decisiones de diseño:

```markdown
| `IWhatsAppService` recibe `appointmentId` (1er parámetro) y `metaPhoneNumberId` (último parámetro) en sus 4 métodos | Permite que cualquier proveedor (Console/Twilio/Meta) tenga el contexto completo de la cita y del tenant sin depender de estado ambiental — `MetaWhatsAppService` los necesita para el endpoint por-tenant y el token del botón "Reprogramar" |
| `IAppointmentTokenService` firma tokens HMAC-SHA256 reutilizando `Jwt:Key`, formato `{base64url(payload)}.{base64url(firma)}` con `payload = "{appointmentId:N}|{expiresAtUtc.Ticks}"` | Evita introducir una segunda clave secreta solo para esto; el formato es compacto y apto para ir como sufijo de URL en el botón "Reprogramar" de WhatsApp |
| Las plantillas de WhatsApp (`cita_confirmada`, `cita_reprogramada`, `cita_recordatorio`) comparten 3 variables de cuerpo (`{{1}}` nombre, `{{2}}` fecha/hora `dd/MM/yyyy 'a las' HH:mm`, `{{3}}` barbero) y 2 botones (índice 0 "Reprogramar" CTA-URL, índice 1 "Cancelar cita" Quick Reply payload `CANCELAR_CITA`); `cita_cancelada` no tiene botones | Estandariza el contrato entre el backend y las plantillas configuradas en Meta Business Manager; cancelar una cita ya cancelada no tiene sentido |
| `Meta:PhoneNumberId` NO existe como config global — `phone_number_id` es siempre `Tenant.MetaPhoneNumberId` | Cada tenant tiene su propio número de WhatsApp Business; sin valor configurado, `MetaWhatsAppService` registra un warning y no envía, sin fallback |
| `Meta:TemplateLanguage` (default `es_MX`) es configurable | Evita hardcodear el código de idioma de las plantillas, que debe coincidir exactamente con el configurado en Meta Business Manager |
| El webhook resuelve el tenant por `Tenant.MetaPhoneNumberId == metadata.phone_number_id` y fija `_tenantService.TenantId` manualmente antes de consultar `_context.Appointments` | El webhook es anónimo (sin JWT ni `X-Tenant-Id`); es la única forma de aplicar el QueryFilter multi-tenant correctamente |
| El emparejamiento de teléfono en el webhook es igualdad exacta de dígitos (`CustomerPhone` normalizado == `from` normalizado) | Simplicidad para Fase 1; requiere que `CustomerPhone` incluya código de país (ya es el caso). Limitación conocida para Fase 2 si se requiere mayor tolerancia |
```

- [ ] **Step 6: Actualizar `docs/HISTORIAL.md`**

Agregar al final del archivo:

```markdown
## Fase 28 — Integración WhatsApp Business Cloud API (Meta) — Fase 1

**Objetivo:** reemplazar/complementar Twilio con la API oficial de Meta para WhatsApp, usando plantillas con botones interactivos ("Reprogramar" / "Cancelar cita") y un webhook que procese la respuesta del cliente.

**Cambios principales:**
- `Tenant.MetaPhoneNumberId` (migración 14) — cada tenant configura su propio `phone_number_id` desde `/branding`.
- `IWhatsAppService`: las 4 firmas ahora incluyen `Guid appointmentId` (1er parámetro) y `string? metaPhoneNumberId` (último parámetro). Implementado en `ConsoleWhatsAppService`, `TwilioWhatsAppService` y el nuevo `MetaWhatsAppService`.
- `IAppointmentTokenService` / `AppointmentTokenService`: tokens HMAC-SHA256 firmados por cita (`GenerateToken`/`ValidateToken`), reutilizando `Jwt:Key`. Usado como sufijo dinámico del botón "Reprogramar" — el consumo de ese token (`/r/:token`) queda para Fase 2.
- `MetaWhatsAppService`: envía plantillas (`cita_confirmada`, `cita_reprogramada`, `cita_recordatorio`, `cita_cancelada`) vía `POST https://graph.facebook.com/{ApiVersion}/{MetaPhoneNumberId}/messages`. Las 3 primeras incluyen botones "Reprogramar" (CTA-URL) y "Cancelar cita" (Quick Reply, payload `CANCELAR_CITA`); `cita_cancelada` no tiene botones.
- `Program.cs`: selección de proveedor en 3 vías — `Twilio:AccountSid` > `Meta:AccessToken` > `ConsoleWhatsAppService`.
- `WhatsAppWebhookController` (`/api/whatsapp/webhook`): GET para verificación (challenge), POST valida firma `X-Hub-Signature-256` (HMAC-SHA256 con `Meta:AppSecret`) y procesa el payload `CANCELAR_CITA` — resuelve el tenant por `MetaPhoneNumberId`, busca la cita `Pending` cuyo teléfono coincide y la cancela vía `IAppointmentService.UpdateStatusAsync`.
- Nueva configuración `Meta` en `appsettings.json`: `AccessToken`, `AppSecret`, `VerifyToken`, `ApiVersion` (`v21.0`), `TemplateLanguage` (`es_MX`).

**Tests:** +8 (BrandingMetaPhoneNumberTests: 2, AppointmentTokenServiceTests: 4, MetaWhatsAppServiceTests: 4, WhatsAppWebhookTests: 4 — total bruto +14, neto +8 tras contar los 2 de branding y reutilizar baseline). Total: 34/34.
```

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md docs/HISTORIAL.md docs/API_REFERENCE.md docs/BASE_DE_DATOS.md docs/DECISIONES_DISENO.md
git commit -m "docs: documenta integracion WhatsApp Meta Cloud API Fase 1"
```

---

## Self-Review

**1. Cobertura de la spec:**
- Migración + `Tenant.MetaPhoneNumberId` → Task 1.
- Branding (backend + frontend) → Tasks 2-3.
- Configuración `Meta` (`AccessToken`, `AppSecret`, `VerifyToken`, `ApiVersion`, `TemplateLanguage`) + test factory → Task 4.
- `IAppointmentTokenService` (Decisión C) → Task 5.
- Nuevas firmas `IWhatsAppService` (Decisión B) en los 3 proveedores + 5 call sites → Task 6.
- `MetaWhatsAppService` con plantillas, variables (Decisión D), idioma configurable (Decisión J), sin fallback de `phone_number_id` (Decisión G) → Task 7.
- Selección de proveedor 3 vías → Task 8.
- Webhook: verificación + firma + cancelación vía `CANCELAR_CITA` (Decisiones I, K) → Task 9.
- Documentación (`CLAUDE.md`, `docs/*`) + roadmap Fase 2 (Decisión H) → Task 10.
- Prerrequisitos de Meta Business Manager → sección dedicada antes de los tasks.

**2. Escaneo de placeholders:** sin "TBD"/"TODO"/"implementar después". Todos los bloques de código están completos y compilables con los tipos definidos en tasks anteriores.

**3. Consistencia de tipos:** `IWhatsAppService` (Task 6) se usa con la misma firma de 7 parámetros en `ConsoleWhatsAppService`, `TwilioWhatsAppService` (Task 6), `MetaWhatsAppService` (Task 7) y los 5 call sites (Task 6). `IAppointmentTokenService.GenerateToken`/`ValidateToken` (Task 5) coinciden entre `AppointmentTokenService`, `MetaWhatsAppService` (Task 7) y `AppointmentTokenServiceTests`. `Tenant.MetaPhoneNumberId` (Task 1) se usa consistentemente en `TenantBrandingDto`, `UpdateWhatsAppDto`, `BrandingService`, `BrandingController`, los call sites de Task 6, `MetaWhatsAppService` y `WhatsAppWebhookController`.

---

**Plan completo y guardado en `docs/superpowers/plans/2026-06-11-whatsapp-meta-fase1.md`. Dos opciones de ejecución:**

**1. Subagent-Driven (recomendado)** — despacho un subagente nuevo por task, con revisión entre tasks e iteración rápida.

**2. Inline Execution** — ejecuto los tasks en esta sesión usando executing-plans, con checkpoints por lote.

**¿Cuál prefieres?**
