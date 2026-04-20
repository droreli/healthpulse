import type Database from "better-sqlite3";
import { format, subDays } from "date-fns";
import type { AppConfig } from "../server/config.js";
import { getSyncStatus } from "./sync-status.js";
import { getWorkoutsPayload } from "./workouts.js";
import { listAnnotations } from "./annotations.js";
import type { TimeRange } from "../server/types.js";

const WORKBENCH_LOOKBACK_DAYS = 90;

export interface WorkbenchPayload {
  generatedAt: string;
  sync: ReturnType<typeof getSyncStatus>;
  sleep: Array<{
    date: string;
    total: number | null;
    rem: number | null;
    deep: number | null;
    core: number | null;
    awake: number | null;
    bedtime: string | null;
    waketime: string | null;
  }>;
  hrv: Array<{ date: string; value: number | null }>;
  rhr: Array<{ date: string; value: number | null }>;
  vo2: Array<{ date: string; value: number | null }>;
  steps: Array<{ date: string; value: number | null }>;
  workouts: Array<{
    id: string;
    date: string;
    start: string;
    end: string;
    type: string;
    distance_km: number | null;
    duration_min: number | null;
    pace: number | null;
    avgHR: number | null;
    maxHR: number | null;
    zones: number[];
    splits: Array<{ index: number; pace: number; hr: number | null }>;
    cadence: number | null;
    inferredSplits: boolean;
    heartRateData: Array<{ date: string; Avg?: number; Min?: number; Max?: number }>;
  }>;
  annotations: ReturnType<typeof listAnnotations>;
}

export function getWorkbenchPayload(db: Database.Database, config: AppConfig): WorkbenchPayload {
  const startDate = format(subDays(new Date(), WORKBENCH_LOOKBACK_DAYS - 1), "yyyy-MM-dd");
  const workoutsPayload = getWorkoutsPayload(db, config, "90d" as TimeRange);

  return {
    generatedAt: new Date().toISOString(),
    sync: getSyncStatus(db, config),
    sleep: loadSleep(db, startDate),
    hrv: loadMetricSeries(db, "heart_rate_variability", startDate),
    rhr: loadMetricSeries(db, "resting_heart_rate", startDate),
    vo2: loadMetricSeries(db, "vo2_max", startDate),
    steps: loadStepsSeries(db, startDate),
    workouts: workoutsPayload.workouts.map(mapWorkoutRecord),
    annotations: listAnnotations(db)
  };
}

function loadSleep(db: Database.Database, startDate: string) {
  return db.prepare(
    `
      SELECT
        date,
        total_sleep_hours,
        rem_hours,
        deep_hours,
        core_hours,
        awake_minutes,
        sleep_start,
        sleep_end
      FROM sleep_sessions
      WHERE date >= ?
      ORDER BY date
    `
  ).all(startDate).map((row) => {
    const session = row as {
      date: string;
      total_sleep_hours: number | null;
      rem_hours: number | null;
      deep_hours: number | null;
      core_hours: number | null;
      awake_minutes: number | null;
      sleep_start: string | null;
      sleep_end: string | null;
    };

    return {
      date: session.date,
      total: numberOrNull(session.total_sleep_hours),
      rem: numberOrNull(session.rem_hours),
      deep: numberOrNull(session.deep_hours),
      core: numberOrNull(session.core_hours),
      awake: session.awake_minutes !== null ? Number((session.awake_minutes / 60).toFixed(2)) : null,
      bedtime: session.sleep_start,
      waketime: session.sleep_end
    };
  });
}

function loadMetricSeries(db: Database.Database, metricName: string, startDate: string) {
  return db.prepare(
    `
      SELECT date, avg_value AS value
      FROM daily_aggregates
      WHERE metric_name = ? AND date >= ?
      ORDER BY date
    `
  ).all(metricName, startDate).map((row) => {
    const point = row as { date: string; value: number | null };
    return {
      date: point.date,
      value: numberOrNull(point.value)
    };
  });
}

function loadStepsSeries(db: Database.Database, startDate: string) {
  return db.prepare(
    `
      SELECT date, sum_value AS value
      FROM daily_aggregates
      WHERE metric_name = 'step_count' AND date >= ?
      ORDER BY date
    `
  ).all(startDate).map((row) => {
    const point = row as { date: string; value: number | null };
    return {
      date: point.date,
      value: point.value !== null ? Math.round(point.value) : null
    };
  });
}

function mapWorkoutRecord(workout: Record<string, unknown>) {
  const distanceKm = numberOrNull(workout.distance_km);
  const durationMin = secondsToMinutes(numberOrNull(workout.duration_seconds));
  const pace = numberOrNull(workout.avg_pace_min_per_km);
  const avgHR = numberOrNull(workout.avg_heart_rate);
  const maxHR = numberOrNull(workout.max_heart_rate);
  const heartRateData = parseHeartRateSeries(workout.heart_rate_data);

  return {
    id:
      stringOrNull(workout.hae_id) ??
      stringOrNull(workout.dedup_key) ??
      `${stringOrNull(workout.workout_type) ?? "workout"}-${stringOrNull(workout.start_time) ?? "unknown"}`,
    date: stringOrNull(workout.start_time)?.slice(0, 10) ?? "",
    start: stringOrNull(workout.start_time) ?? "",
    end: stringOrNull(workout.end_time) ?? "",
    type: stringOrNull(workout.workout_type) ?? "Workout",
    distance_km: distanceKm,
    duration_min: durationMin,
    pace,
    avgHR,
    maxHR,
    zones: [
      secondsToMinutes(numberOrNull(workout.zone1_seconds)) ?? 0,
      secondsToMinutes(numberOrNull(workout.zone2_seconds)) ?? 0,
      secondsToMinutes(numberOrNull(workout.zone3_seconds)) ?? 0,
      secondsToMinutes(numberOrNull(workout.zone4_seconds)) ?? 0,
      secondsToMinutes(numberOrNull(workout.zone5_seconds)) ?? 0
    ],
    splits: deriveSplits(distanceKm, durationMin, pace, avgHR, maxHR, heartRateData),
    cadence: null,
    inferredSplits: true,
    heartRateData
  };
}

function parseHeartRateSeries(value: unknown): Array<{ date: string; Avg?: number; Min?: number; Max?: number }> {
  const raw = Array.isArray(value) ? value : safeJsonArray(value);
  return raw.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || typeof (entry as { date?: unknown }).date !== "string") {
      return [];
    }

    const point = entry as { date: string; Avg?: unknown; Min?: unknown; Max?: unknown };
    return [
      {
        date: point.date,
        Avg: numberOrNull(point.Avg) ?? undefined,
        Min: numberOrNull(point.Min) ?? undefined,
        Max: numberOrNull(point.Max) ?? undefined
      }
    ];
  });
}

function deriveSplits(
  distanceKm: number | null,
  durationMin: number | null,
  pace: number | null,
  avgHR: number | null,
  maxHR: number | null,
  heartRateData: Array<{ date: string; Avg?: number; Min?: number; Max?: number }>
) {
  if (!distanceKm || !durationMin || !pace) {
    return [];
  }

  const splitCount = Math.max(1, Math.round(distanceKm));
  const hrSeries = heartRateData
    .map((point) => numberOrNull(point.Avg ?? point.Max ?? point.Min))
    .filter((value): value is number => value !== null);
  const segmentHeartRates =
    hrSeries.length > 0
      ? Array.from({ length: splitCount }, (_, index) => {
          const start = Math.floor((index * hrSeries.length) / splitCount);
          const end = Math.floor(((index + 1) * hrSeries.length) / splitCount);
          const segment = hrSeries.slice(start, Math.max(start + 1, end));
          return segment.length > 0 ? average(segment) : null;
        })
      : [];
  const fallbackHeartRates = buildFallbackHeartRates(splitCount, avgHR, maxHR);
  const splitHeartRates = Array.from({ length: splitCount }, (_, index) => segmentHeartRates[index] ?? fallbackHeartRates[index] ?? null);
  const resolvedHeartRates = splitHeartRates.filter((value): value is number => value !== null);
  const averageHeartRate = average(resolvedHeartRates);
  const minResolvedHeartRate = resolvedHeartRates.length > 0 ? Math.min(...resolvedHeartRates) : averageHeartRate ?? 0;
  const heartRateSpread = Math.max(6, (maxHR ?? averageHeartRate ?? minResolvedHeartRate) - minResolvedHeartRate);
  const paceAdjustments = splitHeartRates.map((value, index) => {
    const hrSignal =
      value !== null && averageHeartRate !== null
        ? clampNumber((value - averageHeartRate) / heartRateSpread, -1, 1)
        : 0;
    const progression = splitCount === 1 ? 0 : (index / (splitCount - 1) - 0.5) * 0.1;
    return clampNumber(progression - hrSignal * 0.14, -0.18, 0.18);
  });
  const averageAdjustment = average(paceAdjustments) ?? 0;

  return Array.from({ length: splitCount }, (_, index) => {
    const normalizedAdjustment = paceAdjustments[index] - averageAdjustment;
    const splitPace = Math.max(3, Number((pace * (1 + normalizedAdjustment)).toFixed(2)));
    return {
      index: index + 1,
      pace: splitPace,
      hr: splitHeartRates[index] !== null ? Math.round(splitHeartRates[index] ?? 0) : null
    };
  });
}

function buildFallbackHeartRates(splitCount: number, avgHR: number | null, maxHR: number | null) {
  if (avgHR === null) {
    return Array.from({ length: splitCount }, () => null);
  }

  const upper = maxHR ?? avgHR + 10;
  const range = Math.max(4, upper - avgHR);
  return Array.from({ length: splitCount }, (_, index) => {
    const progress = splitCount === 1 ? 0 : index / (splitCount - 1);
    const wave = Math.sin(progress * Math.PI * 1.4) * 0.35;
    return avgHR + range * ((progress - 0.5) * 0.28 + wave * 0.18);
  });
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function safeJsonArray(value: unknown): unknown[] {
  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function secondsToMinutes(value: number | null): number | null {
  return value !== null ? Number((value / 60).toFixed(1)) : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
