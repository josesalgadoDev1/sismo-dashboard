"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface TrendData {
  fecha: string;
  cantidad: number;
  max_magnitud: number;
  normal?: number;
  advertencia?: number;
  alerta?: number;
  alarma?: number;
}

interface TrendChartProps {
  data: TrendData[];
}

const ALERT_COLORS = {
  normal: "#10b981",
  advertencia: "#eab308",
  alerta: "#f97316",
  alarma: "#ef4444",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        background: "var(--panel-bg, #1a2332)",
        border: "1px solid var(--card-border, rgba(255,255,255,0.1))",
        borderRadius: "8px",
        padding: "10px 14px",
        fontSize: "0.78rem",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        color: "var(--foreground, #f0f2f5)",
      }}
    >
      <p style={{ color: "var(--text-muted, #94a3b8)", marginBottom: "6px", fontWeight: 600 }}>
        {label}
      </p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color, margin: "2px 0" }}>
          {entry.name}: <strong>{entry.value}</strong>
        </p>
      ))}
    </div>
  );
};

export default function TrendChart({ data }: TrendChartProps) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        cantidad: Number(d.cantidad),
        max_magnitud: Number(d.max_magnitud),
        normal: Number(d.normal || 0),
        advertencia: Number(d.advertencia || 0),
        alerta: Number(d.alerta || 0),
        alarma: Number(d.alarma || 0),
      })),
    [data]
  );

  // Check if we have alert breakdown data
  const hasBreakdown = chartData.some(
    (d) => d.normal > 0 || d.advertencia > 0 || d.alerta > 0 || d.alarma > 0
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={chartData}
        margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(128,128,128,0.15)"
          vertical={false}
        />
        <XAxis
          dataKey="fecha"
          tick={{ fill: "var(--text-muted, #64748b)", fontSize: 11 }}
          axisLine={{ stroke: "rgba(128,128,128,0.2)" }}
          tickLine={false}
        />
        <YAxis
          yAxisId="left"
          tick={{ fill: "var(--text-muted, #64748b)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          label={{
            value: "Cantidad",
            angle: -90,
            position: "insideLeft",
            fill: "var(--text-muted, #64748b)",
            fontSize: 10,
            offset: 15,
          }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fill: "var(--text-muted, #64748b)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          domain={[0, "dataMax + 1"]}
          label={{
            value: "Magnitud",
            angle: 90,
            position: "insideRight",
            fill: "var(--text-muted, #64748b)",
            fontSize: 10,
            offset: 15,
          }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: "0.72rem", color: "var(--text-muted, #94a3b8)" }}
          iconType="circle"
          iconSize={8}
        />
        {hasBreakdown ? (
          <>
            <Bar yAxisId="left" dataKey="normal" name="Normal" stackId="alerts" fill={ALERT_COLORS.normal} barSize={30} />
            <Bar yAxisId="left" dataKey="advertencia" name="Advertencia" stackId="alerts" fill={ALERT_COLORS.advertencia} barSize={30} />
            <Bar yAxisId="left" dataKey="alerta" name="Alerta" stackId="alerts" fill={ALERT_COLORS.alerta} barSize={30} />
            <Bar yAxisId="left" dataKey="alarma" name="Alarma" stackId="alerts" fill={ALERT_COLORS.alarma} radius={[4, 4, 0, 0]} barSize={30} />
          </>
        ) : (
          <Bar
            yAxisId="left"
            dataKey="cantidad"
            name="Eventos"
            fill="rgba(59, 130, 246, 0.5)"
            stroke="rgba(59, 130, 246, 0.8)"
            strokeWidth={1}
            radius={[4, 4, 0, 0]}
            barSize={30}
          />
        )}
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="max_magnitud"
          name="Mag. Máxima"
          stroke="#f97316"
          strokeWidth={2.5}
          dot={{
            fill: "#f97316",
            stroke: "var(--panel-bg, #1a2332)",
            strokeWidth: 2,
            r: 5,
          }}
          activeDot={{
            fill: "#f97316",
            stroke: "#fff",
            strokeWidth: 2,
            r: 7,
          }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
