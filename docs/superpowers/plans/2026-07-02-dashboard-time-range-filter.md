# Dashboard Time Range Filter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un selector Hoy / 7 días / 15 días / 30 días al dashboard del Admin que reemplaza las tarjetas de stats con métricas del período seleccionado.

**Architecture:** Nuevo endpoint `GET /api/dashboard/period-stats?days=N` retorna `PeriodStatsDto` con totales del período. `GetWeeklyRevenueAsync` se extiende con parámetro `days`. El frontend agrega estado `timeRange` y renderiza condicionalmente las tarjetas del período o las de hoy.

**Tech Stack:** .NET 10 / EF Core / SQLite (backend), React 18 / TypeScript / Tailwind (frontend), xUnit / WebApplicationFactory (tests)

## Global Constraints

- No modificar `GetStatsAsync` — la vista "Hoy" no cambia en absoluto
- Todos los rangos del período **incluyen hoy**: `startDate = today.AddDays(-(days - 1))`
- Usar Colombia offset `-5h` para calcular `today` (igual que el resto de `DashboardService`)
- `days` válidos: 7, 15, 30 — devolver 400 para cualquier otro valor
- Seguir los patrones de test existentes en `DashboardTests.cs`: `IAsyncLifetime`, `TestWebApplicationFactory`, `TestAuthHelper`
- Nombre de propiedades JSON en camelCase (ASP.NET Core default)
- No agregar botón "Crear cita" ni alterar `AppointmentManagement.tsx`

---

## File Map

| Acción | Archivo |
|--------|---------|
| **Crear** | `BarberBookSaaS.Application/DTOs/Dashboard/PeriodStatsDto.cs` |
| **Crear** | `BarberBookSaaS.Tests/DashboardPeriodStatsTests.cs` |
| **Modificar** | `BarberBookSaaS.Application/Common/IDashboardService.cs` |
| **Modificar** | `BarberBookSaaS.Infrastructure/Services/DashboardService.cs` |
| **Modificar** | `BarberBookSaaS.WebApi/Controllers/DashboardController.cs` |
| **Modificar** | `BarberBookSaaS.Web/src/features/dashboard/dashboardService.ts` |
| **Modificar** | `BarberBookSaaS.Web/src/features/dashboard/Dashboard.tsx` |
| **Modificar** | `BarberBookSaaS.Web/src/features/dashboard/WeeklyRevenueChart.tsx` |

---

## Task 1: Backend — DTO, Interface y Tests (red)

**Files:**
- Create: `BarberBookSaaS.Application/DTOs/Dashboard/PeriodStatsDto.cs`
- Create: `BarberBookSaaS.Tests/DashboardPeriodStatsTests.cs`
- Modify: `BarberBookSaaS.Application/Common/IDashboardService.cs`

**Interfaces:**
- Produces: `PeriodStatsDto` con propiedades `TotalAppointments`, `TotalRevenue`, `NewCustomers`, `TotalWalkIns`; `IDashboardService.GetPeriodStatsAsync(int days, Guid? locationId)`; `IDashboardService.GetWeeklyRevenueAsync(Guid? locationId, int days)` (default 7)

- [ ] **Step 1: Crear `PeriodStatsDto.cs`**

```csharp
// BarberBookSaaS.Application/DTOs/Dashboard/PeriodStatsDto.cs
namespace BarberBookSaaS.Application.DTOs.Dashboard;

public class PeriodStatsDto
{
    public int     TotalAppointments { get; set; }
    public decimal TotalRevenue      { get; set; }
    public int     NewCustomers      { get; set; }
    public int     TotalWalkIns      { get; set; }
}
```

- [ ] **Step 2: Actualizar `IDashboardService.cs`**

Agregar la nueva firma y extender la existente (el `= 7` default preserva todos los call sites actuales):

```csharp
// BarberBookSaaS.Application/Common/IDashboardService.cs
using BarberBookSaaS.Application.DTOs.Dashboard;

namespace BarberBookSaaS.Application.Common;

public interface IDashboardService
{
    Task<DashboardStatsDto>    GetStatsAsync(Guid? filterByUserId = null, Guid? locationId = null);
    Task<List<DailyRevenueDto>> GetWeeklyRevenueAsync(Guid? locationId = null, int days = 7);
    Task<PeriodStatsDto>       GetPeriodStatsAsync(int days, Guid? locationId = null);
}
```

- [ ] **Step 3: Escribir tests que fallan**

Crear `BarberBookSaaS.Tests/DashboardPeriodStatsTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;
using BarberBookSaaS.Tests.Helpers;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BarberBookSaaS.Tests;

public class DashboardPeriodStatsTests : IAsyncLifetime
{
    private readonly TestWebApplicationFactory _factory = new();
    private HttpClient _client = null!;
    private const string TenantId = "dash-period-t1";
    private const decimal Price = 25m;

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

        db.Tenants.Add(new Tenant { Id = TenantId, Name = "Period Test", Subdomain = TenantId });
        var barberId = Guid.NewGuid();
        var serviceId = Guid.NewGuid();
        db.Barbers.Add(new Barber { Id = barberId, TenantId = TenantId, Name = "Ana" });
        db.Services.Add(new Service
        {
            Id = serviceId, TenantId = TenantId, Name = "Corte",
            Price = Price, DurationMinutes = 30, IsActive = true
        });

        var today = DateTime.Now.Date;

        // Hace 3 días — completada, dentro de 7 días
        db.Appointments.Add(new Appointment
        {
            Id = Guid.NewGuid(), TenantId = TenantId, BarberId = barberId, ServiceId = serviceId,
            CustomerName = "C1", AppointmentDate = today.AddDays(-3).AddHours(9),
            Status = AppointmentStatus.Completed
        });
        // Ayer — completada, walk-in, dentro de 7 días
        db.Appointments.Add(new Appointment
        {
            Id = Guid.NewGuid(), TenantId = TenantId, BarberId = barberId, ServiceId = serviceId,
            CustomerName = "C2", AppointmentDate = today.AddDays(-1).AddHours(10),
            Status = AppointmentStatus.Completed, IsWalkIn = true
        });
        // Hace 20 días — completada, fuera de 7 y 15 días, dentro de 30 días
        db.Appointments.Add(new Appointment
        {
            Id = Guid.NewGuid(), TenantId = TenantId, BarberId = barberId, ServiceId = serviceId,
            CustomerName = "C3", AppointmentDate = today.AddDays(-20).AddHours(11),
            Status = AppointmentStatus.Completed
        });

        // Cliente hace 2 días — dentro de 7 días
        db.Customers.Add(new Customer
        {
            Id = Guid.NewGuid(), TenantId = TenantId, Name = "Nuevo1",
            Phone = "300000001", PasswordHash = "x",
            CreatedAt = today.AddDays(-2)
        });
        // Cliente hace 20 días — fuera de 7 y 15 días, dentro de 30 días
        db.Customers.Add(new Customer
        {
            Id = Guid.NewGuid(), TenantId = TenantId, Name = "Nuevo2",
            Phone = "300000002", PasswordHash = "x",
            CreatedAt = today.AddDays(-20)
        });

        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task GetPeriodStats_7Days_ReturnsCorrectTotals()
    {
        var response = await _client.GetAsync("/api/dashboard/period-stats?days=7");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(2, body.GetProperty("totalAppointments").GetInt32());
        Assert.Equal(Price * 2, body.GetProperty("totalRevenue").GetDecimal());
        Assert.Equal(1, body.GetProperty("totalWalkIns").GetInt32());
        Assert.Equal(1, body.GetProperty("newCustomers").GetInt32());
    }

    [Fact]
    public async Task GetPeriodStats_30Days_IncludesOlderData()
    {
        var response = await _client.GetAsync("/api/dashboard/period-stats?days=30");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(3, body.GetProperty("totalAppointments").GetInt32());
        Assert.Equal(Price * 3, body.GetProperty("totalRevenue").GetDecimal());
        Assert.Equal(2, body.GetProperty("newCustomers").GetInt32());
    }

    [Fact]
    public async Task GetPeriodStats_InvalidDays_Returns400()
    {
        var response = await _client.GetAsync("/api/dashboard/period-stats?days=5");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
```

- [ ] **Step 4: Verificar que los tests no compilan aún**

```powershell
cd BarberBookSaaS.Tests
dotnet build
```

Esperado: error de compilación — `DashboardService` no implementa `GetPeriodStatsAsync` ni la nueva firma de `GetWeeklyRevenueAsync`.

---

## Task 2: Backend — Implementación del servicio y controlador

**Files:**
- Modify: `BarberBookSaaS.Infrastructure/Services/DashboardService.cs`
- Modify: `BarberBookSaaS.WebApi/Controllers/DashboardController.cs`

**Interfaces:**
- Consumes: `PeriodStatsDto`, `IDashboardService.GetPeriodStatsAsync`, `IDashboardService.GetWeeklyRevenueAsync(days)` (de Task 1)
- Produces: `GET /api/dashboard/period-stats?days=N` → `PeriodStatsDto`; `GET /api/dashboard/weekly-revenue?days=N` ahora acepta `days`

- [ ] **Step 1: Extender `GetWeeklyRevenueAsync` en `DashboardService.cs`**

Cambiar la firma y la lógica de `startDate` / loop en `GetWeeklyRevenueAsync`. El resto de la función permanece igual:

```csharp
public async Task<List<DailyRevenueDto>> GetWeeklyRevenueAsync(Guid? locationId = null, int days = 7)
{
    if (string.IsNullOrWhiteSpace(_tenantService.TenantId))
        throw new InvalidOperationException("TenantId not resolved for dashboard query.");

    var colombiaOffset = TimeSpan.FromHours(-5);
    var colombiaNow = DateTimeOffset.UtcNow.ToOffset(colombiaOffset).DateTime;
    var today = DateTime.SpecifyKind(colombiaNow.Date, DateTimeKind.Utc);
    var startDate = today.AddDays(-(days - 1));

    var revenueQuery = _context.Appointments
        .Include(a => a.Service)
        .Where(a => a.AppointmentDate >= startDate
                    && a.AppointmentDate < today.AddDays(1)
                    && a.Status == AppointmentStatus.Completed
                    && a.Service != null);

    if (locationId.HasValue)
        revenueQuery = revenueQuery.Where(a => a.LocationId == locationId.Value);

    var completedAppointments = await revenueQuery.ToListAsync();

    var revenueByDate = completedAppointments
        .GroupBy(a => a.AppointmentDate.Date)
        .ToDictionary(g => g.Key, g => new
        {
            Revenue = g.Sum(a => a.Service!.Price),
            Count = g.Count()
        });

    string[] dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

    var result = new List<DailyRevenueDto>();
    for (var i = -(days - 1); i <= 0; i++)
    {
        var date = today.AddDays(i);
        var dayOfWeek = (int)date.DayOfWeek;
        var dayName = dayNames[dayOfWeek == 0 ? 6 : dayOfWeek - 1];

        revenueByDate.TryGetValue(date, out var data);
        result.Add(new DailyRevenueDto
        {
            Day = dayName,
            Date = date.ToString("yyyy-MM-dd"),
            Revenue = data?.Revenue ?? 0,
            Appointments = data?.Count ?? 0
        });
    }

    return result;
}
```

- [ ] **Step 2: Implementar `GetPeriodStatsAsync` en `DashboardService.cs`**

Agregar el método al final de la clase, antes del cierre de `}`:

```csharp
public async Task<PeriodStatsDto> GetPeriodStatsAsync(int days, Guid? locationId = null)
{
    if (string.IsNullOrWhiteSpace(_tenantService.TenantId))
        throw new InvalidOperationException("TenantId not resolved for dashboard query.");

    var colombiaOffset = TimeSpan.FromHours(-5);
    var colombiaNow = DateTimeOffset.UtcNow.ToOffset(colombiaOffset).DateTime;
    var today = DateTime.SpecifyKind(colombiaNow.Date, DateTimeKind.Utc);
    var startDate = today.AddDays(-(days - 1));
    var endDate = today.AddDays(1);

    var appointmentsQuery = _context.Appointments
        .Include(a => a.Service)
        .Where(a => a.AppointmentDate >= startDate
                    && a.AppointmentDate < endDate
                    && a.Status != AppointmentStatus.Cancelled);

    if (locationId.HasValue)
        appointmentsQuery = appointmentsQuery.Where(a => a.LocationId == locationId.Value);

    var appointments = await appointmentsQuery.ToListAsync();

    var totalRevenue = appointments
        .Where(a => a.Status == AppointmentStatus.Completed && a.Service != null)
        .Sum(a => a.Service!.Price);

    var totalWalkIns = appointments.Count(a => a.IsWalkIn);

    var newCustomers = await _context.Customers
        .CountAsync(c => c.CreatedAt >= startDate && c.CreatedAt < endDate);

    return new PeriodStatsDto
    {
        TotalAppointments = appointments.Count,
        TotalRevenue      = totalRevenue,
        NewCustomers      = newCustomers,
        TotalWalkIns      = totalWalkIns
    };
}
```

- [ ] **Step 3: Actualizar `DashboardController.cs`**

Reemplazar el contenido completo del archivo:

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Domain.Constants;

namespace BarberBookSaaS.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = $"{UserRoles.Admin},{UserRoles.Barber}")]
public class DashboardController : ControllerBase
{
    private readonly IDashboardService _dashboardService;

    public DashboardController(IDashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats([FromQuery] Guid? locationId = null)
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        Guid? filterByUserId = null;
        if (role == UserRoles.Barber && Guid.TryParse(User.FindFirstValue("UserId"), out var uid))
            filterByUserId = uid;

        return Ok(await _dashboardService.GetStatsAsync(filterByUserId, locationId));
    }

    [HttpGet("weekly-revenue")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> GetWeeklyRevenue(
        [FromQuery] Guid? locationId = null,
        [FromQuery] int days = 7)
    {
        if (days != 7 && days != 15 && days != 30)
            return BadRequest("days must be 7, 15, or 30");

        return Ok(await _dashboardService.GetWeeklyRevenueAsync(locationId, days));
    }

    [HttpGet("period-stats")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> GetPeriodStats(
        [FromQuery] int days,
        [FromQuery] Guid? locationId = null)
    {
        if (days != 7 && days != 15 && days != 30)
            return BadRequest("days must be 7, 15, or 30");

        return Ok(await _dashboardService.GetPeriodStatsAsync(days, locationId));
    }
}
```

- [ ] **Step 4: Compilar el proyecto backend**

```powershell
cd BarberBookSaaS.WebApi
dotnet build
```

Esperado: `Build succeeded` sin errores.

- [ ] **Step 5: Correr los tests**

```powershell
cd BarberBookSaaS.Tests
dotnet test --verbosity normal
```

Esperado: los 3 tests nuevos en `DashboardPeriodStatsTests` pasan + los 48 existentes siguen pasando. Total: 51 tests.

- [ ] **Step 6: Commit**

```powershell
git add BarberBookSaaS.Application/DTOs/Dashboard/PeriodStatsDto.cs
git add BarberBookSaaS.Application/Common/IDashboardService.cs
git add BarberBookSaaS.Infrastructure/Services/DashboardService.cs
git add BarberBookSaaS.WebApi/Controllers/DashboardController.cs
git add BarberBookSaaS.Tests/DashboardPeriodStatsTests.cs
git commit -m "feat: endpoint period-stats y extensión days en weekly-revenue"
```

---

## Task 3: Frontend — `dashboardService.ts`

**Files:**
- Modify: `BarberBookSaaS.Web/src/features/dashboard/dashboardService.ts`

**Interfaces:**
- Produces: tipo `PeriodStats`; `dashboardService.getPeriodStats(days, locationId?)`; `dashboardService.getWeeklyRevenue(locationId?, days?)` ahora acepta `days`

- [ ] **Step 1: Reemplazar `dashboardService.ts` completo**

```typescript
import apiClient from "../../api/apiClient";

export interface DailyRevenue {
  day: string;
  date: string;
  revenue: number;
  appointments: number;
}

export interface DashboardStats {
  todayAppointments: number;
  todayRevenue: number;
  pendingAppointments: number;
  totalActiveBarbers: number;
  busiestBarber: { name: string; appointmentsToday: number } | null;
  upcomingAppointments: number;
  weekRevenue: number;
  todayWalkIns: number;
  totalWalkIns: number;
}

export interface PeriodStats {
  totalAppointments: number;
  totalRevenue: number;
  newCustomers: number;
  totalWalkIns: number;
}

export const dashboardService = {
  getStats: async (locationId?: string | null): Promise<DashboardStats> => {
    const response = await apiClient.get<DashboardStats>("/api/dashboard/stats", {
      params: locationId ? { locationId } : undefined,
    });
    return response.data;
  },

  getWeeklyRevenue: async (locationId?: string | null, days = 7): Promise<DailyRevenue[]> => {
    const params: Record<string, unknown> = { days };
    if (locationId) params.locationId = locationId;
    const response = await apiClient.get<DailyRevenue[]>("/api/dashboard/weekly-revenue", { params });
    return response.data;
  },

  getPeriodStats: async (days: number, locationId?: string | null): Promise<PeriodStats> => {
    const params: Record<string, unknown> = { days };
    if (locationId) params.locationId = locationId;
    const response = await apiClient.get<PeriodStats>("/api/dashboard/period-stats", { params });
    return response.data;
  },
};
```

- [ ] **Step 2: Verificar que TypeScript compila**

```powershell
cd BarberBookSaaS.Web
npx tsc --noEmit
```

Esperado: 0 errores.

- [ ] **Step 3: Commit**

```powershell
git add BarberBookSaaS.Web/src/features/dashboard/dashboardService.ts
git commit -m "feat: getPeriodStats y days param en getWeeklyRevenue"
```

---

## Task 4: Frontend — `Dashboard.tsx` y `WeeklyRevenueChart.tsx`

**Files:**
- Modify: `BarberBookSaaS.Web/src/features/dashboard/Dashboard.tsx`
- Modify: `BarberBookSaaS.Web/src/features/dashboard/WeeklyRevenueChart.tsx`

**Interfaces:**
- Consumes: `PeriodStats`, `dashboardService.getPeriodStats`, `dashboardService.getWeeklyRevenue(locationId, days)` (de Task 3)

- [ ] **Step 1: Actualizar `WeeklyRevenueChart.tsx`**

El cambio adapta el eje X para rangos largos (derivado de `data.length`) y corrige el mensaje vacío:

```tsx
import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DailyRevenue } from "./dashboardService";

const formatCOP = (value: number): string => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value}`;
};

const formatFullCOP = (value: number): string =>
  `$${value.toLocaleString("es-CO")}`;

const formatDate = (iso: string): string => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const formatShortDate = (iso: string): string => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ payload: DailyRevenue }>;
}> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 12,
        padding: "12px 16px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
      }}
    >
      <p style={{ color: "var(--color-text)", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
        {d.day} — {formatDate(d.date)}
      </p>
      <p style={{ color: "var(--color-primary)", fontSize: 14, fontWeight: 600 }}>
        {formatFullCOP(d.revenue)}
      </p>
      <p style={{ color: "var(--color-text-muted)", fontSize: 12, marginTop: 2 }}>
        {d.appointments} {d.appointments === 1 ? "cita completada" : "citas completadas"}
      </p>
    </div>
  );
};

interface WeeklyRevenueChartProps {
  data: DailyRevenue[];
}

export const WeeklyRevenueChart: React.FC<WeeklyRevenueChartProps> = ({ data }) => {
  const allZero = data.every((d) => d.revenue === 0);
  const maxRevenue = Math.max(...data.map((d) => d.revenue));
  const yDomain: [number, number] = allZero ? [0, 10] : [0, Math.ceil(maxRevenue * 1.15)];

  // Para rangos > 7 días, mostrar d/m en lugar del nombre del día
  const useDateLabel = data.length > 7;
  const chartData = data.map((d) => ({
    ...d,
    xLabel: useDateLabel ? formatShortDate(d.date) : d.day,
  }));

  // Mostrar ~7 ticks como máximo independiente del rango
  const tickInterval = Math.max(0, Math.floor(data.length / 7) - 1);

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            strokeOpacity={0.5}
            vertical={false}
          />
          <XAxis
            dataKey="xLabel"
            interval={tickInterval}
            tick={{ fill: "var(--color-text-muted)", fontSize: 12, fontWeight: 500 }}
            axisLine={{ stroke: "var(--color-border)" }}
            tickLine={false}
            dy={8}
          />
          <YAxis
            domain={yDomain}
            tickFormatter={formatCOP}
            tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="var(--color-primary)"
            strokeWidth={2.5}
            dot={(props: Record<string, unknown>) => {
              const { cx, cy, payload } = props as { cx: number; cy: number; payload: DailyRevenue };
              if (!payload || payload.revenue === 0) return <g key={`dot-${cx}-${cy}`} />;
              return (
                <circle
                  key={`dot-${cx}-${cy}`}
                  cx={cx}
                  cy={cy}
                  r={4}
                  fill="var(--color-primary)"
                  stroke="var(--color-surface)"
                  strokeWidth={2}
                />
              );
            }}
            activeDot={{
              r: 6,
              fill: "var(--color-primary)",
              stroke: "var(--color-surface)",
              strokeWidth: 2,
            }}
          />
        </LineChart>
      </ResponsiveContainer>
      {allZero && (
        <p
          style={{
            textAlign: "center",
            color: "var(--color-text-muted)",
            fontSize: 12,
            fontWeight: 500,
            marginTop: 8,
            opacity: 0.7,
          }}
        >
          Sin ingresos registrados en este período
        </p>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Actualizar `Dashboard.tsx` — agregar estado y selector**

En el bloque de imports, agregar `PeriodStats` al import de `dashboardService`:

```tsx
import type { DailyRevenue, DashboardStats, PeriodStats } from "./dashboardService";
```

En el componente `Dashboard`, reemplazar el estado existente de `weeklyRevenue` / `weeklyRevenueError` / `weeklyRevenueLoading` / `dashStats` añadiendo el nuevo estado. El bloque completo de estado queda:

```tsx
type TimeRange = 'today' | 7 | 15 | 30;

// ... (dentro del componente, junto a los useState existentes)
const [timeRange, setTimeRange]       = useState<TimeRange>('today');
const [periodStats, setPeriodStats]   = useState<PeriodStats | null>(null);
```

- [ ] **Step 3: Reemplazar el `useEffect` que carga revenue/stats**

Localizar el `useEffect` que actualmente tiene `[selectedLocationId]` como dependencia y reemplazarlo completo:

```tsx
useEffect(() => {
  setWeeklyRevenueLoading(true);
  setWeeklyRevenueError(false);
  setPeriodStats(null);

  if (timeRange === 'today') {
    Promise.all([
      dashboardService.getWeeklyRevenue(selectedLocationId, 7),
      dashboardService.getStats(selectedLocationId),
    ])
      .then(([revenue, stats]) => {
        setWeeklyRevenue(revenue);
        setDashStats(stats);
      })
      .catch(() => setWeeklyRevenueError(true))
      .finally(() => setWeeklyRevenueLoading(false));
  } else {
    Promise.all([
      dashboardService.getWeeklyRevenue(selectedLocationId, timeRange),
      dashboardService.getPeriodStats(timeRange, selectedLocationId),
    ])
      .then(([revenue, period]) => {
        setWeeklyRevenue(revenue);
        setPeriodStats(period);
      })
      .catch(() => setWeeklyRevenueError(true))
      .finally(() => setWeeklyRevenueLoading(false));
  }
}, [selectedLocationId, timeRange]);
```

- [ ] **Step 4: Agregar el selector de rango en el header del dashboard**

Localizar el bloque `{/* ── Page header ──────────────────────────────────────── */}` y reemplazar la `<div className="fade-up">` del header completo:

```tsx
{/* ── Page header ──────────────────────────────────────── */}
<div className="fade-up" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
  <div>
    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
      <div
        style={{
          width: 4,
          height: 32,
          borderRadius: 99,
          background: "linear-gradient(180deg, var(--color-primary), var(--color-secondary))",
          flexShrink: 0,
        }}
      />
      <h1
        style={{
          color: "var(--color-text)",
          fontSize: "30px",
          fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}
      >
        Resumen del negocio
      </h1>
    </div>
    <p
      style={{
        color: "var(--color-text-muted)",
        fontSize: "11px",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        marginLeft: "16px",
      }}
    >
      {dayLabel}
    </p>
  </div>

  {/* Selector de rango */}
  <div
    style={{
      display: "flex",
      gap: 4,
      background: "var(--color-glass-surface)",
      borderRadius: 10,
      padding: 4,
      border: "1px solid var(--color-glass-border)",
      flexShrink: 0,
    }}
  >
    {([ ['Hoy', 'today'], ['7 días', 7], ['15 días', 15], ['30 días', 30] ] as [string, TimeRange][]).map(([label, value]) => (
      <button
        key={label}
        onClick={() => setTimeRange(value)}
        style={{
          padding: "6px 14px",
          borderRadius: 7,
          border: "none",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 600,
          transition: "all 150ms ease",
          background: timeRange === value
            ? "var(--color-primary)"
            : "transparent",
          color: timeRange === value
            ? "var(--color-bg)"
            : "var(--color-text-muted)",
        }}
      >
        {label}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 5: Reemplazar la grilla de tarjetas**

Localizar el bloque `{/* ── Stat cards ─────────────────────────────── */}` que contiene el `loading ? (skeletons) : (<>...)`. Dentro del bloque `<>...</>` (cuando no está cargando), reemplazar el `<div className="stat-grid">` actual con la lógica condicional:

```tsx
{/* ── Stat cards ───────────────────────────────────────── */}
{loading && timeRange === 'today' ? (
  <div className="stat-grid">
    {[0, 70, 140, 210, 280].map(d => <StatSkeleton key={d} delay={d} />)}
  </div>
) : weeklyRevenueLoading && timeRange !== 'today' ? (
  <div className="stat-grid">
    {[0, 70, 140, 210].map(d => <StatSkeleton key={d} delay={d} />)}
  </div>
) : timeRange === 'today' ? (
  <>
    {/* ── MODO HOY: grilla original ─────────────────── */}
    <div className="stat-grid">
      <StatCard
        label="Citas de hoy"
        value={todayAll.length}
        icon={<CalendarDays size={22} />}
        sub={`${todayComplete.length} complet. · ${todayPending.length} pend.`}
        variant="primary"
        delay={0}
      />
      <StatCard
        label="Pendientes"
        value={todayPending.length}
        icon={<Clock size={22} />}
        sub="Por atender hoy"
        variant="amber"
        delay={70}
      />
      <StatCard
        label="Barberos activos"
        value={displayedBarbers.length}
        icon={<Users size={22} />}
        sub={displayedBarbers.length === 1 ? "profesional" : "profesionales"}
        variant="violet"
        delay={140}
      />
      <StatCard
        label="Ingresos hoy"
        value={`$${revenueToday.toLocaleString("es-CO")}`}
        icon={<DollarSign size={22} />}
        sub={revenuePend > 0 ? `+ $${revenuePend.toLocaleString("es-CO")} potencial` : "confirmados"}
        variant="green"
        delay={210}
      />
      <StatCard
        label="Clientes registrados"
        value={totalCustomers ?? "—"}
        icon={<UserCheck size={22} />}
        sub="en tu barbería"
        variant="sky"
        delay={280}
      />
      {/* Tarjeta walk-in (diseño especial) */}
      <div
        className="fade-up stat-card-compact walkin-card"
        style={{
          borderRadius: "20px",
          background: "rgba(168,85,247,0.08)",
          border: "1px solid rgba(168,85,247,0.18)",
          boxShadow: "0 0 28px rgba(168,85,247,0.05)",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
          padding: "28px",
          overflow: "hidden",
          animationDelay: "350ms",
        }}
      >
        <div
          className="stat-icon rounded-xl flex items-center justify-center shrink-0"
          style={{ width: 50, height: 50, background: "rgba(168,85,247,0.18)", color: "#a855f7" }}
        >
          <UserPlus size={22} />
        </div>
        <div>
          <p
            className="stat-label"
            style={{
              color: "rgba(168,85,247,0.75)",
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: "10px",
            }}
          >
            Clientes sin cita
          </p>
          <div className="walkin-card-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className="walkin-card-half" style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <p className="stat-number" style={{ color: "var(--color-text)", fontSize: "44px", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {dashStats?.todayWalkIns ?? 0}
              </p>
              <p style={{ color: "var(--color-text-muted)", fontSize: "13px", fontWeight: 500 }}>hoy</p>
            </div>
            <div className="walkin-card-divider" style={{ height: 1, background: "rgba(168,85,247,0.18)" }} />
            <div className="walkin-card-half" style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <p style={{ color: "var(--color-text)", fontSize: "22px", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {dashStats?.totalWalkIns ?? 0}
              </p>
              <p style={{ color: "var(--color-text-muted)", fontSize: "13px", fontWeight: 500 }}>total</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
) : (
  <>
    {/* ── MODO PERÍODO: 4 tarjetas de totales ──────── */}
    <div className="stat-grid">
      <StatCard
        label="Citas del período"
        value={periodStats?.totalAppointments ?? 0}
        icon={<CalendarDays size={22} />}
        sub="no canceladas"
        variant="primary"
        delay={0}
      />
      <StatCard
        label="Ingresos totales"
        value={`$${(periodStats?.totalRevenue ?? 0).toLocaleString("es-CO")}`}
        icon={<DollarSign size={22} />}
        sub="citas completadas"
        variant="green"
        delay={70}
      />
      <StatCard
        label="Clientes nuevos"
        value={periodStats?.newCustomers ?? 0}
        icon={<UserCheck size={22} />}
        sub="registrados en el período"
        variant="sky"
        delay={140}
      />
      <StatCard
        label="Clientes sin cita"
        value={periodStats?.totalWalkIns ?? 0}
        icon={<UserPlus size={22} />}
        sub="walk-ins en el período"
        variant="violet"
        delay={210}
      />
    </div>
  </>
)}
```

- [ ] **Step 6: Actualizar el título de la gráfica y ocultar listas en modo período**

Localizar la sección `{/* ── Weekly revenue chart ─── */}` y actualizar solo el texto del `<h2>`:

```tsx
<h2
  style={{
    color: "var(--color-text)",
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: "-0.02em",
  }}
>
  {timeRange === 'today'
    ? "Ingresos de los últimos 7 días"
    : `Ingresos de los últimos ${timeRange} días`}
</h2>
```

Localizar las secciones `{/* ── Today's appointments ── */}`, `{/* ── Upcoming ── */}`, y `{/* ── Onboarding empty state ── */}` y envolverlas en una condición para que solo aparezcan en modo "Hoy":

```tsx
{timeRange === 'today' && (
  <>
    {/* ── Today's appointments ─────────────────────────── */}
    <SectionCard title="Citas de hoy" count={todayAll.length} delay={280} right={
      <button onClick={() => navigate("/appointments")} style={{
        fontSize: 12, fontWeight: 600, color: "var(--color-primary)", background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 6, transition: "opacity 150ms",
      }} onMouseEnter={e => (e.currentTarget.style.opacity = "0.7")} onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
        Ver todas →
      </button>
    }>
      {todayAll.length === 0 ? (
        <EmptyRow
          icon={<CalendarDays size={18} />}
          text="Sin citas para hoy"
        />
      ) : (
        <div>
          {todayAll.map((a, idx) => (
            <AppointmentRow key={a.id} appointment={a} last={idx === todayAll.length - 1} />
          ))}
        </div>
      )}
    </SectionCard>

    {upcoming.length > 0 && (
      <SectionCard title="Próximas citas" count={upcoming.length} delay={340}>
        <div>
          {upcoming.map((a, idx) => (
            <AppointmentRow key={a.id} appointment={a} last={idx === upcoming.length - 1} showDate />
          ))}
        </div>
      </SectionCard>
    )}

    {todayAppts.length === 0 && barbers.length === 0 && (
      <div
        className="fade-up"
        style={{
          borderRadius: "20px",
          padding: "64px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          border: "1px dashed var(--color-glass-border)",
          background: "var(--color-glass-surface)",
          animationDelay: "400ms",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "color-mix(in srgb, var(--color-primary) 14%, transparent)",
            color: "var(--color-primary)",
            marginBottom: "16px",
          }}
        >
          <Scissors size={20} />
        </div>
        <p
          style={{
            color: "var(--color-text)",
            fontSize: "20px",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            marginBottom: "8px",
          }}
        >
          Tu barbería está lista.
        </p>
        <p style={{ color: "var(--color-text-muted)", fontSize: "12px", maxWidth: 320 }}>
          Agrega barberos, configura sus horarios y comienza a agendar citas.
        </p>
      </div>
    )}
  </>
)}
```

La sección de Reseñas (`{/* ── Reviews ── */}`) permanece fuera de esta condición — se muestra en todos los modos.

- [ ] **Step 7: Verificar TypeScript**

```powershell
cd BarberBookSaaS.Web
npx tsc --noEmit
```

Esperado: 0 errores.

- [ ] **Step 8: Verificar en el navegador**

1. Iniciar backend: `cd BarberBookSaaS.WebApi && dotnet run`
2. Iniciar frontend: `cd BarberBookSaaS.Web && npm run dev`
3. Abrir `http://localhost:5173` → login como Admin
4. Verificar que el dashboard muestra las pills "Hoy / 7 días / 15 días / 30 días" en el encabezado
5. Clic en "7 días" → las 6 tarjetas se reemplazan por 4 tarjetas de período, la gráfica cambia a 7 puntos y el título dice "Ingresos de los últimos 7 días"
6. Clic en "30 días" → la gráfica muestra 30 puntos con etiquetas d/m, 4 tarjetas muestran totales del mes
7. Volver a "Hoy" → vista original restaurada con "Citas de hoy", listas de citas y gráfica de 7 días

- [ ] **Step 9: Commit final**

```powershell
git add BarberBookSaaS.Web/src/features/dashboard/dashboardService.ts
git add BarberBookSaaS.Web/src/features/dashboard/Dashboard.tsx
git add BarberBookSaaS.Web/src/features/dashboard/WeeklyRevenueChart.tsx
git commit -m "feat: selector de rango de tiempo en dashboard (Hoy / 7 / 15 / 30 días)"
```
