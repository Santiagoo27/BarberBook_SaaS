# Decisiones de Diseño — BarberBook SaaS

| Decisión | Razón |
|----------|-------|
| Multi-tenant por subdominio (string, no Guid) | Simplifica deploy inicial; facilita debug visual |
| Colisiones de horario en memoria (no SQL) | Query trae solo el día del barbero; overlap en .NET es más legible para MVP |
| `LoginAsync` verifica SuperAdmin primero (ignora tenant) | Permite login de SuperAdmin aunque haya tenant stale en localStorage |
| Campo subdominio en Login | Admin/barbero de primera vez no tienen `barber_tenant_id`; campo explícito elimina ambigüedad |
| `barber_tenant_id` no se borra en logout | Persiste para auto-rellenar el subdominio en el próximo login |
| `readCustomerAuth` valida `tenantId` contra subdominio actual | Sesión de cliente es por-tenant; JWT de otro tenant causa 403 en el backend |
| `BarberService.CreateAsync` setea `TenantId` explícito | No depender del interceptor para entidades críticas; interceptor falla si admin tiene `TenantId=""` |
| Interceptor TenantId: solo escribe si vacío Y tenant activo | Evita sobrescribir TenantIds explícitos durante `RegisterTenantAsync` |
| Rate limiting por IP (no global) | Un usuario no bloquea a los demás |
| Rate limit registro público: 20 req/15min (no 5) | Constraint de teléfono único ya previene spam; 5/15min era demasiado restrictivo en desarrollo |
| Logo base64 en DB | MVP evita file system externo. Producción: mover a Azure Blob/S3 |
| ThemeContext persiste en localStorage | Aplica tema antes de respuesta del backend; evita flash de colores |
| JWT 1h + Refresh 30 días | Balance seguridad/UX; `ChangePassword` invalida el refresh activo |
| `UseHttpsRedirection` solo en Production | En Development evita warning y redirect fallido |
| DataSeeder omitido en environment "Testing" | En tests, el esquema puede no existir aún cuando corre el seed |
| Modales con `createPortal` + inline styles (no Tailwind) | `AdminLayout` usa `overflow-y-auto` que rompe `position: fixed` en Chrome; `createPortal` escapa al `<body>`; Tailwind v4 no aplica clases de posicionamiento en contenido portalizado → inline styles como fallback |
| Glass via inline styles + CSS variables (no clases Tailwind puras) | Tailwind v4 no genera utilidades de `backdrop-filter` de forma fiable; inline styles con variables CSS garantizan que el efecto funcione en todos los temas sin purge issues |
| `color-mix()` para colores de acento en glass | Todos los fondos/bordes de acento derivan de `--color-primary`/`--color-secondary` — el branding custom del tenant se propaga automáticamente a stat cards, badges y avatares sin código adicional |
| Paleta de avatares determinista (`charCodeAt(0) % 4`) | Mapeo estable nombre→color sin estado; el mismo nombre siempre produce el mismo color en cualquier contexto |
| `SuperAdminPage` modal con inline styles hardcoded (no variables CSS de tema) | SuperAdmin usa su propio layout oscuro independiente de `ThemeContext`; las variables de tema no están disponibles. Todos los inputs del modal usan `color: "#f5f5f5"` y `background: "#1c1c1e"` directamente |
| Break window validation doble capa (frontend + backend) | Frontend valida `breakEnd > breakStart` antes de enviar para UX inmediata. Backend aplica guard `breakEnd.Value > breakStart.Value` en `GetAvailabilityAsync` como defensa contra datos corruptos en DB — una ventana de cero duración simplemente no excluye ningún slot |
| Responsive en `AgendaRow` vía CSS `order` + `flex:1 1 100%` (no reestructurar DOM) | Los 6 elementos de la fila conservan su orden DOM de escritorio; en móvil (≤640px) se reordenan con `order:1-5` y los bloques de detalle usan `flex:1 1 100%` para forzar su propia fila, indentados con `padding-left:58px` para alinearse bajo el avatar — evita duplicar JSX o usar variantes `display:none` |
| `appt-filter-bar` con `overflow-x:auto` en móvil (no `flex-wrap`) | Los tabs de filtro no se rompen en dos líneas (confunde la jerarquía visual); scroll horizontal con `scrollbar-width:none` permite acceder a todos los estados sin ocupar altura extra |
| `ImageUploadValidator` valida magic bytes además de `Content-Type` | El `Content-Type` es client-supplied y no confiable — previene subir archivos disfrazados (ej. SVG con script renombrado a `.png`); solo se aceptan PNG/JPEG/WebP, máx. 2MB |
| Fallback SVG inline (tijeras / inicial) en `primaryColor` para servicios/barberos sin foto | `CircularGallery` siempre necesita una imagen por card; el fallback se genera en el cliente vía `data:image/svg+xml`, sin depender de assets externos, y hereda el branding del tenant |
| Lista Crystal Liquid en BookingPage reemplaza carruseles 3D | El carrusel 3D era visualmente llamativo pero impedía escanear opciones rápidamente — la lista vertical con glassmorphism es más práctica, accesible y sigue el lenguaje de diseño iOS. Selección explícita + botón "Continuar" da más control al usuario |
| `contrastColor()` calcula checkmark/CTA sobre `primaryColor` vía luminancia | El color primario es dinámico (lo elige cada admin) — hardcodear blanco o negro fallaría con ciertos matices; el cálculo `L = 0.2126r + 0.7152g + 0.0722b` con umbral 0.43 garantiza contraste WCAG mínimo |
| Gradientes de thumbnail con `primaryColor` + `secondaryColor` | Evita placeholder genérico gris; los gradientes alternan entre colores del branding del admin para que los thumbnails sin foto se sientan parte de la identidad visual del tenant |
| Validación de formato de teléfono vía `[RegularExpression]` en DTOs (doble capa) | `Customer.Phone` se usa directamente como `toPhone` de WhatsApp y no tenía validación de formato — un email o texto arbitrario podía registrarse como "teléfono". Regex `^\+?(?:[\s\-\(\)]*\d){7,15}[\s\-\(\)]*$` (7-15 dígitos, `+` opcional, separadores libres) aplicada en `RegisterCustomerDto` (backend) y `BookingPage.tsx handleAuth` (frontend), siguiendo el patrón ya usado en `RegisterTenantDto.Subdomain` |
| `IWhatsAppService` recibe `appointmentId` (1er parámetro) y `metaPhoneNumberId` (último parámetro) en sus 4 métodos | Permite que cualquier proveedor (Console/Twilio/Meta) tenga el contexto completo de la cita y del tenant sin depender de estado ambiental — `MetaWhatsAppService` los necesita para el endpoint por-tenant y el token del botón "Reprogramar" |
| `IAppointmentTokenService` firma tokens HMAC-SHA256 reutilizando `Jwt:Key`, formato `{base64url(payload)}.{base64url(firma)}` con `payload = "{appointmentId:N}|{expiresAtUtc.Ticks}"` | Evita introducir una segunda clave secreta solo para esto; el formato es compacto y apto para ir como sufijo de URL en el botón "Reprogramar" de WhatsApp |
| Las plantillas de WhatsApp (`cita_confirmada`, `cita_reprogramada`, `cita_recordatorio`) comparten 3 variables de cuerpo (`{{1}}` nombre, `{{2}}` fecha/hora `dd/MM/yyyy 'a las' HH:mm`, `{{3}}` barbero) y 2 botones (índice 0 "Reprogramar" CTA-URL, índice 1 "Cancelar cita" Quick Reply payload `CANCELAR_CITA`); `cita_cancelada` no tiene botones | Estandariza el contrato entre el backend y las plantillas configuradas en Meta Business Manager; cancelar una cita ya cancelada no tiene sentido |
| `Meta:PhoneNumberId` NO existe como config global — `phone_number_id` es siempre `Tenant.MetaPhoneNumberId` | Cada tenant tiene su propio número de WhatsApp Business; sin valor configurado, `MetaWhatsAppService` registra un warning y no envía, sin fallback |
| `Meta:TemplateLanguage` (default `es_MX`) es configurable | Evita hardcodear el código de idioma de las plantillas, que debe coincidir exactamente con el configurado en Meta Business Manager |
| El webhook resuelve el tenant por `Tenant.MetaPhoneNumberId == metadata.phone_number_id` y fija `_tenantService.TenantId` manualmente antes de consultar `_context.Appointments` | El webhook es anónimo (sin JWT ni `X-Tenant-Id`); es la única forma de aplicar el QueryFilter multi-tenant correctamente |
| El emparejamiento de teléfono en el webhook es igualdad exacta de dígitos (`CustomerPhone` normalizado == `from` normalizado) | Simplicidad para Fase 1; requiere que `CustomerPhone` incluya código de país (ya es el caso). Limitación conocida para Fase 2 si se requiere mayor tolerancia |
| Autenticación por token (reschedule desde WhatsApp): el token HMAC-SHA256 es la única prueba de propiedad; no se requiere sesión de cliente | Magic-link puro: quien tiene el token puede reprogramar. Posesión del token == autorización. No se distingue "expirado" de "inválido" en la respuesta para no filtrar información sobre la cita |
| `TokenAppointmentDto.Subdomain` = `appointment.TenantId` (no `Tenant.Subdomain`) | `TenantId` es la clave que se usa en `X-Tenant-Id` y en las rutas `/api/public/{subdomain}/...`; `Tenant.Subdomain` es un campo informativo separado que puede no coincidir. El frontend necesita la clave exacta para llamar a `getAvailability` |
| `AppointmentRescheduleLinkController` usa `IgnoreQueryFilters()` + asigna `_tenantService.TenantId` manualmente | Mismo patrón que `WhatsAppWebhookController`: el endpoint es anónimo, sin `X-Tenant-Id`; el tenant se resuelve desde la cita tras ignorar los query filters globales, y se inyecta en el servicio antes de delegar a `RescheduleAppointmentAsync` |
| `RescheduleAppointmentAsync` vive en `IAppointmentService` (no en un servicio propio) | Lógica idéntica entre el flujo autenticado ("Mis citas") y el flujo anónimo por token; extraer a la interfaz existente evita duplicación sin introducir una abstracción nueva |
| `RescheduleForm` es presentacional con `onSubmit: (iso) => Promise<void>` que debe rechazar con `Error(message)` | La forma en que se llama al backend (JWT vs. token) varía según el contexto (`RescheduleModal` vs. `ReschedulePage`); el formulario solo necesita saber cuándo mostrar error, no el origen del error |
| Walk-in crea `Appointment` directo (no crea `Customer`) | El `CustomerPhone` en `Appointment` es texto libre sin FK a `Customers` — registrar un walk-in no causa conflictos con clientes registrados; el teléfono se omite porque no tiene utilidad funcional en este flujo |
| Walk-in con servicio IA → status `Pending`; servicio normal → `Completed` | El diagnóstico IA requiere la foto del cliente presente; el botón IA solo aparece en citas Pendientes; fecha bloqueada a hoy (el cliente debe estar físicamente) |
| `colorScheme: "dark"` en inputs date/time del `WalkInModal` | Los íconos nativos del navegador (reloj, calendario) se renderizan en modo claro por defecto — `colorScheme` fuerza el modo oscuro para que contrasten con el fondo del formulario |
| Logo del diagnóstico IA en `top-right` (no `bottom-right`) | En `bottom-right` colisionaba con la etiqueta del 4° corte recomendado; `top-right` no interfiere con ninguna etiqueta (todas están en el borde inferior de cada cuadrante) |
| `captureAsDesktop()` expande el DOM a 600px antes de capturar con `html-to-image` | La librería serializa computed styles — en móvil capturaba el layout angosto. Expandir el DOM real fuerza al browser a re-layoutear con dimensiones desktop; las opciones `width`/`style` de la librería solo afectan el canvas, no el layout de los hijos |
| Reemplazo de `<img>` por `<canvas>` durante la captura del diagnóstico | `html-to-image` no renderiza data URLs grandes (fotos de cámara 5-10MB) dentro de `<img>` en su serialización SVG; `<canvas>` se captura nativamente vía `canvas.toDataURL()` interno de la librería |
| Foto del cliente en `sessionStorage` (no backend) | La foto del cliente solo existía en el state de React durante la sesión de upload; guardar un thumbnail comprimido (200×200 JPEG ~15KB) en `sessionStorage` permite restaurarla al reabrir el modal sin cambios en el backend. Limitación aceptada: se pierde al cerrar el navegador |

---

## Junio 2026 — Decisiones de UX

### ¿Por qué el admin no puede crear citas?

**Decisión tomada por:** Juan Pablo + Santiago
**Fecha:** Junio 2026

**Razón:**
- Al crear manualmente solo se guardaba nombre y teléfono sin vincular a un cliente real del sistema
- Causaba conflictos e inconsistencias en los datos de clientes
- Las citas deben tener siempre un cliente registrado vinculado

**Impacto:** Eliminado botón "Nueva Cita" de `AppointmentManagement.tsx`
**Backend:** Endpoint `POST /api/appointments` se mantiene para el booking público

### ¿Por qué el walk-in con servicio IA se crea como Pendiente?

**Decisión tomada por:** Juan Pablo
**Fecha:** Junio 2026

**Razón:**
- El diagnóstico IA requiere tomar una foto del cliente (debe estar presente físicamente)
- El botón de diagnóstico IA solo se muestra para citas con status "Pendiente"
- Si se creara como "Completada", el barbero no podría abrir el flujo de diagnóstico
- Flujo: registrar sin cita → tomar foto IA → completar cita manualmente
- La fecha se bloquea a hoy porque el cliente debe estar ahí para la foto

**Impacto:** `AppointmentService.CreateWalkInAsync` usa `AppointmentStatus.Pending` cuando `service.Name == "Corte + Diagnóstico IA"`, `Completed` para el resto

### ¿Por qué el walk-in no pide teléfono?

**Decisión tomada por:** Juan Pablo
**Fecha:** Junio 2026

**Razón:**
- El teléfono en el walk-in no se vincula a un cliente registrado
- No dispara notificaciones WhatsApp (el cliente ya está en la silla)
- No tiene utilidad funcional — pedirlo solo añade fricción al registro

**Impacto:** `WalkInModal` solo pide nombre, servicio, fecha y hora

### ¿Por qué solo el SuperAdmin puede crear y eliminar sedes?

**Decisión tomada por:** Juan Pablo
**Fecha:** Julio 2026

**Razón:**
- Solo el SuperAdmin puede crear y eliminar sedes para evitar abuso de almacenamiento
- El Admin gestiona la configuración de las sedes existentes (nombre, dirección, barberos, servicios asignados)
- `Barber.LocationId` y `Appointment.LocationId` son nullable — barberías de una sola sede no requieren migrar datos ni asignar nada

**Impacto:** `LocationsController` restringe `POST`/`DELETE` a `UserRoles.SuperAdmin`; `PUT` y las asignaciones de barberos/servicios quedan en `UserRoles.Admin`. `DeleteAsync` en `LocationService` es soft-delete (`IsActive = false`), igual que Barbers/Services.

### ¿Por qué toda barbería tiene siempre al menos una "Sede Principal"?

**Decisión tomada por:** Juan Pablo
**Fecha:** Julio 2026

**Razón:**
- Barberías existentes y nuevas podían quedar sin ninguna sede, dejando barberos, citas y servicios sin `LocationId`/`LocationServices` vinculados
- Toda barbería tiene siempre al menos una sede llamada "Sede Principal" creada automáticamente al registrarse, usando la dirección del tenant
- Con exactamente 1 sede activa: los barberos nuevos se asignan automáticamente a esa sede (`Barber.LocationId`) y los servicios nuevos se vinculan automáticamente en `LocationServices`
- Con 2+ sedes: la asignación es manual desde el panel de Sedes — evita adivinar a cuál sede pertenece un barbero/servicio nuevo

**Impacto:** `AuthService.RegisterTenantAsync` crea la Sede Principal con `TenantId` explícito (mismo patrón que el admin, ver decisión de interceptor arriba) tras registrar el tenant. `BarberService.CreateAsync` y `ServiceService.CreateAsync` auto-asignan/vinculan solo cuando `_context.Locations.Where(l => l.IsActive).Count() == 1`. La migración `SeedSedesPrincipales` migra datos existentes con la misma regla (idempotente, vía SQL directo).

### ¿Por qué `apiClient` no debe sobreescribir un `X-Tenant-Id` explícito?

**Descubierto por:** Juan Pablo (bug reportado en producción de desarrollo)
**Fecha:** Julio 2026

**Razón:**
- El interceptor global de `apiClient` inyecta `X-Tenant-Id` desde `localStorage.barber_tenant_id` en cada request, para que Admin/Barbero no tengan que pasarlo manualmente
- El panel de SuperAdmin necesita gestionar sedes de una barbería arbitraria pasando `X-Tenant-Id` explícito por request (ver "Sedes (SuperAdmin)" en `SuperAdminPage.tsx`)
- El interceptor original sobreescribía `config.headers["X-Tenant-Id"]` incondicionalmente si `localStorage.barber_tenant_id` tenía un valor — lo cual ocurre en cuanto el mismo navegador inició sesión alguna vez como Admin de un tenant. Esto hacía que **todas** las operaciones de sedes del SuperAdmin (listar/crear/eliminar) se aplicaran silenciosamente al tenant "pegado" en `localStorage` en vez del tenant realmente seleccionado en el modal — sin importar cuál barbería eligiera

**Impacto:** `apiClient.ts` ahora solo inyecta `X-Tenant-Id` desde `localStorage` **si el llamador no lo pasó ya explícitamente** (`if (tenantId && !config.headers["X-Tenant-Id"])`). Cualquier código que necesite actuar "en nombre de" un tenant específico (como `superAdminService.getLocationsForTenant`) debe pasar el header en el config de la llamada, con la garantía de que no será pisado.

### ¿Por qué los botones de citas son grandes?

**Decisión tomada por:** Juan Pablo + Santiago
**Fecha:** Junio 2026

**Razón:**
- Los barberos usan el panel principalmente desde celular mientras atienden clientes
- Un botón pequeño genera errores de toque y frustra al barbero en plena atención
- COMPLETAR es la acción más frecuente y debe ser inmediata y visible
- CANCELAR requiere confirmación para evitar cancelaciones accidentales
