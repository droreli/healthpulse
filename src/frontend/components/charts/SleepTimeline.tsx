import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDateLabel } from "../../lib/format";

export default function SleepTimeline({
  data
}: {
  data: Array<{
    date: string;
    core_minutes: number | null;
    deep_minutes: number | null;
    rem_minutes: number | null;
    total_minutes: number | null;
  }>;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tickFormatter={formatDateLabel} stroke="#8E8E93" />
        <YAxis stroke="#8E8E93" tickFormatter={(value) => `${Math.round(Number(value) / 60)}h`} />
        <Tooltip content={<SleepTooltip />} />
        <Bar dataKey="core_minutes" stackId="sleep" fill="#5E5CE6" radius={0} />
        <Bar dataKey="deep_minutes" stackId="sleep" fill="#3C3AFF" />
        <Bar dataKey="rem_minutes" stackId="sleep" fill="#A972FF" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function SleepTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey?: string; value?: number }>; label?: string }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const byKey = new Map(payload.map((entry) => [entry.dataKey, entry.value ?? 0]));
  const core = Number(byKey.get("core_minutes") ?? 0);
  const deep = Number(byKey.get("deep_minutes") ?? 0);
  const rem = Number(byKey.get("rem_minutes") ?? 0);
  const total = core + deep + rem;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#1c1c1e] px-4 py-3 text-sm text-white shadow-xl">
      <div className="mb-2 text-xs uppercase tracking-[0.18em] text-text-secondary">{label}</div>
      <div className="space-y-1 text-text-secondary">
        <div>Core: {formatMinutes(core)}</div>
        <div>Deep: {formatMinutes(deep)}</div>
        <div>REM: {formatMinutes(rem)}</div>
        <div className="pt-1 text-white">Total asleep: {formatMinutes(total)}</div>
      </div>
    </div>
  );
}

function formatMinutes(value: number): string {
  return `${Math.round(value)}m`;
}
