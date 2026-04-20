import { type AppConfig } from "../server/config.js";
import { rawDateToLocalIso, rawDateToUtcIso } from "../server/dates.js";
import { computeHRZones } from "./zones.js";
import type {
  IngestWarning,
  NormalizedFile,
  NormalizedHealthSample,
  NormalizedSleepSession,
  NormalizedWorkout,
  ParsedHaeFile,
  ParsedWorkoutRecord
} from "./types.js";

export function normalizeHaeFile(parsed: ParsedHaeFile, config: AppConfig): NormalizedFile {
  const warnings: IngestWarning[] = [];

  if (parsed.type === "metrics") {
    const samples: NormalizedHealthSample[] = [];
    const sleepSessions: NormalizedSleepSession[] = [];

    for (const metric of parsed.metrics) {
      if (metric.data.length === 0) {
        continue;
      }

      if (metric.name === "sleep_analysis") {
        for (const entry of metric.data) {
          const sleepSession = normalizeSleepEntry(entry, warnings);
          if (sleepSession) {
            sleepSessions.push(sleepSession);
          }
        }
        continue;
      }

      for (const entry of metric.data) {
        const sample = normalizeMetricEntry(metric.name, metric.units, entry, warnings);
        if (sample) {
          samples.push(sample);
        }
      }
    }

    return { samples, sleepSessions, workouts: [], warnings };
  }

  const workouts = parsed.workouts.flatMap((workout) => {
    const normalized = normalizeWorkoutEntry(workout, config, warnings);
    return normalized ? [normalized] : [];
  });

  return { samples: [], sleepSessions: [], workouts, warnings };
}

function normalizeMetricEntry(
  metricName: string,
  unit: string,
  entry: Record<string, unknown>,
  warnings: IngestWarning[]
): NormalizedHealthSample | null {
  const date = typeof entry.date === "string" ? entry.date : null;
  if (!date) {
    warnings.push({ level: "warn", message: `Skipping ${metricName}: missing date` });
    return null;
  }

  const timestampUtc = rawDateToUtcIso(date);
  const timestampLocal = rawDateToLocalIso(date);

  if (!timestampUtc || !timestampLocal) {
    warnings.push({ level: "warn", message: `Skipping ${metricName}: invalid date "${date}"` });
    return null;
  }

  const avgValue = typeof entry.Avg === "number" ? entry.Avg : null;
  const qtyValue = typeof entry.qty === "number" ? entry.qty : null;
  const value = avgValue ?? qtyValue;

  if (value === null || !isMetricValueValid(metricName, value)) {
    warnings.push({ level: "warn", message: `Skipping ${metricName}: invalid value for ${date}` });
    return null;
  }

  const minValue = typeof entry.Min === "number" ? entry.Min : null;
  const maxValue = typeof entry.Max === "number" ? entry.Max : null;
  const source = typeof entry.source === "string" ? entry.source : "Health Auto Export";

  return {
    metric_name: metricName,
    value,
    value_min: minValue,
    value_max: maxValue,
    unit,
    timestamp_utc: timestampUtc,
    timestamp_local: timestampLocal,
    timestamp_end_utc: timestampUtc,
    timestamp_end_local: timestampLocal,
    source
    ,
    dedup_key: `hae:${metricName}:${timestampUtc}:${source}`
  };
}

function normalizeSleepEntry(
  entry: Record<string, unknown>,
  warnings: IngestWarning[]
): NormalizedSleepSession | null {
  const date = typeof entry.date === "string" ? entry.date : null;
  if (!date) {
    warnings.push({ level: "warn", message: "Skipping sleep session: missing date" });
    return null;
  }

  const totalSleep = numberOrNull(entry.totalSleep);
  const asleep = numberOrNull(entry.asleep);
  const core = numberOrNull(entry.core);
  const deep = numberOrNull(entry.deep);
  const rem = numberOrNull(entry.rem);
  const inBed = numberOrNull(entry.inBed);
  const sleepStart = dateField(entry.sleepStart);
  const sleepEnd = dateField(entry.sleepEnd);
  const inBedStart = dateField(entry.inBedStart);
  const inBedEnd = dateField(entry.inBedEnd);

  return {
    date,
    total_sleep_hours: totalSleep,
    asleep_hours: asleep,
    core_hours: core,
    deep_hours: deep,
    rem_hours: rem,
    in_bed_hours: inBed,
    sleep_start: sleepStart,
    sleep_end: sleepEnd,
    in_bed_start: inBedStart,
    in_bed_end: inBedEnd,
    sleep_efficiency: asleep !== null && inBed !== null && inBed > 0 ? round((asleep / inBed) * 100) : null,
    deep_pct: deep !== null && totalSleep !== null && totalSleep > 0 ? round((deep / totalSleep) * 100) : null,
    rem_pct: rem !== null && totalSleep !== null && totalSleep > 0 ? round((rem / totalSleep) * 100) : null,
    core_pct: core !== null && totalSleep !== null && totalSleep > 0 ? round((core / totalSleep) * 100) : null,
    awake_minutes: inBed !== null && totalSleep !== null ? round((inBed - totalSleep) * 60) : null
  };
}

function normalizeWorkoutEntry(
  workout: ParsedWorkoutRecord,
  config: AppConfig,
  warnings: IngestWarning[]
): NormalizedWorkout | null {
  if (!workout.name || !workout.start || !workout.end) {
    warnings.push({ level: "warn", message: "Skipping workout: missing name/start/end" });
    return null;
  }

  const startTime = rawDateToLocalIso(workout.start);
  const endTime = rawDateToLocalIso(workout.end);
  if (!startTime || !endTime) {
    warnings.push({ level: "warn", message: `Skipping workout ${workout.name}: invalid dates` });
    return null;
  }

  const heartRateData = normalizeWorkoutSeries(workout.heartRateData);
  const heartRateRecovery = normalizeWorkoutRecovery(workout.heartRateRecovery);
  const zones = computeHRZones(heartRateData, config.max_heart_rate, {
    zone2LowerPct: config.zone2_lower_pct,
    zone2UpperPct: config.zone2_upper_pct,
    workoutStart: startTime,
    workoutEnd: endTime
  });
  const distanceKm = numberOrNull(workout.distance?.qty);
  const durationSeconds = numberOrNull(workout.duration);

  return {
    hae_id: workout.id ?? null,
    workout_type: workout.name,
    start_time: startTime,
    end_time: endTime,
    duration_seconds: durationSeconds,
    distance_km: distanceKm,
    active_energy_kcal: numberOrNull(workout.activeEnergyBurned?.qty),
    avg_heart_rate: numberOrNull(workout.avgHeartRate?.qty),
    max_heart_rate: numberOrNull(workout.maxHeartRate?.qty),
    elevation_up_m: numberOrNull(workout.elevationUp?.qty),
    heart_rate_data: heartRateData.length > 0 ? JSON.stringify(heartRateData) : null,
    heart_rate_recovery: heartRateRecovery.length > 0 ? JSON.stringify(heartRateRecovery) : null,
    zone1_seconds: heartRateData.length > 0 ? zones.zone1 : null,
    zone2_seconds: heartRateData.length > 0 ? zones.zone2 : null,
    zone3_seconds: heartRateData.length > 0 ? zones.zone3 : null,
    zone4_seconds: heartRateData.length > 0 ? zones.zone4 : null,
    zone5_seconds: heartRateData.length > 0 ? zones.zone5 : null,
    avg_pace_min_per_km:
      durationSeconds && distanceKm && distanceKm > 0 ? round(durationSeconds / 60 / distanceKm, 2) : null,
    dedup_key: workout.id ? `hae:${workout.id}` : `fallback:${workout.name}:${startTime}`
  };
}

function normalizeWorkoutSeries(series: ParsedWorkoutRecord["heartRateData"]): Array<{ date: string; Min?: number; Avg?: number; Max?: number }> {
  if (!Array.isArray(series)) {
    return [];
  }

  return series.flatMap((point) => {
    if (typeof point.date !== "string") {
      return [];
    }

    const date = rawDateToLocalIso(point.date);
    if (!date) {
      return [];
    }

    return [
      {
        date,
        Min: numberOrNull(point.Min) ?? undefined,
        Avg: numberOrNull(point.Avg) ?? undefined,
        Max: numberOrNull(point.Max) ?? undefined
      }
    ];
  });
}

function normalizeWorkoutRecovery(series: ParsedWorkoutRecord["heartRateRecovery"]): Array<{ date: string; qty?: number }> {
  if (!Array.isArray(series)) {
    return [];
  }

  return series.flatMap((point) => {
    if (typeof point.date !== "string") {
      return [];
    }

    const date = rawDateToLocalIso(point.date);
    if (!date) {
      return [];
    }

    return [
      {
        date,
        qty: numberOrNull(point.qty) ?? undefined
      }
    ];
  });
}

function dateField(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  return rawDateToLocalIso(value);
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isMetricValueValid(metricName: string, value: number): boolean {
  if (!Number.isFinite(value) || value < 0) {
    return false;
  }

  if (metricName.includes("heart_rate") && value > 400) {
    return false;
  }

  if (metricName === "heart_rate_variability" && value > 500) {
    return false;
  }

  return true;
}

function round(value: number, digits = 1): number {
  return Number(value.toFixed(digits));
}
