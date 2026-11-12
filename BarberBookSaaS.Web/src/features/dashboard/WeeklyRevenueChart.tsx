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
