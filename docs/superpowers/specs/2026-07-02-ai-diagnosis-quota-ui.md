# Spec: Cuota de Diagnósticos IA — Feedback Visual en DiagnosisModal

**Fecha:** 2026-07-02  
**Estado:** Aprobado

---

## Contexto

El sistema de cuota de diagnósticos IA ya está implementado en el backend:

- `Tenant` tiene `AiDiagnosisUsed` (int) y `AiDiagnosisPeriodStart` (DateTime?)
- Migración `AddAiDiagnosisQuota` aplicada en producción
- `POST /api/appointments/{id}/ai-diagnosis` rechaza con 403 cuando `AiDiagnosisUsed >= 100` para plan Premium
- `GET /api/appointments/ai-diagnosis/quota` devuelve `{ plan, available, used, limit, remaining, resetDate? }`
- Dashboard Admin ya muestra un widget de cuota

**Lo que falta:** el barbero que ejecuta el diagnóstico en `DiagnosisModal` (dentro de `BarberDashboard.tsx`) no recibe feedback proactivo. Hoy si llega al límite, solo ve el mensaje de error del 403 después de intentarlo.

---

## Objetivo

Agregar feedback de cuota **dentro del `DiagnosisModal`** (`BarberDashboard.tsx`) para que el barbero vea cuántos diagnósticos le quedan antes de intentar uno, con advertencia suave al acercarse al límite y bloqueo al llegar a 0.

---

## Alcance

**Un solo archivo modificado:** `BarberBookSaaS.Web/src/features/barbers/BarberDashboard.tsx`

**No se toca:**
- Backend (ya completo)
- `aiDiagnosisService.ts` (ya tiene `getQuota()`)
- `Dashboard.tsx` (ya tiene su widget)
- Ningún otro componente

---

## Planes según plan del tenant

| Plan | Comportamiento |
|------|---------------|
| `Standard` | No aplica — el botón de diagnóstico no se renderiza para este plan |
| `Premium` | Aplica cuota: 100 diagnósticos por ventana de 30 días |
| `PremiumUnlimited` | Sin cuota — `limit === -1` — no se muestra banner |

---

## Estados visuales del banner

El banner se ubica **debajo del título del modal, antes del uploader de foto**, solo cuando hay información relevante que mostrar.

### Estado 1 — Normal (`remaining > 20`)
- Sin banner. La cuota no se muestra para no agregar ruido cuando no es relevante.

### Estado 2 — Advertencia suave (`1 ≤ remaining ≤ 20`)
- **Banner amarillo/ámbar**
- Icono `⚠` + texto: `"Quedan {remaining} diagnósticos este mes · se reinicia el {DD MMM}"`
- Colores: fondo `rgba(234,179,8,0.1)`, borde `rgba(234,179,8,0.3)`, texto `#fbbf24`
- El botón "Analizar" permanece **habilitado**

### Estado 3 — Bloqueado (`remaining === 0`)
- **Banner rojo**
- Icono `🚫` + texto: `"Límite mensual alcanzado · se reinicia el {DD MMM}"`
- Colores: fondo `rgba(239,68,68,0.1)`, borde `rgba(239,68,68,0.3)`, texto `#f87171`
- El botón "Analizar" está **deshabilitado** (opacidad 0.4, `cursor: not-allowed`)

### Estado 4 — Cargando cuota (`loadingQuota === true`)
- Sin banner (silencioso). El botón permanece habilitado optimísticamente.
- Si la cuota falla con error de red, tampoco mostrar banner (no bloquear por fallo de red).

### Estado — Ya tiene diagnóstico
- Si la cita ya tiene diagnóstico (`result !== null`), la cuota no es relevante y no se muestra el banner.

---

## Flujo de datos

```
DiagnosisModal monta
    → useEffect: aiDiagnosisService.getQuota()
        → setQuota(data) / setLoadingQuota(false)
        → error de red: setLoadingQuota(false), quota permanece null (silencioso)

Barbero sube foto → handleAnalyze():
    → Si quota?.remaining === 0: return (guardia; en la práctica el botón ya está deshabilitado)
    → POST /api/appointments/{id}/ai-diagnosis
    → En éxito: setQuota(q => q && q.limit !== -1
            ? { ...q, remaining: Math.max(0, q.remaining - 1), used: q.used + 1 }
            : q)
    → En 403: setError(msg del backend — ej: "Límite mensual de 100 diagnósticos alcanzado...")
              (fallback para race conditions; el banner ya debería haberlo anticipado)
```

**No hay re-fetch de cuota** tras el diagnóstico — se actualiza el contador localmente para evitar latencia.

---

## Formato de fecha en el banner

```ts
new Date(quota.resetDate).toLocaleDateString("es-CO", { day: "numeric", month: "short" })
// → "1 ago", "15 jul", etc.
```

Si `resetDate` no está disponible (no debería pasar para Plan Premium), omitir la parte de reinicio.

---

## Nuevos estados en DiagnosisModal

```ts
const [quota, setQuota] = useState<AiDiagnosisQuota | null>(null);
const [loadingQuota, setLoadingQuota] = useState(true);
```

`AiDiagnosisQuota` ya está definida en `aiDiagnosisService.ts`:
```ts
interface AiDiagnosisQuota {
  plan: string;
  available: boolean;
  used: number;
  limit: number;
  remaining: number;
  resetDate?: string;
}
```

---

## Condición para mostrar el banner

```ts
const showQuotaBanner =
  !result &&                        // no hay diagnóstico ya
  quota !== null &&                 // cuota cargada
  quota.limit !== -1 &&            // no es PremiumUnlimited
  quota.remaining <= 20;           // dentro del rango de advertencia o bloqueo
```

---

## Tests

No hay lógica de negocio nueva en backend — la cobertura de tests existente cubre el enforcement del límite. Este cambio es puramente UI. Verificar manualmente:

1. Tenant Plan Premium con `remaining = 5` → banner amarillo visible, botón habilitado, diagnóstico funciona y contador baja a 4
2. Tenant Plan Premium con `remaining = 0` → banner rojo visible, botón deshabilitado
3. Tenant PremiumUnlimited → sin banner
4. Error de red al cargar cuota → sin banner, botón habilitado (no bloquear por fallo de red)
