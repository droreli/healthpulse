import type { TrendDirection } from "../server/types.js";

export interface TrendSummary {
  trend: TrendDirection;
  delta: number;
  deltaPct: number | null;
}

export function computeTrend(current: number | null, baseline: number | null, preferLower = false): TrendSummary {
  if (current === null || baseline === null) {
    return { trend: "flat", delta: 0, deltaPct: null };
  }

  const delta = round(current - baseline, 2);
  const deltaPct = baseline !== 0 ? round((delta / baseline) * 100, 1) : null;
  const directionalDelta = preferLower ? -delta : delta;

  if (Math.abs(directionalDelta) < 0.01) {
    return { trend: "flat", delta, deltaPct };
  }

  return {
    trend: directionalDelta > 0 ? "up" : "down",
    delta,
    deltaPct
  };
}

function round(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}
