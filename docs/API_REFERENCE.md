# API Reference — BarberBook SaaS

> Para arquitectura, dominio, multi-tenancy y convenciones generales, ver `CLAUDE.md`.

## Auth — rate limit: 5 req / 15min por IP

| Método | Ruta | Auth | Descripción |
|--------|------|:----:|-------------|
| GET | `/api/auth/tenant-by-email` | — | Lookup tenant por email: `?email=...` → `{ tenantId, tenantName, logoBase64? }` |
| POST | `/api/auth/register` | SuperAdmin JWT | Crea barbería + admin *(restringido a SuperAdmin)* |
| POST | `/api/auth/login` | — | Login → JWT + refresh token |
| POST | `/api/auth/refresh` | — | Rota refresh token |
| POST | `/api/auth/logout` | JWT | Invalida refresh token |
| POST | `/api/auth/forgot-password` | — | Solicita reset de contraseña; envía email con link (siempre 200) |
| POST | `/api/auth/reset-password` | — | Restablece contraseña con token válido (1h) |
| POST | `/api/auth/change-password` | JWT | Cambia contraseña |

**Body `login`:** `{ "email", "password" }`
**Body `change-password`:** `{ "currentPassword", "newPassword" }`

**Respuesta `login` / `refresh`:**
```json
{
  "token": "...", "refreshToken": "...", "expiresAt": "...",
  "userId": "...", "email": "...", "role": "Admin",
  "tenantId": "elegant", "mustChangePassword": false
}
```

---

## Barberos — JWT requerido

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/barbers` | Lista barberos activos del tenant |
| POST | `/api/barbers` | Crea barbero + user vinculado con contraseña temporal |
| PUT | `/api/barbers/{id}` | Actualiza nombre, email, teléfono, especialidad |
| DELETE | `/api/barbers/{id}` | Soft-delete (`IsActive = false`) |
| PUT | `/api/barbers/{id}/activate` | Reactiva barbero |
| POST | `/api/barbers/{id}/image` | Sube foto de perfil (multipart/form-data → base64 en DB, máx. 2MB, PNG/JPEG/WebP) |
| GET | `/api/barbers/{id}/schedule` | Obtiene horario de trabajo |
| POST | `/api/barbers/{id}/schedule` | Upsert de un día de horario |
| DELETE | `/api/barbers/{id}/schedule/{day}` | Elimina día del horario (0=Dom, 1=Lun...) |

**Body schedule:** `{ "dayOfWeek": 1, "startHour": 9, "startMinute": 0, "endHour": 18, "endMinute": 0, "breakStartHour": 13, "breakStartMinute": 0, "breakEndHour": 14, "breakEndMinute": 0 }` *(campos break opcionales — enviar `null` para quitar descanso; `breakEnd` debe ser mayor que `breakStart`)*

**Respuesta `POST /api/barbers`:** `{ "barber": {...}, "temporaryPassword": "Xy3z..." }`

---

## Servicios — JWT requerido

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/services` | Lista servicios del tenant |
| POST | `/api/services` | Crea servicio |
| PUT | `/api/services/{id}` | Actualiza servicio |
| DELETE | `/api/services/{id}` | Soft-delete |
| PUT | `/api/services/{id}/activate` | Reactiva servicio |
| POST | `/api/services/{id}/image` | Sube foto del servicio (multipart/form-data → base64 en DB, máx. 2MB, PNG/JPEG/WebP) |

---

## Citas — JWT requerido

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/appointments` | Lista citas (Admin: todas; Barbero: solo las propias) |
| POST | `/api/appointments` | Crea cita — retorna `BookingResult` con `ErrorCode` en errores |
| POST | `/api/appointments/walk-in` | Registra cliente sin cita (Barbero/Admin). Crea cita con `Status = Completada` y fecha/hora indicada |
| PUT | `/api/appointments/{id}/status` | Cambia estado: `Pendiente` / `Completada` / `Cancelada` |
| GET | `/api/appointments/availability` | Slots disponibles (`?barberId=&serviceId=&date=YYYY-MM-DD`) |

**Body POST:** `{ "barberId", "serviceId", "customerName", "customerPhone", "appointmentDate": "2026-05-25T14:00:00" }`

**Body POST walk-in:** `{ "serviceId": "guid", "customerName": "string (requerido, max 100)", "customerPhone": "string (opcional)", "appointmentDate": "datetime (opcional, default: ahora)" }`

**Respuesta availability:** `[{ "time": "09:00", "available": true }, ...]`

---

## Branding — JWT Admin

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/tenant/branding` | Obtiene configuración del tenant |
| PUT | `/api/tenant/branding` | Actualiza `theme`, `primaryColor`, `secondaryColor` |
| POST | `/api/tenant/logo` | Sube logo PNG (multipart/form-data → base64 en DB) |
| PUT | `/api/tenant/whatsapp` | Actualiza configuración de WhatsApp del tenant |
| PUT | `/api/tenant/address` | Actualiza la dirección física del tenant |

**Body PUT branding:** `{ "theme": "dark-premium", "primaryColor": "#D4AF37", "secondaryColor": "#6366F1" }`

**Body PUT address:** `{ "address": "Calle 85 #15-23, Bogotá" }` *(null o vacío borra la dirección)*

**Body PUT whatsapp:**
```json
{
  "enabled": true,
  "phone": "+573001234567",
  "metaPhoneNumberId": "123456789012345"
}
```

---

## Dashboard — JWT requerido

| Método | Ruta | Auth | Descripción |
|--------|------|:----:|-------------|
| GET | `/api/dashboard/stats` | JWT | Métricas (Admin: tenant completo; Barbero: solo propias). Acepta `?locationId=` opcional (Guid) para filtrar todas las métricas por sede |
| GET | `/api/dashboard/weekly-revenue` | Admin | Desglose de ingresos diarios de los últimos 7 días. Acepta `?locationId=` opcional (Guid) para filtrar por sede |

**Campos respuesta `stats`:** `totalActiveBarbers`, `todayAppointments`, `pendingCount`, `upcomingAppointments` (48h), `weekRevenue`

**Respuesta `weekly-revenue`:** `List<DailyRevenueDto>`
```json
[
  { "day": "Jue", "date": "2026-06-19", "revenue": 85000, "appointments": 5 },
  { "day": "Vie", "date": "2026-06-20", "revenue": 120000, "appointments": 8 }
]
```
**Campos:** `day` (abreviatura en español: "Lun"–"Dom"), `date` (ISO yyyy-MM-dd), `revenue` (suma de precios de citas Completadas), `appointments` (cantidad de citas Completadas). Siempre retorna exactamente 7 entradas ordenadas cronológicamente (hoy al final); días sin citas tienen `revenue: 0, appointments: 0`.

---

## Reseñas — JWT Admin (lectura) / sin auth (escritura pública)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/tenant/reviews` | Lista reseñas del tenant. Params: `?from=&to=&limit=` |

---

## Loyalty — JWT Admin

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/tenant/loyalty` | Configuración de fidelización |
| PUT | `/api/tenant/loyalty` | Actualiza `loyaltyEnabled`, `loyaltyThreshold` |
| POST | `/api/tenant/loyalty/award` | Otorga puntos manualmente a un cliente |

---

## Clientes — JWT Customer

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/customer/me` | Perfil del cliente + `LoyaltyCount` |
| GET | `/api/customer/appointments` | Historial de citas del cliente |

---

## Booking Público — sin JWT (rate limit: 20 req / 15min para registro)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/public/{subdomain}/branding` | Branding del tenant (nombre, colores, logo) |
| GET | `/api/public/{subdomain}/services` | Lista servicios del tenant. Acepta `?locationId=` opcional (Guid) para devolver solo los servicios asignados a esa sede |
| GET | `/api/public/{subdomain}/barbers` | Lista barberos del tenant. Acepta `?locationId=` opcional (Guid) para devolver solo los barberos asignados a esa sede (`Barber.LocationId == locationId`) |
| GET | `/api/public/{subdomain}/availability` | Slots disponibles |
| POST | `/api/public/{subdomain}/auth/login` | Auth cliente por teléfono |
| POST | `/api/public/{subdomain}/auth/register` | Registro de cliente nuevo |
| POST | `/api/public/{subdomain}/auth/refresh` | Rota refresh token cliente |
| POST | `/api/public/{subdomain}/appointments` | Agenda cita (con loyalty si presenta JWT Customer). Body acepta `locationId` opcional (Guid) para vincular la cita a una sede |
| DELETE | `/api/public/{subdomain}/appointments/{id}` | Cancela cita propia del cliente (solo si >60 min de antelación) |
| PUT | `/api/public/{subdomain}/appointments/{id}/reschedule` | Reprograma cita propia del cliente (JWT Customer). Body: `{ newAppointmentDate }`. Reglas: Pendiente, >1h antelación, nueva fecha posterior, slot disponible. Devuelve `{ appointmentId, appointmentDate, status, message }`. |
| POST | `/api/public/{subdomain}/reviews` | Crea reseña (sin auth). Body: `{ appointmentId?, rating, comment? }` |
| GET | `/api/public/{subdomain}/reviews/summary` | Retorna `{ averageRating, totalReviews }` del tenant |

---

## Reprogramación por token (WhatsApp Fase 2)

Ruta anónima. El token HMAC-SHA256 (`IAppointmentTokenService`) acredita la propiedad de la cita sin login.

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/public/reschedule/{token}` | Anónimo | Valida el token, devuelve `TokenAppointmentDto` con branding del tenant + datos de la cita + `canReschedule`. `404` si token inválido/expirado o cita no encontrada. |
| PUT | `/api/public/reschedule/{token}` | Anónimo | Body: `{ newAppointmentDate }`. Reprograma la cita. Respuestas: `200 { appointmentId, appointmentDate, status, message }` / `400` (NOT_PENDING, TOO_LATE, NOT_LATER) / `404` (token inválido) / `409 { errorCode: "SCHEDULE_CONFLICT" }`. |

---

## WhatsApp Webhook (Meta Cloud API)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/whatsapp/webhook` | Anónimo | Verificación del webhook (Meta). Query params: `hub.mode`, `hub.verify_token`, `hub.challenge`. Devuelve `hub.challenge` como texto plano si `hub.verify_token` coincide con `Meta:VerifyToken`; si no, `403 Forbidden`. |
| POST | `/api/whatsapp/webhook` | Anónimo (firma `X-Hub-Signature-256`) | Recibe eventos `messages` de Meta. Valida la firma HMAC-SHA256 del cuerpo con `Meta:AppSecret`; `401 Unauthorized` si no coincide. Si el mensaje es un botón con payload `CANCELAR_CITA`, resuelve el tenant por `Tenant.MetaPhoneNumberId` y cancela la cita `Pending` cuyo `CustomerPhone` coincide con el remitente. Siempre responde `200 OK` (incluso si no encuentra coincidencia, para que Meta no reintente). |

---

## Sedes (Locations) — JWT requerido

Solo el SuperAdmin puede crear y eliminar sedes (control de almacenamiento/abuso). El Admin gestiona nombre, dirección, barberos y servicios de las sedes ya creadas. Todos los campos de sede son opcionales a nivel de barbero/cita (`LocationId` nullable) — barberías de una sola sede no se ven afectadas.

| Método | Ruta | Auth | Descripción |
|--------|------|:----:|-------------|
| GET | `/api/locations` | Admin, Barbero, SuperAdmin | Lista sedes activas del tenant con conteo de barberos y servicios. El SuperAdmin la usa con `X-Tenant-Id` explícito para gestionar sedes de cualquier barbería desde su panel |
| GET | `/api/locations/{id}` | Admin | Detalle de una sede: barberos y servicios asignados |
| POST | `/api/locations` | SuperAdmin | Crea una sede nueva |
| PUT | `/api/locations/{id}` | Admin | Actualiza nombre/dirección |
| DELETE | `/api/locations/{id}` | SuperAdmin | Soft-delete (`IsActive = false`) |
| POST | `/api/locations/{id}/barbers` | Admin | Asigna un barbero a la sede. Body: `{ "barberId" }` |
| DELETE | `/api/locations/{id}/barbers/{barberId}` | Admin | Quita el barbero de la sede |
| POST | `/api/locations/{id}/services` | Admin | Asigna un servicio a la sede. Body: `{ "serviceId" }` |
| DELETE | `/api/locations/{id}/services/{serviceId}` | Admin | Quita el servicio de la sede |

**Body POST/PUT:** `{ "name": "Sede Centro", "address": "Calle 10 #5-20" }`

**Respuesta `LocationDto`:** `{ "id", "name", "address", "isActive", "barberCount", "serviceCount" }`
**Respuesta `LocationDetailDto`:** `LocationDto` + `{ "barbers": [{ "id", "name", "specialty", "imageBase64" }], "services": [{ "id", "name", "price", "durationMinutes" }] }`

**Errores:** `404` si la sede no existe o no pertenece al tenant · `400` si el barbero/servicio a asignar no existe o pertenece a otro tenant · `403` si un Admin intenta crear/eliminar sedes.

**Público:** `GET /api/public/{subdomain}/locations` — lista sedes activas del tenant, sin auth.

**Disponibilidad con filtro de sede:** `GET /api/public/{subdomain}/availability` acepta el parámetro opcional `locationId` (Guid). Si se envía, solo retorna slots si el `barberId` consultado pertenece a esa sede (`Barber.LocationId == locationId`); si no coincide, retorna lista vacía. Sin `locationId`, el comportamiento es el mismo de siempre.

---

## SuperAdmin — JWT SuperAdmin

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/superadmin/tenants` | Lista todas las barberías con stats (barberos, citas, plan, estado) |
| POST | `/api/superadmin/tenants` | Crea nueva barbería + admin |
| PUT | `/api/superadmin/tenants/{id}/plan` | Cambia plan del tenant. Body: `{ plan: "Standard" \| "Premium" }` |
| PUT | `/api/superadmin/tenants/{id}/status` | Activa/suspende tenant. Body: `{ isWebActive: bool }` |

**Body POST:** `{ "barberiaName", "subdomain", "phone", "address", "adminEmail", "adminPassword" }`

**Credenciales SuperAdmin (desarrollo):**
- Email: `superadmin@barberbook.dev` · Contraseña: *(configurada en appsettings)* · Subdominio: *(dejar vacío)*
