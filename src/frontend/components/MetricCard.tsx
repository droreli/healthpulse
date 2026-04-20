import type { DashboardCardPayload } from "../../server/types";
import { trendColors } from "../lib/colors";
import Sparkline from "./charts/Sparkline";

export default function MetricCard({
  card,
  onSelect
}: {
  card: DashboardCardPayload;
  onSelect?: (card: DashboardCardPayload) => void;
}) {
  const formatValue = sparklineValueFormatter(card.id);

  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-text-secondary">{card.title}</p>
          <h3 className="mt-3 text-3xl font-semibold text-white">{card.primary}</h3>
          <p className="mt-2 text-sm text-text-secondary">{card.secondary}</p>
        </div>
        <div
          className="rounded-full px-3 py-1 text-xs font-medium"
          style={{
            backgroundColor: `${trendColors[card.trend]}22`,
            color: trendColors[card.trend]
          }}
        >
          {card.deltaLabel}
        </div>
      </div>

      <div className="mt-6 h-20">
        <Sparkline data={card.sparkline} color={card.accent} valueFormatter={formatValue} />
      </div>

      <p className="mt-4 text-xs uppercase tracking-[0.18em] text-text-secondary">{card.deltaBasis}</p>
    </>
  );

  if (!onSelect) {
    return <article className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-panel">{content}</article>;
  }

  return (
    <button
      type="button"
      className="rounded-[28px] border border-white/10 bg-white/5 p-5 text-left shadow-panel transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]"
      onClick={() => onSelect(card)}
    >
      {content}
    </button>
  );
}

function sparklineValueFormatter(cardId: string) {
  switch (cardId) {
    case "sleep":
      return (value: number) => `${value.toFixed(1)}h`;
    case "hrv":
      return (value: number) => `${value.toFixed(1)} ms`;
    case "resting-hr":
      return (value: number) => `${value.toFixed(1)} bpm`;
    case "vo2":
      return (value: number) => `${value.toFixed(1)} mL/min·kg`;
    case "steps":
      return (value: number) => Math.round(value).toLocaleString();
    case "workouts":
      return (value: number) => `${Math.round(value)} workout${Math.round(value) === 1 ? "" : "s"}`;
    default:
      return (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }
}
