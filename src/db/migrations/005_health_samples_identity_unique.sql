DROP INDEX IF EXISTS idx_samples_metric_ts;
DROP INDEX IF EXISTS idx_samples_ts;

ALTER TABLE health_samples RENAME TO health_samples_old_005;

CREATE TABLE health_samples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_name TEXT NOT NULL,
    value REAL NOT NULL,
    value_min REAL,
    value_max REAL,
    unit TEXT NOT NULL,
    timestamp_utc TEXT NOT NULL,
    timestamp_local TEXT NOT NULL,
    timestamp_end_utc TEXT,
    timestamp_end_local TEXT,
    source TEXT NOT NULL DEFAULT 'Health Auto Export',
    dedup_key TEXT NOT NULL UNIQUE,
    ingested_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(metric_name, timestamp_utc, source)
);

INSERT OR IGNORE INTO health_samples (
  id, metric_name, value, value_min, value_max, unit, timestamp_utc, timestamp_local,
  timestamp_end_utc, timestamp_end_local, source, dedup_key, ingested_at
)
SELECT
  id,
  metric_name,
  value,
  value_min,
  value_max,
  unit,
  timestamp_utc,
  timestamp_local,
  timestamp_end_utc,
  timestamp_end_local,
  source,
  dedup_key,
  ingested_at
FROM health_samples_old_005
ORDER BY id DESC;

DROP TABLE health_samples_old_005;

CREATE INDEX IF NOT EXISTS idx_samples_metric_ts ON health_samples(metric_name, timestamp_utc);
CREATE INDEX IF NOT EXISTS idx_samples_ts ON health_samples(timestamp_utc);
