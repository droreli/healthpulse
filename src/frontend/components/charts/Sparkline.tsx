import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDateLabel } from "../../lib/format";

export default function Sparkline({
  data,
  color,
  valueFormatter,
  labelFormatter
}: {
  data: Array<{ date: string; value: number }>;
  color: string;
  valueFormatter?: (value: number) => string;
  labelFormatter?: (value: string) => string;
}) {
  if (data.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-text-secondary">No trend yet</div>;
  }

  const values = data.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.2, max === min ? Math.max(Math.abs(max) * 0.05, 1) : 0);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <XAxis dataKey="date" hide />
        <YAxis hide domain={[min - padding, max + padding]} />
        <Tooltip
          content={<SparklineTooltip valueFormatter={valueFormatter} labelFormatter={labelFormatter ?? formatDateLabel} />}
          cursor={{ stroke: color, strokeWidth: 1, strokeOpacity: 0.2 }}
          allowEscapeViewBox={{ x: true, y: true }}
          reverseDirection={{ x: true, y: false }}
          offset={12}
          wrapperStyle={{ pointerEvents: "none", zIndex: 20 }}
        />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function SparklineTooltip({
  active,
  payload,
  label,
  valueFormatter,
  labelFormatter
}: {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: { date?: string } }>;
  label?: string | number;
  valueFormatter?: (value: number) => string;
  labelFormatter: (value: string) => string;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const value = payload[0]?.value;
  const dateLabel = typeof label === "string" ? label : payload[0]?.payload?.date;
  if (typeof value !== "number" || !Number.isFinite(value) || typeof dateLabel !== "string") {
    return null;
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#1c1c1e] px-3 py-2 text-xs text-white shadow-xl">
      <div className="mb-1 uppercase tracking-[0.18em] text-text-secondary">{labelFormatter(dateLabel)}</div>
      <div>{valueFormatter ? valueFormatter(value) : value.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
    </div>
  );
}
