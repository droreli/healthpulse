export type TimeRange = "1d" | "7d" | "14d" | "30d" | "90d" | "180d" | "1y";

export type TrendDirection = "up" | "down" | "flat";

export interface SyncFolderStatus {
  path: string;
  exists: boolean;
  fileCount: number;
}

export interface SyncStatusPayload {
  mode: "apple_xml_manual" | "hae_json_auto";
  metricsFolder: SyncFolderStatus;
  workoutsFolder: SyncFolderStatus;
  lastSyncedAt: string | null;
  latestDataTimestamp: string | null;
  stale: boolean;
  status: "healthy" | "warning" | "stale" | "missing";
  issues: string[];
  processedFiles: number;
}

export interface AppleImportPayload {
  skipped: boolean;
  importMode: "apple_xml_manual";
  fileName: string;
  recordsIngested: number;
  samplesIngested: number;
  workoutsIngested: number;
  sleepSessionsUpdated: number;
  exportDate: string | null;
  cutoffDate: string | null;
  warnings: string[];
}

export interface AppleImportJobPayload {
  jobId: string;
  fileName: string;
  status: "queued" | "running" | "completed" | "failed";
  result?: AppleImportPayload;
  error?: string;
}

export interface SparklinePoint {
  date: string;
  value: number;
}

export interface DashboardCardPayload {
  id: string;
  title: string;
  accent: string;
  primary: string;
  secondary: string;
  trend: TrendDirection;
  deltaLabel: string;
  deltaBasis: string;
  sparkline: SparklinePoint[];
  status: "ok" | "empty" | "stale";
}

export interface DashboardPayload {
  range: TimeRange;
  cards: DashboardCardPayload[];
  sync: SyncStatusPayload;
}
