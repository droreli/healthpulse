import { useEffect, useState } from "react";
import MetricCard from "../components/MetricCard";
import TrendLine from "../components/charts/TrendLine";
import SyncIndicator from "../components/SyncIndicator";
import TimeRangeSelector from "../components/TimeRangeSelector";
import { useHealthData } from "../hooks/useHealthData";
import { useTimeRange } from "../hooks/useTimeRange";
import type { DashboardPayload } from "../lib/contracts";

export default function Dashboard() {
  const range = useTimeRange((state) => state.range);
  const { data, loading, error } = useHealthData<DashboardPayload>(`/api/dashboard?range=${range}`);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedCardId) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedCardId(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [selectedCardId]);

  if (loading) {
    return <div className="text-text-secondary">Loading dashboard…</div>;
  }

  if (error || !data) {
    return <div className="text-red-300">Failed to load dashboard: {error}</div>;
  }

  const selectedCard = selectedCardId ? data.cards.find((card) => card.id === selectedCardId) ?? null : null;

  return (
    <>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-text-secondary">Today</p>
            <h2 className="mt-2 text-4xl font-semibold text-white">Health dashboard</h2>
            <p className="mt-2 max-w-2xl text-text-secondary">
              Deterministic health signals from your Apple Health exports. No narrative layer, no cloud dependency.
            </p>
          </div>
          <TimeRangeSelector />
        </div>

        <SyncIndicator sync={data.sync} />

        {data.sync.mode === "apple_xml_manual" ? (
          <section className="rounded-[28px] border border-white/10 bg-white/5 p-5">
            <p className="text-sm uppercase tracking-[0.22em] text-text-secondary">Import</p>
            <p className="mt-2 text-sm text-text-secondary">
              Manual Apple Health import now lives in Onboarding so the dashboard stays focused on signals.
            </p>
          </section>
        ) : null}

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {data.cards.map((card) => (
            <MetricCard key={card.id} card={card} onSelect={() => setSelectedCardId(card.id)} />
          ))}
        </section>

        {data.sync.issues.length > 0 ? (
          <section className="rounded-[28px] border border-amber-300/20 bg-amber-400/5 p-6">
            <h3 className="text-lg font-medium text-white">Sync notes</h3>
            <ul className="mt-3 space-y-2 text-sm text-text-secondary">
              {data.sync.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {selectedCard ? <DashboardCardModal card={selectedCard} onClose={() => setSelectedCardId(null)} /> : null}
    </>
  );
}

function DashboardCardModal({
  card,
  onClose
}: {
  card: DashboardPayload["cards"][number];
  onClose: () => void;
}) {
  const config = dashboardCardConfig(card.id);
  const recentPoints = card.sparkline.slice(-6).reverse();

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[32px] border border-white/10 bg-[#141417] p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-text-secondary">{card.title}</p>
            <h3 className="mt-3 text-4xl font-semibold text-white">{card.primary}</h3>
            <p className="mt-2 max-w-2xl text-sm text-text-secondary">{config.description}</p>
          </div>
          <button
            type="button"
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-text-secondary transition hover:border-white/20 hover:text-white"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <DetailTile label="Latest reading" value={card.primary} />
          <DetailTile label="Reference" value={card.secondary} />
          <DetailTile label="Trend" value={`${card.deltaLabel} ${card.deltaBasis}`} />
        </div>

        <div className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-text-secondary">Trend detail</p>
              <p className="mt-2 text-sm text-text-secondary">Hover any point to inspect the exact reading for that date.</p>
            </div>
          </div>
          <div className="mt-6 h-72">
            <TrendLine
              data={card.sparkline.map((point) => ({ date: point.date, value: point.value }))}
              lines={[{ key: "value", color: card.accent, name: card.title, valueFormatter: config.valueFormatter }]}
              axes={[{ id: "left", tickFormatter: config.axisFormatter }]}
            />
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
            <p className="text-sm uppercase tracking-[0.18em] text-text-secondary">Interpretation</p>
            <p className="mt-3 text-base leading-7 text-white">{config.interpretation}</p>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
            <p className="text-sm uppercase tracking-[0.18em] text-text-secondary">Recent exact values</p>
            <div className="mt-4 space-y-3">
              {recentPoints.map((point) => (
                <div key={point.date} className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3 text-sm">
                  <span className="text-text-secondary">{formatCalendarDate(point.date)}</span>
                  <span className="font-medium text-white">{config.valueFormatter(point.value)}</span>
                </div>
              ))}
            </div>
          </div>
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

function dashboardCardConfig(cardId: string) {
  switch (cardId) {
    case "sleep":
      return {
        description: "Nightly sleep duration across the selected range. The dashboard surfaces the latest completed night and compares it against the prior window.",
        interpretation: "Use this trend to spot sleep compression, rebound nights, and whether the latest night is part of a wider drift or just a one-off dip.",
        valueFormatter: (value: number) => `${value.toFixed(1)}h`,
        axisFormatter: (value: number) => `${value.toFixed(0)}h`
      };
    case "hrv":
      return {
        description: "Heart-rate variability is shown as the actual daily HRV reading in milliseconds. Lower or higher is interpreted relative to your own prior baseline.",
        interpretation: "The hover values now come from daily averages instead of summed readings, which fixes the inflated numbers you were seeing before.",
        valueFormatter: (value: number) => `${value.toFixed(1)} ms`,
        axisFormatter: (value: number) => `${value.toFixed(0)}`
      };
    case "resting-hr":
      return {
        description: "Resting heart rate tracks the latest resting reading and compares it against the prior range. Lower is generally better when sleep and training are stable.",
        interpretation: "If this rises while HRV falls, that usually means recovery is taking more strain than usual.",
        valueFormatter: (value: number) => `${value.toFixed(1)} bpm`,
        axisFormatter: (value: number) => `${value.toFixed(0)}`
      };
    case "vo2":
      return {
        description: "VO2 Max is plotted from Apple Health’s recorded aerobic fitness values in mL/min·kg.",
        interpretation: "Treat this as a slowly moving fitness marker, not a day-to-day readiness signal.",
        valueFormatter: (value: number) => `${value.toFixed(1)} mL/min·kg`,
        axisFormatter: (value: number) => `${value.toFixed(0)}`
      };
    case "steps":
      return {
        description: "Daily step counts across the selected range.",
        interpretation: "This is useful as a simple activity baseline and helps explain whether low-workout days were still active or mostly sedentary.",
        valueFormatter: (value: number) => Math.round(value).toLocaleString(),
        axisFormatter: (value: number) => `${Math.round(value / 1000)}k`
      };
    case "workouts":
      return {
        description: "Workout count per day across the selected range.",
        interpretation: "This chart shows frequency, not load quality. Use the workouts page for distance, zone split, and session-level drilldowns.",
        valueFormatter: (value: number) => `${Math.round(value)} workout${Math.round(value) === 1 ? "" : "s"}`,
        axisFormatter: (value: number) => `${Math.round(value)}`
      };
    default:
      return {
        description: "Trend detail for the selected metric.",
        interpretation: "Use the exact hover values to inspect specific dates.",
        valueFormatter: (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 }),
        axisFormatter: (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 0 })
      };
  }
}

function formatCalendarDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(new Date(`${value}T00:00:00Z`));
}
