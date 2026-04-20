import type Database from "better-sqlite3";
import { addDays, addWeeks, format, startOfWeek, subDays } from "date-fns";
import { rangeDays } from "../server/dates.js";
import type { AppConfig } from "../server/config.js";
import type { TimeRange } from "../server/types.js";
import { computeHRZones } from "../ingester/zones.js";

export function getWorkoutsPayload(db: Database.Database, config: AppConfig, range: TimeRange) {
  const lookbackDays = rangeDays(range);
  const rangeDate = format(subDays(new Date(), lookbackDays - 1), "yyyy-MM-dd");
  const workouts = db.prepare(`
    SELECT *
    FROM workouts
    WHERE substr(start_time, 1, 10) >= ?
    ORDER BY start_time DESC
  `).all(rangeDate) as Array<Record<string, unknown>>;

  const heatmap = db.prepare(`
    SELECT substr(start_time, 1, 10) as date, COUNT(*) as count
    FROM workouts
    WHERE substr(start_time, 1, 10) >= ?
    GROUP BY substr(start_time, 1, 10)
    ORDER BY date
  `).all(rangeDate) as Array<{ date: string; count: number }>;

  const hydratedWorkouts = workouts.map((workout) => hydrateWorkout(db, workout, config));
  const weeklyByStart = new Map<string, number>();

  for (const workout of hydratedWorkouts) {
    if (!isRunningWorkout(workout)) {
      continue;
    }

    const startTime = typeof workout.start_time === "string" ? workout.start_time : null;
    const distanceKm = numberOrNull(workout.distance_km);
    if (!startTime || distanceKm === null) {
      continue;
    }

    const weekStart = format(startOfWeek(new Date(startTime), { weekStartsOn: 1 }), "yyyy-MM-dd");
    weeklyByStart.set(weekStart, Number(((weeklyByStart.get(weekStart) ?? 0) + distanceKm).toFixed(2)));
  }

  const startWeek = startOfWeek(subDays(new Date(), lookbackDays - 1), { weekStartsOn: 1 });
  const endWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weeklySeries = [];

  for (let current = startWeek; current <= endWeek; current = addWeeks(current, 1)) {
    const weekStart = format(current, "yyyy-MM-dd");
    const weekEnd = format(addDays(current, 6), "yyyy-MM-dd");
    weeklySeries.push({
      date: weekStart,
      weekStart,
      weekEnd,
      label: `${formatMonthDay(weekStart)} - ${formatMonthDay(weekEnd)}`,
      totalKm: weeklyByStart.get(weekStart) ?? 0
    });
  }

  return {
    range,
    workouts: hydratedWorkouts,
    heatmap,
    weeklyRunning: weeklySeries
  };
}

function hydrateWorkout(db: Database.Database, workout: Record<string, unknown>, config: AppConfig): Record<string, unknown> {
  const heartRateData = safeJsonArray(workout.heart_rate_data);
  const durationSeconds = numberOrNull(workout.duration_seconds);
  const startTime = typeof workout.start_time === "string" ? workout.start_time : null;
  const endTime = typeof workout.end_time === "string" ? workout.end_time : null;
  const distanceMetrics = deriveDistanceMetrics(db, workout);

  if (heartRateData.length > 0) {
    const zones = computeHRZones(heartRateData as Array<{ date?: string; Avg?: number }>, config.max_heart_rate, {
      restingHeartRate: startTime ? restingHeartRateForWorkout(db, startTime) : null,
      zone2LowerPct: config.zone2_lower_pct,
      zone2UpperPct: config.zone2_upper_pct,
      workoutStart: startTime,
      workoutEnd: endTime
    });
    return {
      ...workout,
      ...distanceMetrics,
      heart_rate_data: heartRateData,
      heart_rate_recovery: safeJsonArray(workout.heart_rate_recovery),
      zone1_seconds: clampZoneSeconds(zones.zone1, durationSeconds),
      zone2_seconds: clampZoneSeconds(zones.zone2, durationSeconds),
      zone3_seconds: clampZoneSeconds(zones.zone3, durationSeconds),
      zone4_seconds: clampZoneSeconds(zones.zone4, durationSeconds),
      zone5_seconds: clampZoneSeconds(zones.zone5, durationSeconds)
    };
  }

  const enriched = enrichWorkoutFromSamples(db, workout, config);
  return {
    ...workout,
    ...enriched,
    heart_rate_data: enriched.heart_rate_data ?? heartRateData,
    heart_rate_recovery: safeJsonArray(workout.heart_rate_recovery)
  };
}

function enrichWorkoutFromSamples(db: Database.Database, workout: Record<string, unknown>, config: AppConfig): Record<string, unknown> {
  const startTime = typeof workout.start_time === "string" ? workout.start_time : null;
  const endTime = typeof workout.end_time === "string" ? workout.end_time : null;
  const distanceMetrics = deriveDistanceMetrics(db, workout);
  if (!startTime || !endTime) {
    return distanceMetrics;
  }

  const points = db
    .prepare(`
      SELECT timestamp_local, value, value_min, value_max
      FROM health_samples
      WHERE metric_name = 'heart_rate'
        AND COALESCE(timestamp_end_local, timestamp_local) >= ?
        AND timestamp_local <= ?
      ORDER BY timestamp_local
    `)
    .all(startTime, endTime) as Array<{
    timestamp_local: string;
    value: number;
    value_min: number | null;
    value_max: number | null;
  }>;

  if (points.length === 0) {
    return distanceMetrics;
  }

  const series = points.map((point) => ({
      date: point.timestamp_local,
      Min: point.value_min ?? point.value,
      Avg: point.value,
      Max: point.value_max ?? point.value
  }));
  const zones = computeHRZones(series, config.max_heart_rate, {
    restingHeartRate: restingHeartRateForWorkout(db, startTime),
    zone2LowerPct: config.zone2_lower_pct,
    zone2UpperPct: config.zone2_upper_pct,
    workoutStart: startTime,
    workoutEnd: endTime
  });
  const avgHr = Number((series.reduce((sum, point) => sum + point.Avg, 0) / series.length).toFixed(1));
  const maxHr = Math.max(...series.map((point) => point.Max));

  return {
    ...distanceMetrics,
    heart_rate_data: series,
    avg_heart_rate: numberOrNull(workout.avg_heart_rate) ?? avgHr,
    max_heart_rate: numberOrNull(workout.max_heart_rate) ?? maxHr,
    zone1_seconds: clampZoneSeconds(zones.zone1, numberOrNull(workout.duration_seconds)),
    zone2_seconds: clampZoneSeconds(zones.zone2, numberOrNull(workout.duration_seconds)),
    zone3_seconds: clampZoneSeconds(zones.zone3, numberOrNull(workout.duration_seconds)),
    zone4_seconds: clampZoneSeconds(zones.zone4, numberOrNull(workout.duration_seconds)),
    zone5_seconds: clampZoneSeconds(zones.zone5, numberOrNull(workout.duration_seconds))
  };
}

function deriveDistanceMetrics(db: Database.Database, workout: Record<string, unknown>) {
  const existingDistanceKm = numberOrNull(workout.distance_km);
  const startTime = typeof workout.start_time === "string" ? workout.start_time : null;
  const endTime = typeof workout.end_time === "string" ? workout.end_time : null;
  const durationSeconds = numberOrNull(workout.duration_seconds);
  const sampledDistanceKm =
    existingDistanceKm ?? (startTime && endTime ? walkingRunningDistanceForWindow(db, startTime, endTime) : null);
  const avgPaceMinPerKm =
    numberOrNull(workout.avg_pace_min_per_km) ??
    (durationSeconds && sampledDistanceKm && sampledDistanceKm > 0
      ? Number((durationSeconds / 60 / sampledDistanceKm).toFixed(2))
      : null);

  return {
    distance_km: sampledDistanceKm,
    avg_pace_min_per_km: avgPaceMinPerKm
  };
}

function walkingRunningDistanceForWindow(db: Database.Database, startTime: string, endTime: string) {
  const row = db.prepare(`
    SELECT ROUND(SUM(value), 2) as total
    FROM health_samples
    WHERE metric_name = 'walking_running_distance'
      AND COALESCE(timestamp_end_local, timestamp_local) >= ?
      AND timestamp_local <= ?
  `).get(startTime, endTime) as { total: number | null } | undefined;
  return row?.total ?? null;
}

function restingHeartRateForWorkout(db: Database.Database, startTime: string) {
  const workoutDate = startTime.slice(0, 10);
  const row = db.prepare(`
    SELECT value
    FROM health_samples
    WHERE metric_name = 'resting_heart_rate'
      AND substr(COALESCE(timestamp_end_local, timestamp_local), 1, 10) <= ?
    ORDER BY COALESCE(timestamp_end_local, timestamp_local) DESC
    LIMIT 1
  `).get(workoutDate) as { value: number } | undefined;
  return row?.value ?? null;
}

function clampZoneSeconds(value: number, durationSeconds: number | null) {
  if (!durationSeconds || durationSeconds <= 0) {
    return value;
  }
  return Math.min(value, Math.round(durationSeconds));
}

function isRunningWorkout(workout: Record<string, unknown>) {
  return typeof workout.workout_type === "string" && workout.workout_type.toLowerCase().includes("run");
}

function safeJsonArray(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }
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

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatMonthDay(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${date}T00:00:00Z`));
}
