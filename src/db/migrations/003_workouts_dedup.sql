DROP INDEX IF EXISTS idx_workouts_date;
DROP INDEX IF EXISTS idx_workouts_hae_id;
DROP INDEX IF EXISTS idx_workouts_type_start;

ALTER TABLE workouts RENAME TO workouts_old;

CREATE TABLE workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hae_id TEXT,
    workout_type TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration_seconds REAL,
    distance_km REAL,
    active_energy_kcal REAL,
    avg_heart_rate REAL,
    max_heart_rate REAL,
    elevation_up_m REAL,
    heart_rate_data TEXT,
    heart_rate_recovery TEXT,
    zone1_seconds REAL,
    zone2_seconds REAL,
    zone3_seconds REAL,
    zone4_seconds REAL,
    zone5_seconds REAL,
    avg_pace_min_per_km REAL,
    ingested_at TEXT NOT NULL DEFAULT (datetime('now')),
    dedup_key TEXT NOT NULL UNIQUE
);

INSERT INTO workouts (
  id, hae_id, workout_type, start_time, end_time, duration_seconds, distance_km,
  active_energy_kcal, avg_heart_rate, max_heart_rate, elevation_up_m,
  heart_rate_data, heart_rate_recovery, zone1_seconds, zone2_seconds, zone3_seconds,
  zone4_seconds, zone5_seconds, avg_pace_min_per_km, ingested_at, dedup_key
)
SELECT
  id, hae_id, workout_type, start_time, end_time, duration_seconds, distance_km,
  active_energy_kcal, avg_heart_rate, max_heart_rate, elevation_up_m,
  heart_rate_data, heart_rate_recovery, zone1_seconds, zone2_seconds, zone3_seconds,
  zone4_seconds, zone5_seconds, avg_pace_min_per_km, ingested_at,
  CASE
    WHEN hae_id IS NOT NULL THEN 'hae:' || hae_id
    ELSE 'fallback:' || workout_type || ':' || start_time
  END
FROM workouts_old;

DROP TABLE workouts_old;

CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(start_time);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workouts_hae_id
ON workouts(hae_id)
WHERE hae_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_workouts_type_start
ON workouts(workout_type, start_time)
WHERE hae_id IS NULL;
