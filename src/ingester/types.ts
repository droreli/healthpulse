export type HaeFileType = "metrics" | "workouts" | "apple_xml";

export interface ParsedMetricSeries {
  name: string;
  units: string;
  data: Array<Record<string, unknown>>;
}

export interface ParsedMetricsFile {
  type: "metrics";
  metrics: ParsedMetricSeries[];
}

export interface ParsedWorkoutRecord {
  id?: string;
  name?: string;
  start?: string;
  end?: string;
  duration?: number;
  activeEnergyBurned?: { qty?: number; units?: string };
  distance?: { qty?: number; units?: string };
  avgHeartRate?: { qty?: number; units?: string };
  maxHeartRate?: { qty?: number; units?: string };
  heartRateData?: Array<Record<string, unknown>>;
  heartRateRecovery?: Array<Record<string, unknown>>;
  elevationUp?: { qty?: number; units?: string };
}

export interface ParsedWorkoutsFile {
  type: "workouts";
  workouts: ParsedWorkoutRecord[];
}

export type ParsedHaeFile = ParsedMetricsFile | ParsedWorkoutsFile;

export interface IngestWarning {
  level: "warn" | "error";
  message: string;
}

export interface NormalizedHealthSample {
  metric_name: string;
  value: number;
  value_min: number | null;
  value_max: number | null;
  unit: string;
  timestamp_utc: string;
  timestamp_local: string;
  timestamp_end_utc: string | null;
  timestamp_end_local: string | null;
  source: string;
  dedup_key: string;
}

export interface NormalizedSleepSession {
  date: string;
  total_sleep_hours: number | null;
  asleep_hours: number | null;
  core_hours: number | null;
  deep_hours: number | null;
  rem_hours: number | null;
  in_bed_hours: number | null;
  sleep_start: string | null;
  sleep_end: string | null;
  in_bed_start: string | null;
  in_bed_end: string | null;
  sleep_efficiency: number | null;
  deep_pct: number | null;
  rem_pct: number | null;
  core_pct: number | null;
  awake_minutes: number | null;
}

export interface WorkoutZoneTotals {
  zone1: number;
  zone2: number;
  zone3: number;
  zone4: number;
  zone5: number;
}

export interface NormalizedWorkout {
  hae_id: string | null;
  workout_type: string;
  start_time: string;
  end_time: string;
  duration_seconds: number | null;
  distance_km: number | null;
  active_energy_kcal: number | null;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  elevation_up_m: number | null;
  heart_rate_data: string | null;
  heart_rate_recovery: string | null;
  zone1_seconds: number | null;
  zone2_seconds: number | null;
  zone3_seconds: number | null;
  zone4_seconds: number | null;
  zone5_seconds: number | null;
  avg_pace_min_per_km: number | null;
  dedup_key: string;
}

export interface NormalizedFile {
  samples: NormalizedHealthSample[];
  sleepSessions: NormalizedSleepSession[];
  workouts: NormalizedWorkout[];
  warnings: IngestWarning[];
}

export interface IngestResult {
  filePath: string;
  fileType: HaeFileType;
  hash: string;
  skipped: boolean;
  recordsIngested: number;
  warnings: IngestWarning[];
}
