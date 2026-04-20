export const ACCOUNT_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS account (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    username_key TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS health_samples (
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

CREATE TABLE IF NOT EXISTS sleep_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    total_sleep_hours REAL,
    asleep_hours REAL,
    core_hours REAL,
    deep_hours REAL,
    rem_hours REAL,
    in_bed_hours REAL,
    sleep_start TEXT,
    sleep_end TEXT,
    in_bed_start TEXT,
    in_bed_end TEXT,
    sleep_efficiency REAL,
    deep_pct REAL,
    rem_pct REAL,
    core_pct REAL,
    awake_minutes REAL,
    ingested_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workouts (
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

CREATE TABLE IF NOT EXISTS daily_aggregates (
    date TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    avg_value REAL,
    min_value REAL,
    max_value REAL,
    sum_value REAL,
    sample_count INTEGER,
    PRIMARY KEY (date, metric_name)
);

CREATE TABLE IF NOT EXISTS moving_averages (
    date TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    window_days INTEGER NOT NULL,
    avg_value REAL,
    std_dev REAL,
    sample_count INTEGER,
    PRIMARY KEY (date, metric_name, window_days)
);

CREATE TABLE IF NOT EXISTS evidence_insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    insight_type TEXT NOT NULL,
    metric_a TEXT NOT NULL,
    metric_b TEXT,
    direction TEXT,
    magnitude REAL,
    date_window_start TEXT,
    date_window_end TEXT,
    sample_count INTEGER NOT NULL,
    method TEXT NOT NULL,
    confidence REAL,
    p_value REAL,
    confounders_noted TEXT,
    explanation TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_narratives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    narrative_type TEXT NOT NULL,
    evidence_insight_ids TEXT NOT NULL,
    content TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filepath TEXT NOT NULL,
    file_hash TEXT NOT NULL UNIQUE,
    file_type TEXT NOT NULL,
    records_ingested INTEGER,
    ingested_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS annotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    kind TEXT NOT NULL,
    label TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS import_jobs (
    id TEXT PRIMARY KEY,
    file_name TEXT NOT NULL,
    status TEXT NOT NULL,
    result_json TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workouts_hae_id
ON workouts(hae_id)
WHERE hae_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workouts_type_start
ON workouts(workout_type, start_time)
WHERE hae_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_samples_metric_ts ON health_samples(metric_name, timestamp_utc);
CREATE INDEX IF NOT EXISTS idx_samples_ts ON health_samples(timestamp_utc);
CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_aggregates(date);
CREATE INDEX IF NOT EXISTS idx_daily_metric ON daily_aggregates(metric_name, date);
CREATE INDEX IF NOT EXISTS idx_ma_metric ON moving_averages(metric_name, date);
CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(start_time);
CREATE INDEX IF NOT EXISTS idx_sleep_date ON sleep_sessions(date);
CREATE INDEX IF NOT EXISTS idx_evidence_date ON evidence_insights(date);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_annotations_date ON annotations(date DESC, created_at DESC);
`;
