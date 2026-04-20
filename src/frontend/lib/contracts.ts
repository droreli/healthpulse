import type { AppleImportJobPayload, AppleImportPayload, DashboardPayload, SyncStatusPayload, TimeRange } from "../../server/types.js";

export type { AppleImportJobPayload, AppleImportPayload, DashboardPayload, SyncStatusPayload, TimeRange };

export interface SleepPayload {
  range: TimeRange;
  sessions: Array<{
    date: string;
    total_sleep_hours: number | null;
    asleep_hours: number | null;
    core_hours: number | null;
    deep_hours: number | null;
    rem_hours: number | null;
    in_bed_hours: number | null;
    sleep_efficiency: number | null;
    deep_pct: number | null;
    rem_pct: number | null;
    core_pct: number | null;
    sleep_start: string | null;
    asleep_minutes: number | null;
    core_minutes: number | null;
    deep_minutes: number | null;
    rem_minutes: number | null;
    in_bed_minutes: number | null;
    awake_minutes: number | null;
    sleep_score: number | null;
  }>;
  benchmarks: {
    deepPct: string;
    remPct: string;
    sleepEfficiency: string;
  };
  summary: {
    avgDuration: number | null;
    avgEfficiency: number | null;
    avgSleepScore: number | null;
    sleepMetricLabel: string;
    sleepMetricSource: "score" | "unavailable";
    bedtimeConsistencyMinutes: number | null;
  };
}

export interface WorkoutsPayload {
  range: TimeRange;
  workouts: Array<Record<string, unknown>>;
  heatmap: Array<{ date: string; count: number }>;
  weeklyRunning: Array<{
    date: string;
    weekStart: string;
    weekEnd: string;
    label: string;
    totalKm: number;
  }>;
}

export interface HeartPayload {
  range: TimeRange;
  series: {
    hrv: Array<Record<string, unknown>>;
    restingHr: Array<Record<string, unknown>>;
    vo2: Array<Record<string, unknown>>;
  };
  recovery: {
    score: number;
    label: string;
    color: string;
    basis: string;
    degraded: boolean;
    degradedNote?: string;
  };
  vo2Bands: Array<{ label: string; min: number }>;
}

export interface WeeklyReviewPayload {
  week: string;
  recovery: {
    hrvAverage: number | null;
    hrvTrend: { trend: "up" | "down" | "flat"; delta: number; deltaPct: number | null };
    restingHrAverage: number | null;
    restingHrTrend: { trend: "up" | "down" | "flat"; delta: number; deltaPct: number | null };
    days: Array<{ date: string; hrv: number | null; restingHr: number | null }>;
  };
  sleep: {
    avgDuration: number | null;
    avgEfficiency: number | null;
    avgSleepScore: number | null;
    sleepMetricLabel: string;
    sleepMetricSource: "score" | "unavailable";
    deepPct: number | null;
    remPct: number | null;
    bedtimeConsistencyMinutes: number | null;
    nights: Array<{ date: string; duration: number | null; efficiency: number | null; sleepScore: number | null; deepPct: number | null; remPct: number | null }>;
  };
  training: {
    sessions: number;
    runningKm: number | null;
    runningTrend: { trend: "up" | "down" | "flat"; delta: number; deltaPct: number | null };
    zone2Pct: number | null;
    days: Array<{ date: string; sessions: number; runningKm: number | null; zone2Pct: number | null }>;
  };
  insights: Array<{
    title: string;
    status: "pass" | "warn" | "neutral";
    value: string;
    detail: string;
  }>;
  takeaway: {
    improved: string;
    declined: string;
    likelyCause: string;
    nextAction: string;
  };
}
