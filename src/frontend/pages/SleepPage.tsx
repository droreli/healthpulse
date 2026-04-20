import SleepTimeline from "../components/charts/SleepTimeline";
import TrendLine from "../components/charts/TrendLine";
import TimeRangeSelector from "../components/TimeRangeSelector";
import { useHealthData } from "../hooks/useHealthData";
import { useTimeRange } from "../hooks/useTimeRange";
import type { SleepPayload } from "../lib/contracts";
import { formatMinutes, formatHours, formatHoursFromMinutes, formatPercent } from "../lib/format";

export default function SleepPage() {
  const range = useTimeRange((state) => state.range);
  const { data, loading, error } = useHealthData<SleepPayload>(`/api/sleep?range=${range}`);

  if (loading) return <div className="text-text-secondary">Loading sleep analytics…</div>;
  if (error || !data) return <div className="text-red-300">Failed to load sleep analytics: {error}</div>;

  const hasSleepScore = data.summary.sleepMetricSource === "score" && data.summary.avgSleepScore !== null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-text-secondary">Sleep</p>
          <h2 className="mt-2 text-4xl font-semibold text-white">Night structure and consistency</h2>
        </div>
        <TimeRangeSelector />
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <StatCard label="Avg duration" value={formatHours(data.summary.avgDuration)} detail="Across selected range" />
        <StatCard
          label={data.summary.sleepMetricLabel}
          value={hasSleepScore ? formatScore(data.summary.avgSleepScore) : "Unavailable"}
          detail={
            hasSleepScore
              ? "Using the real nightly score imported from your data."
              : "No sleep-score metric is present in the imported Apple Health data for this user."
          }
        />
        <StatCard
          label="Bedtime consistency"
          value={data.summary.bedtimeConsistencyMinutes !== null ? `${formatHoursFromMinutes(data.summary.bedtimeConsistencyMinutes)} σ` : "—"}
          detail="Lower is better"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr,1fr]">
        <Panel title="Stage timeline">
          <div className="h-80">
            <SleepTimeline
              data={data.sessions.map((session) => ({
                date: session.date,
                core_minutes: session.core_minutes,
                deep_minutes: session.deep_minutes,
                rem_minutes: session.rem_minutes,
                total_minutes: session.in_bed_minutes
              }))}
            />
          </div>
        </Panel>
        <Panel title={hasSleepScore ? "Duration and sleep score" : "Duration trend"}>
          <div className="h-80">
            <TrendLine
              data={data.sessions}
              lines={
                hasSleepScore
                  ? [
                      { key: "total_sleep_hours", color: "#A972FF", name: "Sleep", yAxisId: "hours", valueFormatter: formatHours },
                      { key: "sleep_score", color: "#64D2FF", name: "Sleep score", yAxisId: "score", valueFormatter: formatScore }
                    ]
                  : [{ key: "total_sleep_hours", color: "#A972FF", name: "Sleep", yAxisId: "hours", valueFormatter: formatHours }]
              }
              axes={
                hasSleepScore
                  ? [
                      { id: "hours", orientation: "left", tickFormatter: (value) => `${value.toFixed(0)}h`, domain: [0, "dataMax + 1"] },
                      { id: "score", orientation: "right", tickFormatter: (value) => `${value.toFixed(0)}`, domain: [0, 100] }
                    ]
                  : [{ id: "hours", orientation: "left", tickFormatter: (value) => `${value.toFixed(0)}h`, domain: [0, "dataMax + 1"] }]
              }
            />
          </div>
          <p className="mt-4 text-sm text-text-secondary">
            {hasSleepScore
              ? "This view is using the nightly sleep score imported for each date."
              : "The current imported Apple Health data does not contain a nightly sleep-score metric, so only raw duration is shown here."}
          </p>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Stage percentages">
          <div className="space-y-3 text-sm text-text-secondary">
            {data.sessions.slice(-10).reverse().map((session) => (
              <div key={session.date} className="rounded-2xl bg-white/5 p-4">
                <div className="flex justify-between text-white">
                  <span>{session.date}</span>
                  <span>{formatHours(session.total_sleep_hours)}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <StageChip label="Core" value={session.core_pct} minutes={session.core_minutes} color="#5E5CE6" />
                  <StageChip label="Deep" value={session.deep_pct} minutes={session.deep_minutes} color="#3C3AFF" />
                  <StageChip label="REM" value={session.rem_pct} minutes={session.rem_minutes} color="#A972FF" />
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Benchmarks">
          <div className="space-y-4 text-sm text-text-secondary">
            <BenchmarkRow label="Deep sleep" target={data.benchmarks.deepPct} />
            <BenchmarkRow label="REM sleep" target={data.benchmarks.remPct} />
            <BenchmarkRow label="Sleep efficiency" target={data.benchmarks.sleepEfficiency} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
      <h3 className="text-lg font-medium text-white">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
      <p className="text-sm uppercase tracking-[0.22em] text-text-secondary">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-text-secondary">{detail}</p>
    </div>
  );
}

function StageChip({
  label,
  value,
  minutes,
  color
}: {
  label: string;
  value: number | null;
  minutes: number | null;
  color: string;
}) {
  return (
    <div className="rounded-2xl p-3" style={{ backgroundColor: `${color}20` }}>
      <div className="text-xs uppercase tracking-[0.18em] text-text-secondary">{label}</div>
      <div className="mt-2 text-lg font-medium text-white">{formatPercent(value)}</div>
      <div className="mt-1 text-xs text-text-secondary">{minutes !== null ? formatMinutes(minutes) : "—"}</div>
    </div>
  );
}

function BenchmarkRow({ label, target }: { label: string; target: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
      <span>{label}</span>
      <span className="font-medium text-white">{target}</span>
    </div>
  );
}

function formatScore(value: number | null | undefined) {
  return typeof value === "number" ? `${Math.round(value)}` : "—";
}
