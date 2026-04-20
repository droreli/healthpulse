import path from "node:path";
import os from "node:os";

export const DEFAULT_DATA_DIR = path.join(os.homedir(), ".healthpulse");
export const DEFAULT_DB_PATH = path.join(DEFAULT_DATA_DIR, "data.db");
export const DEFAULT_METRICS_FOLDER = path.join(
  os.homedir(),
  "Library",
  "Mobile Documents",
  "com~apple~CloudDocs",
  "Health Auto Export",
  "HealthPulse Metrics"
);
export const DEFAULT_WORKOUTS_FOLDER = path.join(
  os.homedir(),
  "Library",
  "Mobile Documents",
  "com~apple~CloudDocs",
  "Health Auto Export",
  "HealthPulse Workouts"
);

export const DEFAULT_CONFIG = {
  data_source_mode: "apple_xml_manual",
  metrics_folder: DEFAULT_METRICS_FOLDER,
  workouts_folder: DEFAULT_WORKOUTS_FOLDER,
  max_heart_rate: 179,
  zone2_lower_pct: 60,
  zone2_upper_pct: 70,
  sleep_goal_hours: 7.5
} as const;

export type ConfigKey = keyof typeof DEFAULT_CONFIG;

export interface AppConfig {
  data_source_mode: "apple_xml_manual" | "hae_json_auto";
  metrics_folder: string;
  workouts_folder: string;
  max_heart_rate: number;
  zone2_lower_pct: number;
  zone2_upper_pct: number;
  sleep_goal_hours: number;
}

export const STALE_SYNC_HOURS = 6;
export const STALE_IMPORT_DAYS = 14;
