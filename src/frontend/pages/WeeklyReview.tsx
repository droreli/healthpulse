import { useEffect, useState } from "react";
import TrendLine from "../components/charts/TrendLine";
import { useHealthData } from "../hooks/useHealthData";
import type { WeeklyReviewPayload } from "../lib/contracts";
import { formatHours, formatHoursFromMinutes, formatPercent } from "../lib/format";

export default function WeeklyReview() {
  const { data, loading, error } = useHealthData<WeeklyReviewPayload>("/api/weekly-review");
  const [sleepModalOpen, setSleepModalOpen] = useState(false);

  useEffect(() => {
    if (!sleepModalOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSleepModalOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sleepModalOpen]);

  if (loading) return <div className="text-text-secondary">Loading weekly review…</div>;
  if (error || !data) return <div className="text-red-300">Failed to load weekly review: {error}</div>;

  const hasSleepScore = data.sleep.sleepMetricSource === "score" && data.sleep.avgSleepScore !== null;
  const sleepMetricLabel = hasSleepScore ? data.sleep.sleepMetricLabel : "Sleep score unavailable";
  const trainingChartDays = data.training.days.map((day) => ({
    ...day,
    runningKm: day.runningKm ?? 0
  }));

  return (
    <>
      <div className="space-y-8">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-text-secondary">Sunday review</p>
          <h2 className="mt-2 text-4xl font-semibold text-white">Week {data.week}</h2>
          <p className="mt-2 max-w-3xl text-text-secondary">
            Deterministic summary of recovery, sleep, and training with the underlying weekly traces visible instead of hidden behind text summaries.
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <HighlightCard
            eyebrow="Recovery"
            title={data.recovery.hrvAverage !== null ? `${data.recovery.hrvAverage.toFixed(1)} ms HRV` : "Recovery data missing"}
            detail={`Resting HR ${data.recovery.restingHrAverage !== null ? `${data.recovery.restingHrAverage.toFixed(1)} bpm` : "—"}`}
            tone={toneForTrend(data.recovery.hrvTrend.deltaPct)}
            summary={`HRV ${trendLabel(data.recovery.hrvTrend.deltaPct)} vs prior week`}
          />
          <HighlightCard
            eyebrow="Sleep"
            title={formatHours(data.sleep.avgDuration)}
            detail={hasSleepScore ? `${sleepMetricLabel} ${formatScore(data.sleep.avgSleepScore)}` : sleepMetricLabel}
            tone={hasSleepScore ? toneForThreshold(data.sleep.avgSleepScore, 85) : "border-white/10 bg-white/5"}
            summary={`Bedtime consistency ${data.sleep.bedtimeConsistencyMinutes !== null ? `${formatHoursFromMinutes(data.sleep.bedtimeConsistencyMinutes)} σ` : "—"}`}
          />
          <HighlightCard
            eyebrow="Training"
            title={`${data.training.sessions} sessions`}
            detail={data.training.runningKm !== null ? `${data.training.runningKm.toFixed(1)} km running` : "Running distance unavailable"}
            tone={toneForTrend(data.training.runningTrend.deltaPct)}
            summary={`Zone 2 ${formatPercent(data.training.zone2Pct)}`}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <Section title="Recovery trend">
            <div className="h-72">
              <TrendLine
                data={data.recovery.days}
                lines={[
                  { key: "hrv", color: "#64D2FF", name: "HRV", yAxisId: "hrv", valueFormatter: (value) => `${value.toFixed(1)} ms` },
                  { key: "restingHr", color: "#FF453A", name: "Resting HR", yAxisId: "rhr", valueFormatter: (value) => `${value.toFixed(1)} bpm` }
                ]}
                axes={[
                  { id: "hrv", orientation: "left", tickFormatter: (value) => `${value.toFixed(0)}` },
                  { id: "rhr", orientation: "right", tickFormatter: (value) => `${value.toFixed(0)}` }
                ]}
                curveType="linear"
              />
            </div>
          </Section>

          <button
            type="button"
            className="rounded-[28px] border border-white/10 bg-white/5 p-6 text-left transition hover:border-white/20 hover:bg-white/[0.07]"
            onClick={() => setSleepModalOpen(true)}
          >
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-medium text-white">Sleep pattern</h3>
              <span className="text-sm text-text-secondary">Click to expand</span>
            </div>
            <div className="mt-4 h-72">
              <TrendLine
                data={data.sleep.nights}
                lines={
                  hasSleepScore
                    ? [
                        { key: "duration", color: "#A972FF", name: "Sleep", yAxisId: "hours", valueFormatter: (value) => `${value.toFixed(1)}h` },
                        { key: "sleepScore", color: "#64D2FF", name: sleepMetricLabel, yAxisId: "score", valueFormatter: formatScore }
                      ]
                    : [{ key: "duration", color: "#A972FF", name: "Sleep", yAxisId: "hours", valueFormatter: (value) => `${value.toFixed(1)}h` }]
                }
                axes={
                  hasSleepScore
                    ? [
                        { id: "hours", orientation: "left", tickFormatter: (value) => `${value.toFixed(0)}h`, domain: [0, "dataMax + 1"] },
                        { id: "score", orientation: "right", tickFormatter: (value) => `${value.toFixed(0)}`, domain: [0, 100] }
                      ]
                    : [{ id: "hours", orientation: "left", tickFormatter: (value) => `${value.toFixed(0)}h`, domain: [0, "dataMax + 1"] }]
                }
                curveType="linear"
              />
            </div>
          </button>

          <Section title="Training rhythm">
            <div className="h-72">
              <TrendLine
                data={trainingChartDays}
                lines={[
                  { key: "runningKm", color: "#FF375F", name: "Running km", yAxisId: "km", valueFormatter: (value) => `${value.toFixed(2)} km` },
                  { key: "sessions", color: "#30D158", name: "Sessions", yAxisId: "sessions", valueFormatter: (value) => `${Math.round(value)} session${Math.round(value) === 1 ? "" : "s"}` }
                ]}
                axes={[
                  { id: "km", orientation: "left", tickFormatter: (value) => `${value.toFixed(0)} km`, domain: [0, "dataMax + 1"] },
                  { id: "sessions", orientation: "right", tickFormatter: (value) => `${value.toFixed(0)}`, domain: [0, "dataMax + 1"] }
                ]}
                curveType="linear"
              />
            </div>
          </Section>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.2fr,0.8fr]">
          <Section title="Night-by-night sleep mix">
            <div className="space-y-3">
              {data.sleep.nights.map((night) => (
                <div key={night.date} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm text-text-secondary">{formatPrettyDate(night.date)}</p>
                      <p className="mt-2 text-xl font-medium text-white">{formatHours(night.duration)}</p>
                    </div>
                    <div className={`grid gap-3 text-sm ${hasSleepScore ? "grid-cols-3 lg:min-w-[380px]" : "grid-cols-2 lg:min-w-[260px]"}`}>
                      {hasSleepScore ? (
                        <SleepMetric label={data.sleep.sleepMetricLabel} value={formatScore(night.sleepScore)} color="rgba(100,210,255,0.18)" />
                      ) : null}
                      <SleepMetric label="Deep" value={formatPercent(night.deepPct)} color="rgba(60,58,255,0.18)" />
                      <SleepMetric label="REM" value={formatPercent(night.remPct)} color="rgba(169,114,255,0.18)" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Evidence-backed insights">
            <div className="space-y-4">
              {data.insights.map((insight) => (
                <div key={insight.title} className={`rounded-2xl border p-4 ${insightTone(insight.status)}`}>
                  <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">{insight.title}</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{insight.value}</p>
                  <p className="mt-2 text-sm text-text-secondary">{insight.detail}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <Section title="This week's takeaway">
          <div className="grid gap-4 md:grid-cols-2">
            <TakeawayCard label="What improved" value={data.takeaway.improved} />
            <TakeawayCard label="What declined" value={data.takeaway.declined} />
            <TakeawayCard label="Likely cause" value={data.takeaway.likelyCause} />
            <TakeawayCard label="One change for next week" value={data.takeaway.nextAction} />
          </div>
        </Section>
      </div>

      {sleepModalOpen ? (
        <SleepPatternModal data={data} hasSleepScore={hasSleepScore} onClose={() => setSleepModalOpen(false)} />
      ) : null}
    </>
  );
}

function Section({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
      <h3 className="text-lg font-medium text-white">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function HighlightCard({
  eyebrow,
  title,
  detail,
  summary,
  tone
}: {
  eyebrow: string;
  title: string;
  detail: string;
  summary: string;
  tone: string;
}) {
  return (
    <div className={`rounded-[28px] border p-5 shadow-panel ${tone}`}>
      <p className="text-sm uppercase tracking-[0.22em] text-text-secondary">{eyebrow}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{title}</p>
      <p className="mt-2 text-base text-white/80">{detail}</p>
      <p className="mt-4 text-sm text-text-secondary">{summary}</p>
    </div>
  );
}

function SleepMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl p-3" style={{ backgroundColor: color }}>
      <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">{label}</p>
      <p className="mt-2 text-lg font-medium text-white">{value}</p>
    </div>
  );
}

function TakeawayCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/20 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">{label}</p>
      <p className="mt-3 text-base leading-7 text-white">{value}</p>
    </div>
  );
}

function trendLabel(value: number | null) {
  if (value === null) {
    return "—";
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function toneForTrend(value: number | null) {
  if (value === null) {
    return "border-white/10 bg-white/5";
  }

  return value >= 0 ? "border-emerald-400/20 bg-emerald-400/10" : "border-rose-400/20 bg-rose-400/10";
}

function toneForThreshold(value: number | null, target: number) {
  if (value === null) {
    return "border-white/10 bg-white/5";
  }

  return value >= target ? "border-emerald-400/20 bg-emerald-400/10" : "border-amber-300/20 bg-amber-400/10";
}

function insightTone(status: "pass" | "warn" | "neutral") {
  switch (status) {
    case "pass":
      return "border-emerald-400/20 bg-emerald-400/10";
    case "warn":
      return "border-amber-300/20 bg-amber-400/10";
    default:
      return "border-white/10 bg-white/5";
  }
}

function formatPrettyDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatScore(value: number | null | undefined) {
  return typeof value === "number" ? `${Math.round(value)}` : "—";
}

function SleepPatternModal({
  data,
  hasSleepScore,
  onClose
}: {
  data: WeeklyReviewPayload;
  hasSleepScore: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[32px] border border-white/10 bg-[#141417] p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-text-secondary">Sleep pattern</p>
            <h3 className="mt-3 text-4xl font-semibold text-white">Weekly sleep detail</h3>
            <p className="mt-2 max-w-2xl text-sm text-text-secondary">
              {hasSleepScore
                ? "The expanded view combines sleep duration with the real nightly sleep score imported for each date."
                : "No nightly sleep-score metric is present in the current imported data, so this expanded view shows duration plus the stage mix only."}
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-text-secondary transition hover:border-white/20 hover:text-white"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-5">
          <div className="h-80">
            <TrendLine
              data={data.sleep.nights}
              lines={
                hasSleepScore
                  ? [
                      { key: "duration", color: "#A972FF", name: "Sleep", yAxisId: "hours", valueFormatter: (value) => `${value.toFixed(1)}h` },
                      { key: "sleepScore", color: "#64D2FF", name: data.sleep.sleepMetricLabel, yAxisId: "score", valueFormatter: formatScore }
                    ]
                  : [{ key: "duration", color: "#A972FF", name: "Sleep", yAxisId: "hours", valueFormatter: (value) => `${value.toFixed(1)}h` }]
              }
              axes={
                hasSleepScore
                  ? [
                      { id: "hours", orientation: "left", tickFormatter: (value) => `${value.toFixed(0)}h`, domain: [0, "dataMax + 1"] },
                      { id: "score", orientation: "right", tickFormatter: (value) => `${value.toFixed(0)}`, domain: [0, 100] }
                    ]
                  : [{ id: "hours", orientation: "left", tickFormatter: (value) => `${value.toFixed(0)}h`, domain: [0, "dataMax + 1"] }]
              }
              curveType="linear"
            />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailTile label="Average duration" value={formatHours(data.sleep.avgDuration)} />
          <DetailTile label="Sleep score" value={hasSleepScore ? formatScore(data.sleep.avgSleepScore) : "Unavailable"} />
          <DetailTile
            label="Bedtime consistency"
            value={data.sleep.bedtimeConsistencyMinutes !== null ? `${formatHoursFromMinutes(data.sleep.bedtimeConsistencyMinutes)} σ` : "—"}
          />
          <DetailTile label="Deep / REM" value={`${formatPercent(data.sleep.deepPct)} / ${formatPercent(data.sleep.remPct)}`} />
        </div>

        <div className="mt-6 space-y-3">
          {data.sleep.nights.map((night) => (
            <div key={night.date} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm text-text-secondary">{formatPrettyDate(night.date)}</p>
                  <p className="mt-2 text-xl font-medium text-white">{formatHours(night.duration)}</p>
                </div>
                <div className={`grid gap-3 text-sm ${hasSleepScore ? "grid-cols-3 lg:min-w-[420px]" : "grid-cols-2 lg:min-w-[280px]"}`}>
                  {hasSleepScore ? (
                    <SleepMetric label={data.sleep.sleepMetricLabel} value={formatScore(night.sleepScore)} color="rgba(100,210,255,0.18)" />
                  ) : null}
                  <SleepMetric label="Deep" value={formatPercent(night.deepPct)} color="rgba(60,58,255,0.18)" />
                  <SleepMetric label="REM" value={formatPercent(night.remPct)} color="rgba(169,114,255,0.18)" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">{label}</p>
      <p className="mt-3 text-lg font-medium text-white">{value}</p>
    </div>
  );
}
