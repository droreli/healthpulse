export const DEFAULT_CONFIG = {
  data_source_mode: "apple_xml_manual",
  metrics_folder: "",
  workouts_folder: "",
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

