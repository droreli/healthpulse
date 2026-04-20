import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import type { AppConfig } from "../server/config.js";
import { parseHaeFileContents } from "./parser.js";
import { hashFileContents, hasProcessedFile, insertSyncLog } from "./dedup.js";
import { normalizeHaeFile } from "./normalizer.js";
import { rebuildDerivedTables } from "../pipeline/aggregator.js";
import type { HaeFileType, IngestResult, NormalizedHealthSample, NormalizedSleepSession, NormalizedWorkout } from "./types.js";

export async function ingestDirectory(
  db: Database.Database,
  directory: string,
  fileType: HaeFileType,
  config: AppConfig
): Promise<IngestResult[]> {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const files = fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => path.join(directory, file));

  const results: IngestResult[] = [];
  for (const filePath of files) {
    results.push(await ingestFile(db, filePath, fileType, config));
  }
  return results;
}

export async function ingestFile(
  db: Database.Database,
  filePath: string,
  fileType: HaeFileType,
  config: AppConfig
): Promise<IngestResult> {
  const contents = fs.readFileSync(filePath, "utf8");
  const hash = hashFileContents(contents);

  if (hasProcessedFile(db, hash)) {
    return {
      filePath,
      fileType,
      hash,
      skipped: true,
      recordsIngested: 0,
      warnings: []
    };
  }

  const parsed = parseHaeFileContents(contents, fileType);
  const normalized = normalizeHaeFile(parsed, config);

  const transaction = db.transaction(() => {
    insertSamples(db, normalized.samples);
    insertSleepSessions(db, normalized.sleepSessions);
    insertWorkouts(db, normalized.workouts);
    insertSyncLog(
      db,
      filePath,
      hash,
      fileType,
      normalized.samples.length + normalized.sleepSessions.length + normalized.workouts.length
    );
  });

  transaction();
  rebuildDerivedTables(db);

  return {
    filePath,
    fileType,
    hash,
    skipped: false,
    recordsIngested: normalized.samples.length + normalized.sleepSessions.length + normalized.workouts.length,
    warnings: normalized.warnings
  };
}

export function insertSamples(db: Database.Database, samples: NormalizedHealthSample[]): void {
  const statement = db.prepare(`
    INSERT INTO health_samples (
      metric_name, value, value_min, value_max, unit, timestamp_utc, timestamp_local,
      timestamp_end_utc, timestamp_end_local, source, dedup_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(metric_name, timestamp_utc, source)
    DO UPDATE SET
      value = excluded.value,
      value_min = excluded.value_min,
      value_max = excluded.value_max,
      unit = excluded.unit,
      timestamp_local = excluded.timestamp_local,
      timestamp_end_utc = excluded.timestamp_end_utc,
      timestamp_end_local = excluded.timestamp_end_local
  `);

  for (const sample of samples) {
    statement.run(
      sample.metric_name,
      sample.value,
      sample.value_min,
      sample.value_max,
      sample.unit,
      sample.timestamp_utc,
      sample.timestamp_local,
      sample.timestamp_end_utc,
      sample.timestamp_end_local,
      sample.source,
      sample.dedup_key
    );
  }
}

export function insertSleepSessions(db: Database.Database, sessions: NormalizedSleepSession[]): void {
  const statement = db.prepare(`
    INSERT INTO sleep_sessions (
      date, total_sleep_hours, asleep_hours, core_hours, deep_hours, rem_hours,
      in_bed_hours, sleep_start, sleep_end, in_bed_start, in_bed_end,
      sleep_efficiency, deep_pct, rem_pct, core_pct, awake_minutes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date)
    DO UPDATE SET
      total_sleep_hours = excluded.total_sleep_hours,
      asleep_hours = excluded.asleep_hours,
      core_hours = excluded.core_hours,
      deep_hours = excluded.deep_hours,
      rem_hours = excluded.rem_hours,
      in_bed_hours = excluded.in_bed_hours,
      sleep_start = excluded.sleep_start,
      sleep_end = excluded.sleep_end,
      in_bed_start = excluded.in_bed_start,
      in_bed_end = excluded.in_bed_end,
      sleep_efficiency = excluded.sleep_efficiency,
      deep_pct = excluded.deep_pct,
      rem_pct = excluded.rem_pct,
      core_pct = excluded.core_pct,
      awake_minutes = excluded.awake_minutes
  `);

  for (const session of sessions) {
    statement.run(
      session.date,
      session.total_sleep_hours,
      session.asleep_hours,
      session.core_hours,
      session.deep_hours,
      session.rem_hours,
      session.in_bed_hours,
      session.sleep_start,
      session.sleep_end,
      session.in_bed_start,
      session.in_bed_end,
      session.sleep_efficiency,
      session.deep_pct,
      session.rem_pct,
      session.core_pct,
      session.awake_minutes
    );
  }
}

export function insertWorkouts(db: Database.Database, workouts: NormalizedWorkout[]): void {
  const insert = db.prepare(`
    INSERT INTO workouts (
      hae_id, workout_type, start_time, end_time, duration_seconds, distance_km,
      active_energy_kcal, avg_heart_rate, max_heart_rate, elevation_up_m,
      heart_rate_data, heart_rate_recovery, zone1_seconds, zone2_seconds, zone3_seconds,
      zone4_seconds, zone5_seconds, avg_pace_min_per_km, dedup_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateById = db.prepare(`
    UPDATE workouts SET
      workout_type = COALESCE(?, workout_type),
      start_time = COALESCE(?, start_time),
      end_time = COALESCE(?, end_time),
      duration_seconds = COALESCE(?, duration_seconds),
      distance_km = COALESCE(?, distance_km),
      active_energy_kcal = COALESCE(?, active_energy_kcal),
      avg_heart_rate = COALESCE(?, avg_heart_rate),
      max_heart_rate = COALESCE(?, max_heart_rate),
      elevation_up_m = COALESCE(?, elevation_up_m),
      heart_rate_data = COALESCE(?, heart_rate_data),
      heart_rate_recovery = COALESCE(?, heart_rate_recovery),
      zone1_seconds = COALESCE(?, zone1_seconds),
      zone2_seconds = COALESCE(?, zone2_seconds),
      zone3_seconds = COALESCE(?, zone3_seconds),
      zone4_seconds = COALESCE(?, zone4_seconds),
      zone5_seconds = COALESCE(?, zone5_seconds),
      avg_pace_min_per_km = COALESCE(?, avg_pace_min_per_km),
      dedup_key = COALESCE(?, dedup_key)
    WHERE hae_id = ?
  `);

  const updateByTypeStart = db.prepare(`
    UPDATE workouts SET
      end_time = COALESCE(?, end_time),
      duration_seconds = COALESCE(?, duration_seconds),
      distance_km = COALESCE(?, distance_km),
      active_energy_kcal = COALESCE(?, active_energy_kcal),
      avg_heart_rate = COALESCE(?, avg_heart_rate),
      max_heart_rate = COALESCE(?, max_heart_rate),
      elevation_up_m = COALESCE(?, elevation_up_m),
      heart_rate_data = COALESCE(?, heart_rate_data),
      heart_rate_recovery = COALESCE(?, heart_rate_recovery),
      zone1_seconds = COALESCE(?, zone1_seconds),
      zone2_seconds = COALESCE(?, zone2_seconds),
      zone3_seconds = COALESCE(?, zone3_seconds),
      zone4_seconds = COALESCE(?, zone4_seconds),
      zone5_seconds = COALESCE(?, zone5_seconds),
      avg_pace_min_per_km = COALESCE(?, avg_pace_min_per_km),
      dedup_key = COALESCE(?, dedup_key)
    WHERE hae_id IS NULL AND workout_type = ? AND start_time = ?
  `);

  const selectById = db.prepare("SELECT id FROM workouts WHERE hae_id = ? LIMIT 1");
  const selectByTypeStart = db.prepare(`
    SELECT id
    FROM workouts
    WHERE hae_id IS NULL AND workout_type = ? AND start_time = ?
    LIMIT 1
  `);

  for (const workout of workouts) {
    if (workout.hae_id) {
      const existing = selectById.get(workout.hae_id);
      if (existing) {
        updateById.run(
          workout.workout_type,
          workout.start_time,
          workout.end_time,
          workout.duration_seconds,
          workout.distance_km,
          workout.active_energy_kcal,
          workout.avg_heart_rate,
          workout.max_heart_rate,
          workout.elevation_up_m,
          workout.heart_rate_data,
          workout.heart_rate_recovery,
          workout.zone1_seconds,
          workout.zone2_seconds,
          workout.zone3_seconds,
          workout.zone4_seconds,
          workout.zone5_seconds,
          workout.avg_pace_min_per_km,
          workout.dedup_key,
          workout.hae_id
        );
        continue;
      }
    } else {
      const existing = selectByTypeStart.get(workout.workout_type, workout.start_time);
      if (existing) {
        updateByTypeStart.run(
          workout.end_time,
          workout.duration_seconds,
          workout.distance_km,
          workout.active_energy_kcal,
          workout.avg_heart_rate,
          workout.max_heart_rate,
          workout.elevation_up_m,
          workout.heart_rate_data,
          workout.heart_rate_recovery,
          workout.zone1_seconds,
          workout.zone2_seconds,
          workout.zone3_seconds,
          workout.zone4_seconds,
          workout.zone5_seconds,
          workout.avg_pace_min_per_km,
          workout.dedup_key,
          workout.workout_type,
          workout.start_time
        );
        continue;
      }
    }

    insert.run(
      workout.hae_id,
      workout.workout_type,
      workout.start_time,
      workout.end_time,
      workout.duration_seconds,
      workout.distance_km,
      workout.active_energy_kcal,
      workout.avg_heart_rate,
      workout.max_heart_rate,
      workout.elevation_up_m,
      workout.heart_rate_data,
      workout.heart_rate_recovery,
      workout.zone1_seconds,
      workout.zone2_seconds,
      workout.zone3_seconds,
      workout.zone4_seconds,
      workout.zone5_seconds,
      workout.avg_pace_min_per_km,
      workout.dedup_key
    );
  }
}
