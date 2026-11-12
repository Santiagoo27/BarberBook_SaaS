# Dashboard — Filtro de Rango de Tiempo

**Fecha:** 2026-07-02  
**Estado:** Aprobado

---

## Objetivo

Permitir al dueño de la barbería alternar entre cuatro rangos de tiempo en el dashboard ("Hoy", "7 días", "15 días", "30 días") para ver métricas agregadas del período seleccionado, en lugar de estar limitado siempre a la vista de hoy.

---

## Comportamiento

### Selector de rango

- Cuatro pills/botones en el encabezado del dashboard, alineados a la derecha del título "Resumen del negocio":  
  `[Hoy] [7 días] [15 días] [30 días]`
- La opción activa se resalta con `var(--color-primary)` (fondo + borde); las inactivas usan glass neutro.
- Al cambiar de rango: las tarjetas muestran skeleton breve con `fade-up` al cargar.
- Estado por defecto: **"Hoy"**.

### Modo "Hoy" (comportamiento actual, sin cambios)

Tarjetas:
1. Citas de hoy
2. Pendientes
3. Barberos activos
4. Ingresos hoy
5. Clientes registrados
6. Clientes sin cita (hoy / total)

Gráfica: últimos 7 días (comportamiento actual).

### Modo 7 / 15 / 30 días (nuevo)

La grilla de tarjetas se reemplaza completamente por cuatro tarjetas de período:

| # | Tarjeta | Dato |
|---|---------|------|
| 1 | Citas del período | Total de citas no canceladas en los últimos N días |
| 2 | Ingresos totales | Suma de precios de citas completadas en los últimos N días |
| 3 | Clientes nuevos | Clientes cuyo `CreatedAt >= startDate` |
| 4 | Clientes sin cita | Walk-ins no cancelados en los últimos N días |

Gráfica: muestra N días de datos de ingresos diarios. El título se actualiza a `"Ingresos de los últimos N días"`.

---

## Backend

### 1. Nuevo DTO — `PeriodStatsDto.cs`

**Ruta:** `BarberBookSaaS.Application/DTOs/Dashboard/PeriodStatsDto.cs`

```csharp
public class PeriodStatsDto
{
    public int     TotalAppointments { get; set; }
    public decimal TotalRevenue      { get; set; }
    public int     NewCustomers      { get; set; }
    public int     TotalWalkIns      { get; set; }
}
```

### 2. `IDashboardService` — nueva firma y extensión

```csharp
// Nueva
Task<PeriodStatsDto> GetPeriodStatsAsync(int days, Guid? locationId = null);

// Extendida (default 7 — sin cambio de contrato)
Task<List<DailyRevenueDto>> GetWeeklyRevenueAsync(Guid? locationId = null, int days = 7);
```

`GetStatsAsync` **no se modifica**.

### 3. `DashboardService` — implementación de `GetPeriodStatsAsync`

- `startDate = today.AddDays(-(days - 1))` (Colombia offset, igual que el resto del servicio — incluye hoy, igual que `GetWeeklyRevenueAsync`)
- `TotalAppointments`: `COUNT` de citas con `AppointmentDate >= startDate` y `Status != Cancelled`
- `TotalRevenue`: `SUM(Service.Price)` de citas con `Status == Completed` en el período
- `NewCustomers`: `COUNT` de `Customers` con `CreatedAt >= startDate`
- `TotalWalkIns`: `COUNT` de citas `IsWalkIn && Status != Cancelled` en el período
- Filtro por `locationId` cuando se provee (igual que las demás queries del servicio)

`GetWeeklyRevenueAsync` recibe `days` y usa `today.AddDays(-(days - 1))` como `startDate`, generando exactamente N entradas.

### 4. `DashboardController` — nuevo endpoint

```
GET /api/dashboard/period-stats?days=7&locationId=...
[Authorize(Roles = Admin)]
```

Valida que `days` sea 7, 15 o 30; devuelve 400 para cualquier otro valor.

---

## Frontend

### `dashboardService.ts`

Nuevo tipo y dos métodos:

```typescript
export interface PeriodStats {
  totalAppointments: number;
  totalRevenue:      number;
  newCustomers:      number;
  totalWalkIns:      number;
}

// Extender firma existente:
getWeeklyRevenue: async (locationId?, days = 7) => ...

// Nuevo:
getPeriodStats: async (days: number, locationId?) => ...
```

### `Dashboard.tsx`

**Estado nuevo:**
```typescript
type TimeRange = 'today' | 7 | 15 | 30;
const [timeRange, setTimeRange]     = useState<TimeRange>('today');
const [periodStats, setPeriodStats] = useState<PeriodStats | null>(null);
const [periodLoading, setPeriodLoading] = useState(false);
```

**`useEffect` de revenue/stats** se dispara cuando cambia `timeRange` o `selectedLocationId`:
- `timeRange === 'today'` → `getWeeklyRevenue(locationId, 7)` + `getStats(locationId)` (igual que hoy)
- `timeRange !== 'today'` → `getRevenue(locationId, timeRange)` + `getPeriodStats(timeRange, locationId)` en paralelo

**Renderizado condicional de tarjetas:**
- `timeRange === 'today'` → grilla actual (sin cambio)
- `timeRange !== 'today'` → 4 tarjetas de período con `PeriodStats`

**Selector UI:** componente inline en el header del dashboard; pills con `onClick={() => setTimeRange(range)}`.

---

## Archivos a modificar / crear

| Acción | Archivo |
|--------|---------|
| Crear | `Application/DTOs/Dashboard/PeriodStatsDto.cs` |
| Modificar | `Application/Common/IDashboardService.cs` |
| Modificar | `Infrastructure/Services/DashboardService.cs` |
| Modificar | `WebApi/Controllers/DashboardController.cs` |
| Modificar | `Web/src/features/dashboard/dashboardService.ts` |
| Modificar | `Web/src/features/dashboard/Dashboard.tsx` |

---

## Fuera de alcance

- Rango personalizado con datepicker
- Filtro por barbero específico dentro del período
- Exportar datos del período
- Cambios en el panel del Barbero (solo Admin)
