const MIN_BASELINE_DAYS = 10;
const HRV_STDDEV_FLOOR = 1.0;
const RHR_STDDEV_FLOOR = 0.5;

export interface RecoveryInput {
  hrv: number | null;
  hrvBaseline14d: number | null;
  hrvStdDev14d: number | null;
  hrvSampleCount: number;
  restingHR: number | null;
  rhrBaseline14d: number | null;
  rhrStdDev14d: number | null;
  rhrSampleCount: number;
  sleepEfficiency: number | null;
  sleepDurationHours: number | null;
  sleepGoalHours: number;
}

export interface RecoveryResult {
  score: number;
  label: string;
  color: string;
  basis: string;
  degraded: boolean;
  degradedNote?: string;
}

export function calculateRecoveryScore(data: RecoveryInput): RecoveryResult {
  const hasHRVBaseline =
    data.hrvSampleCount >= MIN_BASELINE_DAYS &&
    data.hrv !== null &&
    data.hrvBaseline14d !== null &&
    data.hrvStdDev14d !== null;
  const hasRHRBaseline =
    data.rhrSampleCount >= MIN_BASELINE_DAYS &&
    data.restingHR !== null &&
    data.rhrBaseline14d !== null &&
    data.rhrStdDev14d !== null;
  const hasSleep = data.sleepEfficiency !== null && data.sleepDurationHours !== null;

  if (!hasHRVBaseline && !hasRHRBaseline) {
    const needed = Math.max(0, MIN_BASELINE_DAYS - Math.max(data.hrvSampleCount, data.rhrSampleCount));
    return {
      score: -1,
      label: "Building Baseline",
      color: "#8E8E93",
      basis: `Need ${needed} more days of heart data to compute recovery score.`,
      degraded: true,
      degradedNote: "Insufficient baseline data"
    };
  }

  let totalWeight = 0;
  let weightedSum = 0;
  const parts: string[] = [];

  if (hasHRVBaseline) {
    const stdDev = Math.max(data.hrvStdDev14d!, HRV_STDDEV_FLOOR);
    const hrvZ = (data.hrv! - data.hrvBaseline14d!) / stdDev;
    const hrvScore = clamp(50 + hrvZ * 25, 0, 100);
    const weight = hasSleep ? 0.4 : hasRHRBaseline ? 0.57 : 1.0;
    weightedSum += hrvScore * weight;
    totalWeight += weight;
    parts.push(`HRV ${data.hrv}ms vs ${data.hrvBaseline14d}ms baseline`);
  }

  if (hasRHRBaseline) {
    const stdDev = Math.max(data.rhrStdDev14d!, RHR_STDDEV_FLOOR);
    const rhrZ = (data.restingHR! - data.rhrBaseline14d!) / stdDev;
    const rhrScore = clamp(50 - rhrZ * 25, 0, 100);
    const weight = hasSleep ? 0.3 : hasHRVBaseline ? 0.43 : 1.0;
    weightedSum += rhrScore * weight;
    totalWeight += weight;
    parts.push(`Resting HR ${data.restingHR} vs ${data.rhrBaseline14d} baseline`);
  }

  if (hasSleep) {
    const sleepEffScore = clamp(data.sleepEfficiency!, 0, 100);
    const sleepDurScore = clamp((data.sleepDurationHours! / data.sleepGoalHours) * 100, 0, 100);
    weightedSum += sleepEffScore * 0.2;
    weightedSum += sleepDurScore * 0.1;
    totalWeight += 0.3;
    parts.push(`Sleep ${data.sleepEfficiency}% efficiency and ${data.sleepDurationHours}h duration`);
  }

  const score = Math.round(weightedSum / totalWeight);
  const missing = [
    !hasHRVBaseline ? "HRV" : null,
    !hasRHRBaseline ? "Resting HR" : null,
    !hasSleep ? "Sleep" : null
  ].filter((item): item is string => Boolean(item));
  const degraded = missing.length > 0;

  if (score >= 80) {
    return {
      score,
      label: "Recovered",
      color: "#30D158",
      basis: `${parts.join(". ")}.`,
      degraded,
      degradedNote: degraded ? `Missing: ${missing.join(", ")}.` : undefined
    };
  }

  if (score >= 60) {
    return {
      score,
      label: "Moderate",
      color: "#FF9F0A",
      basis: `${parts.join(". ")}.`,
      degraded,
      degradedNote: degraded ? `Missing: ${missing.join(", ")}.` : undefined
    };
  }

  return {
    score,
    label: "Fatigued",
    color: "#FF453A",
    basis: `${parts.join(". ")}.`,
    degraded,
    degradedNote: degraded ? `Missing: ${missing.join(", ")}.` : undefined
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
