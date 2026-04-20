import type { AppDatabase } from "./db.js";
import type { NormalizedHealthSample, NormalizedSleepSession, NormalizedWorkout } from "../ingester/types.js";

export function insertSamples(db: AppDatabase, samples: NormalizedHealthSample[]): void {
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

export function insertSleepSessions(db: AppDatabase, sessions: NormalizedSleepSession[]): void {
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

export function insertWorkouts(db: AppDatabase, workouts: NormalizedWorkout[]): void {
  const statement = db.prepare(`
    INSERT INTO workouts (
      hae_id, workout_type, start_time, end_time, duration_seconds, distance_km,
      active_energy_kcal, avg_heart_rate, max_heart_rate, elevation_up_m,
      heart_rate_data, heart_rate_recovery, zone1_seconds, zone2_seconds, zone3_seconds,
      zone4_seconds, zone5_seconds, avg_pace_min_per_km, dedup_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(dedup_key)
    DO UPDATE SET
      workout_type = excluded.workout_type,
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      duration_seconds = excluded.duration_seconds,
      distance_km = excluded.distance_km,
      active_energy_kcal = excluded.active_energy_kcal,
      avg_heart_rate = excluded.avg_heart_rate,
      max_heart_rate = excluded.max_heart_rate,
      elevation_up_m = excluded.elevation_up_m,
      heart_rate_data = excluded.heart_rate_data,
      heart_rate_recovery = excluded.heart_rate_recovery,
      zone1_seconds = excluded.zone1_seconds,
      zone2_seconds = excluded.zone2_seconds,
      zone3_seconds = excluded.zone3_seconds,
      zone4_seconds = excluded.zone4_seconds,
      zone5_seconds = excluded.zone5_seconds,
      avg_pace_min_per_km = excluded.avg_pace_min_per_km
  `);

  for (const workout of workouts) {
    statement.run(
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
