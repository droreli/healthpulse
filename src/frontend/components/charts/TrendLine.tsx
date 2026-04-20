import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatDateLabel } from "../../lib/format";

export default function TrendLine({
  data,
  lines,
  axes,
  xTickFormatter,
  tooltipLabelFormatter,
  curveType = "monotone"
}: {
  data: Array<Record<string, unknown>>;
  lines: Array<{
    key: string;
    color: string;
    name: string;
    yAxisId?: string;
    valueFormatter?: (value: number) => string;
    strokeWidth?: number;
  }>;
  axes?: Array<{
    id: string;
    orientation?: "left" | "right";
    width?: number;
    tickFormatter?: (value: number) => string;
    domain?: [number | string, number | string];
  }>;
  xTickFormatter?: (value: string) => string;
  tooltipLabelFormatter?: (value: string) => string;
  curveType?: "monotone" | "linear";
}) {
  const resolvedAxes = axes && axes.length > 0 ? axes : [{ id: "left" as const, orientation: "left" as const, width: 40 }];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tickFormatter={(value) => (typeof value === "string" ? (xTickFormatter ?? formatDateLabel)(value) : "")} stroke="#8E8E93" />
        {resolvedAxes.map((axis) => (
          <YAxis
            key={axis.id}
            yAxisId={axis.id}
            orientation={axis.orientation ?? "left"}
            stroke="#8E8E93"
            width={axis.width ?? 40}
            tickFormatter={axis.tickFormatter}
            domain={axis.domain}
          />
        ))}
        <Tooltip
          content={<TrendLineTooltip lines={lines} labelFormatter={tooltipLabelFormatter ?? formatDateLabel} />}
          cursor={{ stroke: "rgba(255,255,255,0.2)", strokeWidth: 1 }}
          allowEscapeViewBox={{ x: true, y: true }}
          reverseDirection={{ x: true, y: false }}
          offset={12}
          wrapperStyle={{ pointerEvents: "none", zIndex: 20 }}
        />
        {lines.map((line) => (
          <Line
            key={line.key}
            type={curveType}
            dataKey={line.key}
            stroke={line.color}
            strokeWidth={line.strokeWidth ?? 2.5}
            dot={false}
            name={line.name}
            yAxisId={line.yAxisId ?? resolvedAxes[0]?.id}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function TrendLineTooltip({
  active,
  payload,
  label,
  lines,
  labelFormatter
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number; name?: string; payload?: { date?: string } }>;
  label?: string | number;
  lines: Array<{ key: string; valueFormatter?: (value: number) => string }>;
  labelFormatter: (value: string) => string;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const dateLabel = typeof label === "string" ? label : payload[0]?.payload?.date;
  const formatters = new Map(lines.map((line) => [line.key, line.valueFormatter]));
  const points = payload
    .filter((entry) => typeof entry.value === "number" && Number.isFinite(entry.value))
    .map((entry) => ({
      label: entry.name ?? entry.dataKey ?? "Value",
      value: entry.value as number,
      formattedValue:
        typeof entry.dataKey === "string" && formatters.get(entry.dataKey)
          ? formatters.get(entry.dataKey)!(entry.value as number)
          : (entry.value as number).toLocaleString(undefined, { maximumFractionDigits: 1 })
    }));

  if (typeof dateLabel !== "string" || points.length === 0) {
    return null;
  }

  return (
    <div className="min-w-40 rounded-2xl border border-white/10 bg-[#1c1c1e] px-4 py-3 text-sm text-white shadow-xl">
      <div className="mb-2 text-xs uppercase tracking-[0.18em] text-text-secondary">{labelFormatter(dateLabel)}</div>
      <div className="space-y-1">
        {points.map((point) => (
          <div key={point.label} className="flex items-center justify-between gap-4 text-text-secondary">
            <span>{point.label}</span>
            <span className="font-medium text-white">{point.formattedValue}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
