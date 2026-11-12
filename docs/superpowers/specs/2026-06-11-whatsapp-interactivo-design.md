# BarberBook SaaS — Mensajes interactivos de WhatsApp (Meta Cloud API)

**Fecha:** 2026-06-11
**Estado:** Aprobado
**Alcance:** `IWhatsAppService` (nueva implementación Meta), webhook de Meta, magic-link de reprogramación, página pública de reprogramación sin login.

---

## Resumen

Hoy el cliente recibe 4 tipos de mensaje de WhatsApp (confirmación, recordatorio, reprogramación, cancelación) como texto libre vía `TwilioWhatsAppService`/`ConsoleWhatsAppService`. Se migra a **Meta WhatsApp Business Platform (Cloud API)** usando **plantillas**, y se agregan **botones interactivos** a los mensajes de **Confirmación** y **Reprogramación exitosa**:

- **"Reprogramar"** (CTA-URL): abre una página pública dedicada con un enlace mágico que permite reprogramar esa cita específica sin login.
- **"Cancelar cita"** (Quick Reply): cancela automáticamente, vía webhook, la cita `Pendiente` más próxima del cliente que cumpla la regla de >60min de antelación.

Se implementa en **2 fases**: Fase 1 = fundación Meta Cloud API (servicio, plantillas, webhook esqueleto con validación de firma). Fase 2 = magic-link + página de reprogramación + lógica de negocio del webhook (cancelación).

---

## Decisiones confirmadas

| Decisión | Elección |
|----------|----------|
| Reprogramar vía WhatsApp | Enlace directo (CTA-URL) + magic link de un solo uso por cita |
| Alcance de botones | Solo en mensajes de **Confirmación** y **Reprogramación exitosa** — Recordatorio y Cancelación quedan sin botones |
| Resolución de "Cancelar cita" | Cancela la cita `Pendiente` más próxima (>60min) asociada al teléfono que escribe |
| Alcance del magic link | Página pública dedicada, token ligado a **una sola cita** (no acceso a cuenta completa) |
| Normalización de teléfono (`wa_id` vs `CustomerPhone`) | Comparar por los **últimos 10 dígitos** del número (cubre diferencias de `+`, código de país, ceros iniciales) |
| Plataforma | Meta WhatsApp Cloud API (app "AgendaBarber"), reemplaza el envío vía Twilio |

---

## Fase 1 — Fundación Meta Cloud API

### 1. Configuración

`appsettings.json` (y `Jwt__Key`-style env vars en producción):

```json
"Meta": {
  "AccessToken": "",
  "AppSecret": "",
  "VerifyToken": "",
  "ApiVersion": "v21.0",
  "Templates": {
    "Confirmation": "cita_confirmada",
    "Reschedule": "cita_reprogramada",
    "Reminder": "cita_recordatorio",
    "Cancellation": "cita_cancelada"
  }
}
```

**Migración 14 — `AgregarMetaPhoneNumberIdTenant`**: agrega `Tenant.MetaPhoneNumberId` (string?, nullable). Usado por el webhook (Fase 2) para resolver qué tenant recibió el mensaje, vía `metadata.phone_number_id` del payload de Meta. Se gestiona desde `BrandingPage` igual que `WhatsAppPhone`.

### 2. `IAppointmentTokenService` (generación)

Nueva interfaz en `Application/Common/`, implementación `AppointmentTokenService` en `Infrastructure/Services/`:

```csharp
public interface IAppointmentTokenService
{
    string GenerateToken(Guid appointmentId);
    Guid? ValidateToken(string token); // null si inválido, manipulado o expirado
}
```

- Formato: `base64url(appointmentId).base64url(exp).base64url(HMACSHA256(appointmentId|exp, secret))`.
- Secreto: reutiliza `Jwt:Key` existente (sin nuevo secreto en config).
- Expiración: `exp` = fecha de la cita + 24h.
- Se implementa completa en Fase 1 (la usa `MetaWhatsAppService` para generar el token del botón). `ValidateToken` queda sin consumidores hasta Fase 2, donde se usa en los endpoints `by-token`.

### 3. `IWhatsAppService` — nuevo método `SendTextAsync`

Se agrega un 5º método a la interfaz existente:

```csharp
Task SendTextAsync(string toPhone, string text);
```

- `ConsoleWhatsAppService`: loguea el texto igual que los otros métodos.
- `TwilioWhatsAppService`: reutiliza el `SendMessageAsync` privado existente.
- `MetaWhatsAppService`: envía `type: "text"` (mensaje libre, sin plantilla — válido dentro de la ventana de 24h de una conversación iniciada por el cliente). Usado por el webhook en Fase 2 para responder al "Cancelar cita".

### 4. `MetaWhatsAppService : IWhatsAppService`

Nueva clase en `Infrastructure/Services/`, registrada vía `AddHttpClient<IWhatsAppService, MetaWhatsAppService>()`. Llama a `POST https://graph.facebook.com/{ApiVersion}/{phone_number_id}/messages` con `Authorization: Bearer {AccessToken}`.

- `phone_number_id` por tenant: viene de `Tenant.MetaPhoneNumberId` (si es null, se usa un ID global de fallback en config — útil en desarrollo con el número de prueba único).
- **`SendConfirmationAsync` / `SendRescheduleAsync`**: construyen el payload de plantilla (`cita_confirmada` / `cita_reprogramada`) con:
  - `components[0]` tipo `body`: parámetros de texto (nombre, servicio/barbero, fecha/hora)
  - `components[1]` tipo `button` (índice 0, sub_type `url`): parámetro dinámico = `IAppointmentTokenService.GenerateToken(appointment.Id)`
- **`SendReminderAsync` / `SendCancellationAsync`**: payload de plantilla sin botones (`cita_recordatorio` / `cita_cancelada`), solo `components[0]` body.
- Errores de red/Meta (4xx/5xx) se loguean (`ILogger`) y **no propagan excepción** — mismo comportamiento no bloqueante que `TwilioWhatsAppService` hoy.

**DI en `Program.cs`** (orden de prioridad, sin romper configs existentes):
```csharp
var metaToken = builder.Configuration["Meta:AccessToken"];
if (!string.IsNullOrEmpty(metaToken))
    builder.Services.AddHttpClient<IWhatsAppService, MetaWhatsAppService>();
else if (!string.IsNullOrEmpty(twilioSid))
    builder.Services.AddHttpClient<IWhatsAppService, TwilioWhatsAppService>();
else
    builder.Services.AddSingleton<IWhatsAppService, ConsoleWhatsAppService>();
```

### 3. Plantillas en Meta Business Manager (fuera del código, documentado para referencia)

| Plantilla | Botones | Variables del cuerpo |
|-----------|---------|----------------------|
| `cita_confirmada` | Quick Reply "❌ Cancelar cita" (payload fijo `CANCELAR_CITA`) + CTA-URL "📅 Reprogramar" (base `https://<frontend>/reprogramar/`, sufijo dinámico `{{1}}` = token) | nombre cliente, servicio, barbero, fecha/hora |
| `cita_reprogramada` | mismos botones que `cita_confirmada` | nombre cliente, nueva fecha/hora, barbero |
| `cita_recordatorio` | ninguno | nombre cliente, fecha/hora, barbero |
| `cita_cancelada` | ninguno | nombre cliente, fecha/hora, barbero |

> Nota de diseño importante: Meta solo permite **un** sufijo dinámico en botones CTA-URL, apendizado a una URL base fija e igual para todos los tenants (una sola plantilla aprobada en la WABA). Por eso la ruta del magic link es **global** (`/reprogramar/:token`), no `/book/:subdomain/reprogramar/:token` — el tenant se resuelve server-side a partir del token (ver Fase 2, sección 2).

### 4. `WhatsAppWebhookController` — esqueleto

Nuevo `WebApi/Controllers/WhatsAppWebhookController.cs`, ruta `/api/webhooks/whatsapp`, `[AllowAnonymous]`:

- `GET`: verificación de Meta — compara `hub.verify_token` (query) contra `Meta:VerifyToken`; si coincide, responde con `hub.challenge` (200); si no, `403`.
- `POST`: valida `X-Hub-Signature-256` (HMAC-SHA256 del body crudo con `Meta:AppSecret`). Firma inválida → `401`, log de advertencia, no procesa. Firma válida → en Fase 1 solo **loguea el payload recibido** (`LogInformation`) y responde `200 OK`. La lógica de negocio (cancelación) se agrega en Fase 2.

---

## Fase 2 — Magic link y lógica de negocio del webhook

Reutiliza `IAppointmentTokenService.ValidateToken` (ya implementado en Fase 1). Recordatorio: se genera un token **nuevo** en cada `SendConfirmationAsync`/`SendRescheduleAsync` (no se reutiliza el anterior).

### 1. Endpoints públicos basados en token (sin `{subdomain}`)

Nuevo controller o sección en `PublicBookingController` con ruta base `api/public/appointments` (sin segmento `{subdomain}`, ya que el tenant se resuelve desde el token):

- **`GET /api/public/appointments/by-token/{token}`**
  1. `ValidateToken` → `appointmentId` (null → `404`)
  2. Carga `Appointment` con `IgnoreQueryFilters()`, `Include(Barber)`, `Include(Service)`
  3. Si no existe, `Status != Pendiente`, o `(AppointmentDate - now) <= 60min` → `404` (mismo mensaje genérico: "Este enlace ya no es válido")
  4. Si OK: setea `_tenantService.TenantId = appointment.TenantId` (para servicios que lo requieran) y devuelve `RescheduleTokenDto`:
     ```csharp
     public class RescheduleTokenDto
     {
         public Guid AppointmentId { get; set; }
         public Guid BarberId { get; set; }
         public Guid ServiceId { get; set; }
         public string BarberName { get; set; }
         public string ServiceName { get; set; }
         public DateTime AppointmentDate { get; set; }
         public string Subdomain { get; set; }       // para branding/colores
         public string TenantName { get; set; }
         public string PrimaryColor { get; set; }
         public string? LogoBase64 { get; set; }
     }
     ```

- **`PUT /api/public/appointments/by-token/{token}/reschedule`** — body `{ "newAppointmentDate": "..." }` (reutiliza `RescheduleAppointmentDto`)
  - Misma validación de token + estado + ventana de 60min
  - Misma lógica de disponibilidad/colisión que `PUT /api/public/{subdomain}/appointments/{id}/reschedule` (se extrae a un método privado compartido o se invoca desde el mismo controller)
  - Al éxito: `ReminderSentAt = null`, dispara `SendRescheduleAsync` (con token **nuevo** para el siguiente mensaje)

### 2. Frontend — página `/reprogramar/:token`

- Nueva ruta global (fuera de `/book/:subdomain/...`) en el router: `BarberBookSaaS.Web/src/features/booking/ReprogramarPage.tsx`
- Al montar: `GET /api/public/appointments/by-token/:token` → si `404`, muestra mensaje "Este enlace ya no es válido, contacta a la barbería" con `tenantName`/branding si se llegó a resolver, o genérico si no.
- Si OK: aplica branding (`primaryColor`, `logo`, `tenantName`) igual que `BookingPage`, y renderiza el **mismo selector de fecha/horarios que `RescheduleModal`** pero a página completa (sin overlay/portal).
- **Refactor mínimo**: se extrae el bloque de "selector de fecha + grid de horarios + botón confirmar" de `RescheduleModal.tsx` a un componente interno compartido `RescheduleForm` (recibe `subdomain`/`primaryColor`/datos de cita + callbacks `onSubmit`/`onCancel`). `RescheduleModal` lo envuelve en `createPortal`; `ReprogramarPage` lo renderiza directo. `RescheduleForm` no sabe si reprograma por JWT o por token — solo expone `onSubmit(newDateIso)`.
- Al confirmar: `ReprogramarPage` llama `PUT /api/public/appointments/by-token/:token/reschedule`.

### 3. Lógica de negocio del webhook — "Cancelar cita"

En `WhatsAppWebhookController.POST`, tras validar firma, se parsea el payload de Meta:

```
entry[0].changes[0].value.metadata.phone_number_id
entry[0].changes[0].value.messages[0].from        // wa_id del cliente
entry[0].changes[0].value.messages[0].id          // wamid (para idempotencia)
entry[0].changes[0].value.messages[0].button.payload  // "CANCELAR_CITA"
```

Flujo:
1. **Idempotencia**: si `wamid` ya está en `IMemoryCache` (TTL 5min) → responder `200`, no repetir.
2. **Resolver tenant**: `Tenants.IgnoreQueryFilters().FirstOrDefault(t => t.MetaPhoneNumberId == phone_number_id)`. Si no hay match → log + `200` (no-op).
3. Si `button.payload != "CANCELAR_CITA"` → `200`, no-op (otros tipos de evento de Meta se ignoran).
4. **Buscar cita cancelable**: `Appointments.IgnoreQueryFilters().Where(a => a.TenantId == tenant.Id && a.Status == Pendiente && (a.AppointmentDate - UtcNow) > 60min)`, filtrar en memoria por `NormalizePhone(a.CustomerPhone) == NormalizePhone(wa_id)` (últimos 10 dígitos), `OrderBy(AppointmentDate)`, `FirstOrDefault()`.
5. **Si hay match**: aplica la misma lógica de `CancelAppointment` (`Status = Cancelled`, `CancelledAt`, `CancelledBy = "whatsapp"`), `SaveChangesAsync`, y responde por WhatsApp vía `IWhatsAppService.SendTextAsync` confirmando: *"Listo, cancelamos tu cita del {fecha} a las {hora} con {barbero}."*
6. **Si no hay match**: responde con `SendTextAsync` explicando que no hay cita cancelable (ninguna pendiente, o todas a <60min) y sugiere visitar la web o llamar a la barbería.

---

## Manejo de errores (resumen)

| Caso | Resultado |
|------|-----------|
| Falla envío Meta API (red, plantilla rechazada, rate limit) | Se loguea, no bloquea la operación principal (crear/reprogramar cita sigue OK) |
| Token inválido/manipulado/expirado | `404` genérico en ambos endpoints `by-token` |
| Cita del token ya no `Pendiente` o <60min | `404` (mismo mensaje, no se distingue el motivo al usuario) |
| Webhook `GET` con `verify_token` incorrecto | `403` |
| Webhook `POST` con firma inválida | `401` + log de advertencia, no procesa |
| Webhook con `phone_number_id` sin tenant asociado o evento no reconocido | `200 OK` (no-op), log a nivel debug |
| Webhook reentregado (mismo `wamid`) | `200 OK` sin reprocesar (caché 5min) |
| "Cancelar cita" sin cita elegible | `200 OK` + respuesta de texto explicando la situación |

---

## Testing

- **Unitarios**:
  - `AppointmentTokenServiceTests`: generar/validar token, expiración, detección de manipulación (cambiar 1 byte → inválido)
  - `WhatsAppWebhookSignatureTests`: firma válida/inválida
  - Resolución de "cita más próxima cancelable": múltiples citas, normalización de teléfono, filtro >60min, sin resultados
- **Integración** (`WebApplicationFactory`):
  - `GET /api/public/appointments/by-token/{token}`: válido, expirado, tenant/estado inválido → `404`
  - `PUT .../by-token/{token}/reschedule`: éxito, conflicto de horario, <60min
  - `POST /api/webhooks/whatsapp`: firma válida cancela la cita correcta y responde `200`; firma inválida → `401`; verificación `GET`
- `MetaWhatsAppService`: `HttpClient` mockeado (mismo patrón que se usaría para Twilio) — no se prueba contra Graph API real.

---

## Fuera de alcance

- No se elimina `TwilioWhatsAppService`/`ConsoleWhatsAppService` — coexisten vía configuración (orden de prioridad en `Program.cs`).
- No se construye UI de administración para gestionar plantillas de Meta (se gestionan en Meta Business Manager).
- No se agregan botones a Recordatorio ni Cancelación.
- Registro/aprobación de plantillas en Meta Business Manager y obtención de `phone_number_id`/`AccessToken` son pasos manuales del usuario, fuera del código.
