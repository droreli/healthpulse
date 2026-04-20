import { Unzip, UnzipInflate, UnzipPassThrough } from "fflate";
import sax from "sax";
import type { AppDatabase } from "./db.js";
import type { AppConfig } from "./config.js";
import { rawDateToLocalIso, rawDateToUtcIso } from "../server/dates.js";
import { hashFileContents, hasProcessedFile, insertSyncLog } from "./dedup.js";
import type { NormalizedHealthSample, NormalizedSleepSession, NormalizedWorkout } from "../ingester/types.js";
import { insertSamples, insertSleepSessions, insertWorkouts } from "./ingest-data.js";
import { rebuildDerivedTables } from "../pipeline/aggregator.js";
import { computeHRZones } from "../ingester/zones.js";
import type { AppleImportResult } from "../apple-import/types.js";
import type Database from "better-sqlite3";

const APPLE_IMPORT_LOOKBACK_DAYS = 14;
const SAMPLE_BATCH_SIZE = 2000;
const WORKOUT_BATCH_SIZE = 200;
const ZIP_CHUNK_SIZE = 128 * 1024;
const ZIP_YIELD_EVERY_CHUNKS = 4;

const METRIC_TYPE_MAP: Record<string, string> = {
  HKQuantityTypeIdentifierHeartRate: "heart_rate",
  HKQuantityTypeIdentifierRestingHeartRate: "resting_heart_rate",
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: "heart_rate_variability",
  HKQuantityTypeIdentifierStepCount: "step_count",
  HKQuantityTypeIdentifierActiveEnergyBurned: "active_energy_burned",
  HKQuantityTypeIdentifierDistanceWalkingRunning: "walking_running_distance",
  HKQuantityTypeIdentifierVO2Max: "vo2_max"
};

const SLEEP_VALUE_MAP = {
  "0": "in_bed",
  "1": "asleep",
  "2": "awake",
  "3": "core",
  "4": "deep",
  "5": "rem",
  HKCategoryValueSleepAnalysisInBed: "in_bed",
  HKCategoryValueSleepAnalysisAsleep: "asleep",
  HKCategoryValueSleepAnalysisAwake: "awake",
  HKCategoryValueSleepAnalysisAsleepUnspecified: "asleep",
  HKCategoryValueSleepAnalysisAsleepCore: "core",
  HKCategoryValueSleepAnalysisAsleepDeep: "deep",
  HKCategoryValueSleepAnalysisAsleepREM: "rem"
} as const;

interface WorkoutBuilder {
  workout_type: string;
  start_time: string;
  end_time: string;
  duration_seconds: number | null;
  distance_km: number | null;
  active_energy_kcal: number | null;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
}

type SleepStage = (typeof SLEEP_VALUE_MAP)[keyof typeof SLEEP_VALUE_MAP];

interface RawSleepRecord {
  sleepValue: SleepStage;
  startLocal: string;
  endLocal: string;
  endUtc: string;
  durationHours: number;
}

export async function importAppleHealthZip(
  db: AppDatabase,
  fileBytes: ArrayBuffer | Uint8Array,
  fileName: string,
  config: AppConfig
): Promise<AppleImportResult> {
  const fileHash = await hashFileContents(fileBytes);

  if (hasProcessedFile(db, fileHash)) {
    return {
      skipped: true,
      fileName,
      recordsIngested: 0,
      samplesIngested: 0,
      workoutsIngested: 0,
      sleepSessionsUpdated: 0,
      exportDate: null,
      cutoffDate: null,
      warnings: []
    };
  }

  const cutoffDate = computeCutoffDate(db);
  const warnings: string[] = [];
  const sleepRecords: RawSleepRecord[] = [];
  const samplesBatch: NormalizedHealthSample[] = [];
  const workoutsBatch: NormalizedWorkout[] = [];
  let exportDate: string | null = null;
  let currentWorkout: WorkoutBuilder | null = null;
  let samplesIngested = 0;
  let workoutsIngested = 0;

  const insertSamplesBatch = db.transaction((samples: NormalizedHealthSample[]) => {
    insertSamples(db, samples);
  });
  const insertWorkoutsBatch = db.transaction((workouts: NormalizedWorkout[]) => {
    insertWorkouts(db, workouts);
  });

  const flushSamples = () => {
    if (samplesBatch.length === 0) {
      return;
    }
    insertSamplesBatch(samplesBatch.splice(0, samplesBatch.length));
  };

  const flushWorkouts = () => {
    if (workoutsBatch.length === 0) {
      return;
    }
    insertWorkoutsBatch(workoutsBatch.splice(0, workoutsBatch.length));
  };

  const parser = sax.parser(true, { lowercase: true, trim: true });

  parser.onopentag = (node: sax.Tag) => {
    const attrs = normalizeAttrs(node.attributes);
    const tagName = node.name.toLowerCase();

    if (tagName === "exportdate") {
      exportDate = attrs.value ?? null;
      return;
    }

    if (tagName === "record") {
      const metricName = attrs.type ? METRIC_TYPE_MAP[attrs.type] : null;
      if (metricName) {
        const sample = buildSample(attrs, metricName);
        if (sample && shouldImportByCutoff(sample.timestamp_end_utc ?? sample.timestamp_utc, cutoffDate)) {
          samplesBatch.push(sample);
          samplesIngested += 1;
          if (samplesBatch.length >= SAMPLE_BATCH_SIZE) {
            flushSamples();
          }
        }
        return;
      }

      if (attrs.type === "HKCategoryTypeIdentifierSleepAnalysis") {
        const sleepValue = mapSleepValue(attrs.value);
        if (!sleepValue) {
          return;
        }
        collectSleepRecord(attrs, sleepValue, sleepRecords, cutoffDate);
      }
      return;
    }

    if (tagName === "workout") {
      const workout = buildWorkout(attrs);
      currentWorkout = workout && shouldImportByCutoff(rawDateToUtcIso(attrs.enddate ?? attrs.startdate ?? ""), cutoffDate) ? workout : null;
      return;
    }

    if (tagName === "workoutstatistics" && currentWorkout) {
      applyWorkoutStatistic(currentWorkout, attrs);
    }
  };

  parser.onclosetag = (name: string) => {
    if (name.toLowerCase() !== "workout" || !currentWorkout) {
      return;
    }

    workoutsBatch.push(finalizeWorkout(currentWorkout));
    workoutsIngested += 1;
    currentWorkout = null;

    if (workoutsBatch.length >= WORKOUT_BATCH_SIZE) {
      flushWorkouts();
    }
  };

  await streamExportXml(fileBytes, (chunk) => {
    parser.write(chunk);
  });
  parser.close();

  flushSamples();
  flushWorkouts();

  const sleepSessions = buildSleepSessions(sleepRecords);
  db.transaction(() => {
    insertSleepSessions(db, sleepSessions);
  })();
  enrichWorkoutsFromHeartRate(db, config);
  rebuildDerivedTables(db as unknown as Database.Database);
  db.transaction(() => {
    insertSyncLog(db, fileName, fileHash, "apple_xml", samplesIngested + workoutsIngested + sleepSessions.length);
  })();

  return {
    skipped: false,
    fileName,
    recordsIngested: samplesIngested + workoutsIngested + sleepSessions.length,
    samplesIngested,
    workoutsIngested,
    sleepSessionsUpdated: sleepSessions.length,
    exportDate,
    cutoffDate,
    warnings
  };
}

async function streamExportXml(fileBytes: ArrayBuffer | Uint8Array, onChunk: (chunk: string) => void): Promise<void> {
  const bytes = fileBytes instanceof Uint8Array ? fileBytes : new Uint8Array(fileBytes);
  const unzipper = new Unzip();
  unzipper.register(UnzipPassThrough);
  unzipper.register(UnzipInflate);

  const decoder = new TextDecoder();
  let foundExportXml = false;
  let finishedExportXml = false;
  let chunksSinceYield = 0;

  unzipper.onfile = (file) => {
    if (!file.name.endsWith("export.xml")) {
      return;
    }

    foundExportXml = true;
    file.ondata = (error, data, final) => {
      if (error) {
        throw error;
      }

      const text = decoder.decode(data, { stream: !final });
      if (text) {
        onChunk(text);
      }

      if (final) {
        finishedExportXml = true;
      }
    };
    file.start();
  };

  for (let offset = 0; offset < bytes.length; offset += ZIP_CHUNK_SIZE) {
    const end = Math.min(offset + ZIP_CHUNK_SIZE, bytes.length);
    unzipper.push(bytes.subarray(offset, end), end === bytes.length);
    chunksSinceYield += 1;

    if (finishedExportXml) {
      break;
    }

    if (chunksSinceYield >= ZIP_YIELD_EVERY_CHUNKS) {
      chunksSinceYield = 0;
      await yieldToEventLoop();
    }
  }

  if (!foundExportXml) {
    throw new Error("Apple Health export zip is missing export.xml");
  }

  if (!finishedExportXml) {
    throw new Error("Apple Health export zip ended before export.xml finished");
  }
}

async function yieldToEventLoop(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function normalizeAttrs(
  input: Record<string, string | { value?: string | undefined }>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") {
      out[key.toLowerCase()] = value;
    } else if (value && typeof value.value === "string") {
      out[key.toLowerCase()] = value.value;
    }
  }
  return out;
}

function buildSample(attrs: Record<string, string>, metricName: string): NormalizedHealthSample | null {
  const startUtc = rawDateToUtcIso(attrs.startdate ?? "");
  const startLocal = rawDateToLocalIso(attrs.startdate ?? "");
  const endUtc = rawDateToUtcIso(attrs.enddate ?? "");
  const endLocal = rawDateToLocalIso(attrs.enddate ?? "");
  const value = attrs.value ? Number(attrs.value) : NaN;

  if (!startUtc || !startLocal || !endUtc || !endLocal || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return {
    metric_name: metricName,
    value,
    value_min: null,
    value_max: null,
    unit: attrs.unit ?? inferUnit(metricName),
    timestamp_utc: startUtc,
    timestamp_local: startLocal,
    timestamp_end_utc: endUtc,
    timestamp_end_local: endLocal,
    source: attrs.sourcename ?? "Apple Health Export",
    dedup_key: `apple:${metricName}:${attrs.startdate}:${attrs.enddate}:${attrs.sourcename ?? ""}:${attrs.value ?? ""}:${attrs.unit ?? ""}`
  };
}

function buildWorkout(attrs: Record<string, string>): WorkoutBuilder | null {
  const startTime = rawDateToLocalIso(attrs.startdate ?? "");
  const endTime = rawDateToLocalIso(attrs.enddate ?? "");
  if (!startTime || !endTime || !attrs.workoutactivitytype) {
    return null;
  }

  return {
    workout_type: humanizeWorkoutType(attrs.workoutactivitytype),
    start_time: startTime,
    end_time: endTime,
    duration_seconds: parseDuration(attrs.duration, attrs.durationunit),
    distance_km: parseDistanceKm(attrs.totaldistance, attrs.totaldistanceunit),
    active_energy_kcal: parseEnergyKcal(attrs.totalenergyburned, attrs.totalenergyburnedunit),
    avg_heart_rate: null,
    max_heart_rate: null
  };
}

function applyWorkoutStatistic(workout: WorkoutBuilder, attrs: Record<string, string>): void {
  if (attrs.type !== "HKQuantityTypeIdentifierHeartRate") {
    return;
  }

  if (attrs.average) {
    workout.avg_heart_rate = Number(attrs.average);
  }
  if (attrs.maximum) {
    workout.max_heart_rate = Number(attrs.maximum);
  }
}

function finalizeWorkout(workout: WorkoutBuilder): NormalizedWorkout {
  return {
    hae_id: null,
    workout_type: workout.workout_type,
    start_time: workout.start_time,
    end_time: workout.end_time,
    duration_seconds: workout.duration_seconds,
    distance_km: workout.distance_km,
    active_energy_kcal: workout.active_energy_kcal,
    avg_heart_rate: workout.avg_heart_rate,
    max_heart_rate: workout.max_heart_rate,
    elevation_up_m: null,
    heart_rate_data: null,
    heart_rate_recovery: null,
    zone1_seconds: null,
    zone2_seconds: null,
    zone3_seconds: null,
    zone4_seconds: null,
    zone5_seconds: null,
    avg_pace_min_per_km:
      workout.duration_seconds && workout.distance_km && workout.distance_km > 0
        ? Number((workout.duration_seconds / 60 / workout.distance_km).toFixed(2))
        : null,
    dedup_key: `fallback:${workout.workout_type}:${workout.start_time}`
  };
}

function collectSleepRecord(
  attrs: Record<string, string>,
  sleepValue: SleepStage,
  sleepRecords: RawSleepRecord[],
  cutoffDate: string | null
): void {
  const startLocal = rawDateToLocalIso(attrs.startdate ?? "");
  const endLocal = rawDateToLocalIso(attrs.enddate ?? "");
  const endUtc = rawDateToUtcIso(attrs.enddate ?? "");
  if (!startLocal || !endLocal || !endUtc || !shouldImportByCutoff(endUtc, cutoffDate)) {
    return;
  }

  const durationHours = (new Date(endLocal).getTime() - new Date(startLocal).getTime()) / 1000 / 60 / 60;
  if (!Number.isFinite(durationHours) || durationHours <= 0) {
    return;
  }

  sleepRecords.push({
    sleepValue,
    startLocal,
    endLocal,
    endUtc,
    durationHours
  });
}

function buildSleepSessions(records: RawSleepRecord[]): NormalizedSleepSession[] {
  if (records.length === 0) {
    return [];
  }

  const episodes = buildSleepEpisodes(records);
  const byDate = new Map<string, NormalizedSleepSession>();

  for (const episode of episodes) {
    const session = episodeToSleepSession(episode);
    if (!session) {
      continue;
    }

    const existing = byDate.get(session.date);
    if (!existing || (session.total_sleep_hours ?? 0) > (existing.total_sleep_hours ?? 0)) {
      byDate.set(session.date, session);
    }
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function buildSleepEpisodes(records: RawSleepRecord[]): RawSleepRecord[][] {
  const sorted = [...records].sort((a, b) => a.startLocal.localeCompare(b.startLocal));
  const episodes: RawSleepRecord[][] = [];
  const maxGapMs = 4 * 60 * 60 * 1000;

  let currentEpisode: RawSleepRecord[] = [];
  let currentEpisodeEndMs = 0;

  for (const record of sorted) {
    const startMs = new Date(record.startLocal).getTime();
    const endMs = new Date(record.endLocal).getTime();
    if (currentEpisode.length === 0 || startMs - currentEpisodeEndMs > maxGapMs) {
      if (currentEpisode.length > 0) {
        episodes.push(currentEpisode);
      }
      currentEpisode = [record];
      currentEpisodeEndMs = endMs;
      continue;
    }

    currentEpisode.push(record);
    currentEpisodeEndMs = Math.max(currentEpisodeEndMs, endMs);
  }

  if (currentEpisode.length > 0) {
    episodes.push(currentEpisode);
  }

  return episodes;
}

function episodeToSleepSession(records: RawSleepRecord[]): NormalizedSleepSession | null {
  const sleepRecords = records.filter((record) => record.sleepValue !== "in_bed" && record.sleepValue !== "awake");
  const explicitInBedRecords = records.filter((record) => record.sleepValue === "in_bed");
  const awakeRecords = records.filter((record) => record.sleepValue === "awake");
  const coveredHours = round(sumMergedIntervalHours(records), 2);
  const awakeHours = round(sumMergedIntervalHours(awakeRecords), 2);
  let totalSleep = round(sleepRecords.reduce((sum, record) => sum + record.durationHours, 0), 2);

  if (sleepRecords.length === 0 && coveredHours > 0) {
    totalSleep = coveredHours;
  }

  if (totalSleep <= 0) {
    return null;
  }

  const inBedHours = round(Math.max(coveredHours, totalSleep + awakeHours), 2);
  const sleepStart = sleepRecords.length > 0 ? sleepRecords[0].startLocal : records[0]?.startLocal ?? null;
  const sleepEnd =
    sleepRecords.length > 0 ? sleepRecords[sleepRecords.length - 1].endLocal : records[records.length - 1]?.endLocal ?? null;
  const inBedStart = explicitInBedRecords[0]?.startLocal ?? records[0]?.startLocal ?? null;
  const inBedEnd = explicitInBedRecords[explicitInBedRecords.length - 1]?.endLocal ?? records[records.length - 1]?.endLocal ?? null;
  const core = sumSleepStage(records, "core");
  const deep = sumSleepStage(records, "deep");
  const rem = sumSleepStage(records, "rem");
  const date = (inBedEnd ?? sleepEnd ?? records[records.length - 1]?.endLocal)?.slice(0, 10);

  if (!date) {
    return null;
  }

  return {
    date,
    total_sleep_hours: totalSleep,
    asleep_hours: totalSleep,
    core_hours: core,
    deep_hours: deep,
    rem_hours: rem,
    in_bed_hours: inBedHours,
    sleep_start: sleepStart,
    sleep_end: sleepEnd,
    in_bed_start: inBedStart,
    in_bed_end: inBedEnd,
    sleep_efficiency: inBedHours > 0 ? round((totalSleep / inBedHours) * 100, 1) : null,
    deep_pct: deep !== null && totalSleep > 0 ? round((deep / totalSleep) * 100, 1) : null,
    rem_pct: rem !== null && totalSleep > 0 ? round((rem / totalSleep) * 100, 1) : null,
    core_pct: core !== null && totalSleep > 0 ? round((core / totalSleep) * 100, 1) : null,
    awake_minutes: inBedHours > totalSleep ? round((inBedHours - totalSleep) * 60, 1) : 0
  };
}

function sumMergedIntervalHours(records: RawSleepRecord[]): number {
  if (records.length === 0) {
    return 0;
  }

  const intervals = records
    .map((record) => ({
      startMs: new Date(record.startLocal).getTime(),
      endMs: new Date(record.endLocal).getTime()
    }))
    .sort((a, b) => a.startMs - b.startMs);
  let mergedStart = intervals[0].startMs;
  let mergedEnd = intervals[0].endMs;
  let totalMs = 0;

  for (let index = 1; index < intervals.length; index += 1) {
    const interval = intervals[index];
    if (interval.startMs <= mergedEnd) {
      mergedEnd = Math.max(mergedEnd, interval.endMs);
      continue;
    }

    totalMs += mergedEnd - mergedStart;
    mergedStart = interval.startMs;
    mergedEnd = interval.endMs;
  }

  totalMs += mergedEnd - mergedStart;
  return totalMs / 1000 / 60 / 60;
}

function sumSleepStage(records: RawSleepRecord[], stage: Extract<SleepStage, "core" | "deep" | "rem">): number | null {
  const stageRecords = records.filter((record) => record.sleepValue === stage);
  if (stageRecords.length === 0) {
    return null;
  }

  return round(stageRecords.reduce((sum, record) => sum + record.durationHours, 0), 2);
}

function computeCutoffDate(db: AppDatabase): string | null {
  const row = db.prepare(`
    SELECT MAX(value) as latest
    FROM (
      SELECT MAX(COALESCE(timestamp_end_utc, timestamp_utc)) as value FROM health_samples
      UNION ALL
      SELECT MAX(end_time) as value FROM workouts
      UNION ALL
      SELECT MAX(date || 'T23:59:59.999Z') as value FROM sleep_sessions
    )
  `).get() as { latest: string | null } | undefined;

  if (!row?.latest) {
    return null;
  }

  const date = new Date(row.latest);
  date.setUTCDate(date.getUTCDate() - APPLE_IMPORT_LOOKBACK_DAYS);
  return date.toISOString();
}

function shouldImportByCutoff(dateValue: string | null, cutoffDate: string | null): boolean {
  if (!dateValue || !cutoffDate) {
    return true;
  }
  return dateValue >= cutoffDate;
}

function inferUnit(metricName: string): string {
  switch (metricName) {
    case "heart_rate":
    case "resting_heart_rate":
      return "count/min";
    case "heart_rate_variability":
      return "ms";
    case "active_energy_burned":
      return "kcal";
    case "walking_running_distance":
      return "km";
    case "vo2_max":
      return "mL/min·kg";
    default:
      return "count";
  }
}

function parseDuration(value?: string, unit?: string): number | null {
  const parsed = value ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (unit === "min") return parsed * 60;
  if (unit === "hr") return parsed * 60 * 60;
  return parsed;
}

function parseDistanceKm(value?: string, unit?: string): number | null {
  const parsed = value ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (unit === "m") return parsed / 1000;
  if (unit === "mi") return parsed * 1.60934;
  return parsed;
}

function parseEnergyKcal(value?: string, unit?: string): number | null {
  const parsed = value ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (unit === "J") return parsed / 4184;
  return parsed;
}

function humanizeWorkoutType(raw: string): string {
  const cleaned = raw.replace(/^HKWorkoutActivityType/, "");
  return cleaned.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\bHiit\b/g, "HIIT").trim();
}

function enrichWorkoutsFromHeartRate(db: AppDatabase, config: AppConfig): void {
  const workouts = db.prepare(`
    SELECT id, start_time, end_time, avg_heart_rate, max_heart_rate, distance_km, duration_seconds
    FROM workouts
  `).all() as Array<{
    id: number;
    start_time: string;
    end_time: string;
    avg_heart_rate: number | null;
    max_heart_rate: number | null;
    distance_km: number | null;
    duration_seconds: number | null;
  }>;

  const selectSamples = db.prepare(`
    SELECT timestamp_local, value, value_min, value_max
    FROM health_samples
    WHERE metric_name = 'heart_rate'
      AND COALESCE(timestamp_end_local, timestamp_local) >= ?
      AND timestamp_local <= ?
    ORDER BY timestamp_local
  `);
  const selectRestingHeartRate = db.prepare(`
    SELECT value
    FROM health_samples
    WHERE metric_name = 'resting_heart_rate'
      AND substr(COALESCE(timestamp_end_local, timestamp_local), 1, 10) <= ?
    ORDER BY COALESCE(timestamp_end_local, timestamp_local) DESC
    LIMIT 1
  `);
  const updateWorkout = db.prepare(`
    UPDATE workouts
    SET heart_rate_data = ?, zone1_seconds = ?, zone2_seconds = ?, zone3_seconds = ?, zone4_seconds = ?, zone5_seconds = ?,
        avg_heart_rate = COALESCE(avg_heart_rate, ?),
        max_heart_rate = COALESCE(max_heart_rate, ?),
        avg_pace_min_per_km = COALESCE(avg_pace_min_per_km, ?)
    WHERE id = ?
  `);

  const transaction = db.transaction(() => {
    for (const workout of workouts) {
      const points = selectSamples.all(workout.start_time, workout.end_time) as Array<{
        timestamp_local: string;
        value: number;
        value_min: number | null;
        value_max: number | null;
      }>;
      if (points.length === 0) {
        continue;
      }

      const series = points.map((point) => ({
        date: point.timestamp_local,
        Min: point.value_min ?? point.value,
        Avg: point.value,
        Max: point.value_max ?? point.value
      }));
      const restingRow = selectRestingHeartRate.get(workout.start_time.slice(0, 10)) as { value: number } | undefined;
      const zones = computeHRZones(series, config.max_heart_rate, {
        restingHeartRate: restingRow?.value ?? null,
        zone2LowerPct: config.zone2_lower_pct,
        zone2UpperPct: config.zone2_upper_pct,
        workoutStart: workout.start_time,
        workoutEnd: workout.end_time
      });
      const avgHr = Number((series.reduce((sum, point) => sum + point.Avg, 0) / series.length).toFixed(1));
      const maxHr = Math.max(...series.map((point) => point.Max));
      const avgPace =
        workout.duration_seconds && workout.distance_km && workout.distance_km > 0
          ? Number((workout.duration_seconds / 60 / workout.distance_km).toFixed(2))
          : null;

      updateWorkout.run(
        JSON.stringify(series),
        zones.zone1,
        zones.zone2,
        zones.zone3,
        zones.zone4,
        zones.zone5,
        avgHr,
        maxHr,
        avgPace,
        workout.id
      );
    }
  });

  transaction();
}

function round(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}

function mapSleepValue(rawValue?: string): SleepStage | null {
  if (!rawValue) {
    return null;
  }

  return SLEEP_VALUE_MAP[rawValue as keyof typeof SLEEP_VALUE_MAP] ?? null;
}
