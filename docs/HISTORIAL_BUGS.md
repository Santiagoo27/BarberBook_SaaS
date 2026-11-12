# Historial de Bugs Corregidos — BarberBook SaaS

## Sesión de correcciones — Junio 2026

---

### ✅ BUG 1 — Error silencioso al crear servicio desde UI
**Archivo:** ServiceManagement.tsx
**Severidad:** 🔴 Crítico
**Síntoma:** El botón "Crear servicio" no
disparaba ninguna acción ni mostraba error.
**Causa raíz:** El catch del handleSubmit
mostraba el error en un div oculto detrás
del backdrop del modal.
**Fix:**
- Nuevo estado formError + submitting
- Error mostrado dentro del modal
- Botón muestra "Guardando..." y se
  deshabilita durante la petición
- Toast de éxito al crear/editar
- cursor: pointer en el submit
**Verificado:** Servicio "Corte Premium"
($35.000, 45 min) creado exitosamente.

---

### ✅ BUG 2 — Conflicto al crear usuario desde panel admin
**Archivos:** BarberService.cs,
BarbersController.cs, BarberManagement.tsx
**Severidad:** 🔴 Crítico
**Síntoma:** Conflicto entre registro público
de clientes y creación desde panel admin.
Admin podía perder acceso si un barbero
se creaba con su mismo email.
**Causa raíz:** BarberService.CreateAsync
no validaba si el email ya existía en
la tabla Users del mismo tenant.
**Fix:**
- BarberService.cs: Validación email único
  por tenant antes de crear el User
- BarbersController.cs: Catch de
  InvalidOperationException → 409 Conflict
- BarberManagement.tsx: Error del backend
  mostrado dentro del modal
**Verificado:** Email duplicado muestra
"Ya existe un usuario con este correo
en la barbería." Email nuevo funciona.

---

### ✅ BUG 3 — Nombre del barbero no aparece en Dashboard
**Archivos:** IBarberService.cs,
BarberService.cs, BarbersController.cs,
AuthContext.tsx, barberService.ts,
BarberLayout.tsx
**Severidad:** 🟡 Importante
**Síntoma:** El sidebar del panel barbero
mostraba "Barbero" (el rol) en vez del
nombre real del barbero logueado.
**Causa raíz:** AuthContext solo guardaba
{ id, role } y BarberLayout mostraba
user?.role. No existía endpoint para
obtener el perfil del barbero.
**Fix:**
- Backend: Nuevo método GetByUserIdAsync
  en IBarberService/BarberService +
  endpoint GET /api/barbers/me
- Frontend: email agregado a interfaz User
  en AuthContext, nuevo getMe() en
  barberService, BarberLayout carga el
  nombre real al montar con fallback a email

---

### ✅ BUG 4 — Logo muy grande en celular (diagnóstico IA)
**Archivos:** index.css, BarberDashboard.tsx
**Severidad:** 🟡 Importante
**Síntoma:** Logo de 80×80px fijo tapaba
la imagen generada del diagnóstico en
pantallas pequeñas.
**Causa raíz:** Dimensiones hardcodeadas
en inline style sin responsive.
**Fix:**
- Nueva clase .diagnosis-logo en index.css
  con media queries:
  80px desktop → 56px tablet → 40px celular
- BarberDashboard.tsx: clase aplicada al
  contenedor del logo, removidos width/height
  del inline style

---

### ✅ BUG 5 — No se puede borrar el cero en servicios
**Archivo:** ServiceManagement.tsx
**Severidad:** 🟡 Importante
**Síntoma:** Al intentar borrar el precio
o duración el campo volvía a "0"
instantáneamente.
**Causa raíz:** useState(number) +
Number(e.target.value) en onChange
convertía "" a 0 inmediatamente.
**Fix:**
- Estados cambiados a string (durationStr,
  priceStr)
- onChange guarda el string tal cual
- onBlur valida rangos
- Conversión a número solo al guardar

---

### ✅ BUG 6 — Mejor UX para completar/cancelar citas (actualizado Junio 2026)
**Archivos:** BarberDashboard.tsx, index.css
**Severidad:** 🟡 Importante
**Síntoma:** Botones de 28×28px muy pequeños
para celular, sin confirmación al cancelar,
sin feedback visual tras la acción.
**Fix:**
- Botones agrandados: 32px desktop,
  44px celular con labels visibles
- Modal de confirmación antes de cancelar:
  "¿Cancelar la cita de [nombre] a las [hora]?"
- Toast de feedback: "Cita completada" /
  "Cita cancelada" por 3.5 segundos
- CSS responsive en index.css para
  .barber-action-btn y .barber-action-label

**Rediseño adicional aplicado (Junio 2026):**
- Botón COMPLETAR: verde prominente (`#10b981`) 60% del ancho, mínimo 48px altura
- Botón CANCELAR: rojo sutil 35% del ancho con modal de confirmación
- Citas ya procesadas: solo badge de estado
- Decisión de negocio documentada en `DECISIONES_DISENO.md`

---

### ✅ BUG 7 — Error falso en diagnóstico IA
**Archivos:** aiDiagnosisService.ts,
BarberDashboard.tsx
**Severidad:** 🟡 Importante
**Síntoma:** Aparecía un error brevemente
y luego el resultado aparecía correctamente.
**Causa raíz:** Sin timeout explícito en
Axios, el navegador cortaba la conexión
mientras Gemini procesaba (30-60s).
**Fix:**
- aiDiagnosisService.ts: Timeout explícito
  de 120 segundos en la llamada diagnose
- BarberDashboard.tsx: Loading progresivo
  en 3 fases:
  "Analizando imagen..." →
  "Generando cortes..." →
  "Casi listo..."
  + retry automático en errores de timeout

---

### ✅ BUG 8 — Input de fidelización no permite borrar el "1"
**Archivo:** BrandingPage.tsx
**Severidad:** 🟡 Importante
**Síntoma:** En "Programa de fidelización",
el campo numérico de citas necesarias siempre
mostraba "1". Solo se podía agregar dígitos a
la derecha (ej. "14") y luego borrar el "1".
**Causa raíz:** `onChange` usaba
`Math.max(1, parseInt(value) || 1)` que
convertía "" → NaN → 1 inmediatamente,
impidiendo que el campo quedara vacío.
**Fix:**
- Nuevo estado string `loyaltyInput` para
  el valor visible del input
- `onChange` guarda el string tal cual y
  solo actualiza el threshold si es número válido
- `onBlur` normaliza al rango 1–100
**Verificado:** Se puede borrar completamente
y escribir cualquier número. Al perder foco
valida mínimo 1, máximo 100.

---

### ✅ BUG 9 — Reprogramación de citas da error / no permite cambiar hora
**Archivos:** AppointmentService.cs,
RescheduleForm.tsx
**Severidad:** 🔴 Crítico
**Síntoma:** Al intentar reprogramar una cita
a otro día daba error. No dejaba cambiar de
hora en el mismo día.
**Causa raíz:** Dos restricciones del backend:
1. `newDate <= appointmentDate` → exigía que
   la nueva fecha fuera estrictamente posterior
   a la cita actual (imposible cambiar hora
   en el mismo día o mover a fecha anterior)
2. Antelación mínima de solo 1 hora
Frontend: fecha mínima era la fecha de la cita
(no hoy), y slots se filtraban vs hora de la
cita en vez de la hora actual.
**Fix:**
- Backend: antelación mínima → 6 horas
  (da tiempo al barbero de ocupar el slot)
- Backend: validación cambiada a
  `newDate <= DateTime.UtcNow` (cualquier
  fecha/hora futura disponible es válida)
- Frontend: fecha mínima = hoy (no la cita)
- Frontend: slots filtrados vs hora actual
**Verificado:** Se puede reprogramar a
cualquier día/hora futuro disponible con
mínimo 6h de antelación.

---

### ✅ BUG 10 — Etiquetas de cortes tapan rostros en móvil (SCRUM-29)
**Fecha:** 25 junio 2026
**Ticket:** SCRUM-29
**Archivos:** BarberDashboard.tsx, index.css
**Severidad:** 🟡 Importante
**Síntoma:** En móvil, las etiquetas de nombre de
corte dentro del grid 2×2 de imágenes del
diagnóstico IA hacían wrap en múltiples líneas,
tapando casi completamente los rostros. El logo
de la barbería (bottom-right) tapaba la etiqueta
del 4° corte. Además, la descarga JPG/PDF desde
móvil capturaba la vista responsive (etiquetas
truncadas, layout angosto) en vez de la calidad
desktop. La foto original del cliente no aparecía
en la sección "Análisis de Imagen Personal" al
reabrir un diagnóstico existente.
**Causa raíz:**
1. Etiquetas sin `white-space: nowrap` ni ellipsis
2. Logo en `bottom-right` colisionaba con la
   etiqueta del 4° cuadrante
3. `html-to-image` serializa computed styles del
   DOM — en móvil capturaba el layout angosto
4. `html-to-image` no renderiza data URLs grandes
   de `<img>` en el export SVG (foto del cliente
   de varios MB desde FileReader)
5. `preview` (foto del cliente) solo vivía en
   el state de React — al reabrir el modal para
   un diagnóstico existente, era `null`
**Fix:**
- `.diagnosis-cut-label`: `white-space: nowrap`,
  `overflow: hidden`, `text-overflow: ellipsis`;
  media query `≤640px`: `font-size: 11px`,
  `padding: 4px 8px`
- Logo movido de `bottom-right` a `top-right`
  (12px de margen); reducido a 30px en móvil,
  60px en export
- `captureAsDesktop()`: expande el contenedor y
  su padre a 600px antes de capturar; aplica
  clase `.diagnosis-export-mode` que fuerza
  estilos desktop; espera 2 animation frames
  para que el browser re-layoutee; restaura todo
  después de la captura
- Foto del cliente: `captureAsDesktop` reemplaza
  el `<img>` con un `<canvas>` de 112×112 antes
  de capturar (`html-to-image` captura canvas
  nativamente); restaura el `<img>` después
- `sessionStorage` con clave
  `diagnosis-photo-{appointmentId}`: la foto
  se comprime a 200×200 JPEG y se guarda tras
  un diagnóstico exitoso; al reabrir el modal,
  se restaura desde sessionStorage
**Verificado:** Etiquetas legibles en móvil.
Descarga JPG/PDF siempre con layout desktop
(600px, etiquetas completas, logo sin tapar
cortes). Foto del cliente visible en el export.

---

## Resumen de métricas

| Métrica | Valor |
|---|---|
| Total bugs corregidos | 10 |
| Bugs críticos | 3 |
| Bugs importantes | 7 |
| Tests antes | 41/41 ✅ |
| Tests después | 41/41 ✅ |
| Errores TypeScript | 0 |
| Archivos modificados | 16 |
| Líneas agregadas | ~280 |
| Líneas eliminadas | ~55 |

## Archivos protegidos — no modificados
- ✅ CircularGallery.tsx
- ✅ BookingPage.tsx
- ✅ DiagnosisInfographic.tsx

## Pendientes para siguiente sprint
Ver lista completa en SEGURIDAD.md
y en el backlog del proyecto.