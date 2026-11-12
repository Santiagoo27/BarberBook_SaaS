# Conteo y registro métrico de clientes sin cita

**Fecha:** 2026-06-27
**Jira:** Tarea 7

## Problema

Los clientes que llegan sin cita (walk-in) se registran como citas normales sin forma de distinguirlos. Esto impide contabilizarlos en métricas y analytics.

## Solución

### 1. Base de datos

- Agregar `bool IsWalkIn` (default `false`) a `Appointment`
- Migración EF Core: `AddIsWalkInToAppointments`
- Citas históricas quedan como `false`

### 2. Backend

- `Appointment.cs`: nueva propiedad `public bool IsWalkIn { get; set; }`
- `AppointmentService.CreateWalkInAsync`: setear `IsWalkIn = true`
- `DashboardStatsDto`: agregar `int TodayWalkIns` e `int TotalWalkIns`
- `DashboardService.GetStatsAsync`: calcular ambas métricas filtrando `IsWalkIn == true` y `Status != Cancelled`

### 3. Frontend — Tarjeta dashboard

Una tarjeta en `Dashboard.tsx` con división **horizontal**:

```
┌──────────────────────────┐
│   Clientes sin cita      │
├──────────────────────────┤
│   Hoy: 3                 │
├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
│   Total: 47              │
└──────────────────────────┘
```

- Título arriba, línea horizontal entre las dos mitades
- Responsive-friendly (se apila naturalmente)

### 4. Frontend — Badge en listas de citas

Badge compacto **"Sin cita"** junto al nombre del cliente en:
- `Dashboard.tsx` (citas de hoy y próximas)
- `AppointmentManagement.tsx` (tabla/agenda de citas admin)
- `BarberDashboard.tsx` (lista de citas del barbero)

### 5. Frontend — Tipo TypeScript

Agregar `isWalkIn?: boolean` a la interfaz `Appointment` en `appointmentTypes.ts`.

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `Domain/Entities/Appointment.cs` | Agregar `IsWalkIn` |
| `Infrastructure/Services/AppointmentService.cs` | Setear `IsWalkIn = true` en walk-in |
| `Application/DTOs/Dashboard/DashboardStatsDto.cs` | Agregar métricas walk-in |
| `Infrastructure/Services/DashboardService.cs` | Calcular métricas walk-in |
| `Web/src/features/appointments/appointmentTypes.ts` | Agregar `isWalkIn` al tipo |
| `Web/src/features/dashboard/dashboardService.ts` | Agregar tipo stats |
| `Web/src/features/dashboard/Dashboard.tsx` | Tarjeta + badge |
| `Web/src/features/appointments/AppointmentManagement.tsx` | Badge |
| `Web/src/features/barbers/BarberDashboard.tsx` | Badge |