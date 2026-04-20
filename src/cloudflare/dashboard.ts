import { rangeDays, rangeStart } from "../server/dates.js";
import type { AppConfig } from "./config.js";
import type { DashboardCardPayload, DashboardPayload, TimeRange } from "../server/types.js";
import { computeTrend } from "../evidence/trends.js";
import { getSyncStatus } from "./sync-status.js";
import { addDays, format, subDays } from "date-fns";
import type { AppDatabase } from "./db.js";

export function getDashboardPayload(db: AppDatabase, config: AppConfig, range: TimeRange): DashboardPayload {
  const sync = getSyncStatus(db, config);
  const comparisonDays = rangeDays(range);

  return {
    range,
    sync,
    cards: [
      sleepCard(db, range, comparisonDays, sync.stale),
      metricCard(db, range, sync.stale, {
        id: "hrv",
        title: "HRV",
        accent: "#64D2FF",
        metricName: "heart_rate_variability",
        unitSuffix: "ms",
        comparisonDays,
        preferLower: false
      }),
      metricCard(db, range, sync.stale, {
        id: "resting-hr",
        title: "Resting HR",
        accent: "#FF453A",
        metricName: "resting_heart_rate",
        unitSuffix: "bpm",
        comparisonDays,
        preferLower: true
      }),
      metricCard(db, range, sync.stale, {
        id: "vo2",
        title: "VO2 Max",
        accent: "#5AC8FA",
        metricName: "vo2_max",
        unitSuffix: "mL/min·kg",
        comparisonDays,
        preferLower: false
      }),
      stepsCard(db, range, comparisonDays, sync.stale),
      workoutCard(db, range, comparisonDays, sync.stale)
    ]
  };
}

function sleepCard(db: AppDatabase, range: TimeRange, comparisonDays: number, stale: boolean): DashboardCardPayload {
  const start = rangeStart(range);
  const currentStartDate = format(start, "yyyy-MM-dd");
  const previousStartDate = format(subDays(start, comparisonDays), "yyyy-MM-dd");
  const previousEndDate = format(subDays(start, 1), "yyyy-MM-dd");
  const latest = db.prepare(`
    SELECT date, total_sleep_hours
    FROM sleep_sessions
    WHERE date >= ?
    ORDER BY date DESC
    LIMIT 1
  `).get(currentStartDate) as { date: string; total_sleep_hours: number | null } | undefined;

  const baseline = db.prepare(`
    SELECT AVG(total_sleep_hours) as avg
    FROM sleep_sessions
    WHERE date >= ? AND date <= ?
  `).get(previousStartDate, previousEndDate) as { avg: number | null } | undefined;

  const sparkline = (db.prepare(`
    SELECT date, total_sleep_hours as value
    FROM sleep_sessions
    WHERE date >= ?
    ORDER BY date
  `).all(currentStartDate) as Array<{ date: string; value: number | null }>)
    .filter((row) => typeof row.value === "number")
    .map((row) => ({ date: row.date, value: row.value! }));

  if (!latest || latest.total_sleep_hours === null) {
    return emptyCard("sleep", "Sleep", "#5E5CE6", stale, "No sleep data yet.");
  }

  const trend = computeTrend(latest.total_sleep_hours, baseline?.avg ?? null);
  return {
    id: "sleep",
    title: "Sleep",
    accent: "#5E5CE6",
    primary: `${latest.total_sleep_hours.toFixed(1)}h`,
    secondary: `Night of ${latest.date}`,
    trend: trend.trend,
    deltaLabel: baseline?.avg === null ? "—" : formatDelta(trend.delta, "h"),
    deltaBasis: `vs previous ${windowLabel(comparisonDays)}`,
    sparkline,
    status: stale ? "stale" : "ok"
  };
}

function metricCard(
  db: AppDatabase,
  range: TimeRange,
  stale: boolean,
  options: {
    id: string;
    title: string;
    accent: string;
    metricName: string;
    unitSuffix: string;
    comparisonDays: number;
    preferLower: boolean;
  }
): DashboardCardPayload {
  const start = rangeStart(range);
  const currentStartDate = format(start, "yyyy-MM-dd");
  const previousStartDate = format(subDays(start, options.comparisonDays), "yyyy-MM-dd");
  const previousEndDate = format(subDays(start, 1), "yyyy-MM-dd");
  const latest = db.prepare(`
    SELECT value, COALESCE(timestamp_end_local, timestamp_local) as timestamp_local
    FROM health_samples
    WHERE metric_name = ?
      AND substr(COALESCE(timestamp_end_local, timestamp_local), 1, 10) >= ?
    ORDER BY COALESCE(timestamp_end_utc, timestamp_utc) DESC
    LIMIT 1
  `).get(options.metricName, currentStartDate) as { value: number; timestamp_local: string } | undefined;

  if (!latest) {
    return emptyCard(options.id, options.title, options.accent, stale, "No data yet.");
  }

  const baseline = db.prepare(`
    SELECT AVG(avg_value) as avg
    FROM daily_aggregates
    WHERE metric_name = ?
      AND date >= ?
      AND date <= ?
  `).get(options.metricName, previousStartDate, previousEndDate) as { avg: number | null } | undefined;

  const sparkline = (db.prepare(`
    SELECT date, avg_value as value
    FROM daily_aggregates
    WHERE metric_name = ? AND date >= ?
    ORDER BY date
  `).all(options.metricName, currentStartDate) as Array<{ date: string; value: number | null }>)
    .filter((row) => typeof row.value === "number")
    .map((row) => ({ date: row.date, value: row.value! }));

  const trend = computeTrend(latest.value, baseline?.avg ?? null, options.preferLower);
  return {
    id: options.id,
    title: options.title,
    accent: options.accent,
    primary: `${latest.value.toFixed(1)} ${options.unitSuffix}`,
    secondary: latest.timestamp_local.slice(0, 10),
    trend: trend.trend,
    deltaLabel: trend.deltaPct !== null ? `${trend.deltaPct > 0 ? "+" : ""}${trend.deltaPct}%` : "—",
    deltaBasis: `vs previous ${windowLabel(options.comparisonDays)}`,
    sparkline,
    status: stale ? "stale" : "ok"
  };
}

function stepsCard(db: AppDatabase, range: TimeRange, comparisonDays: number, stale: boolean): DashboardCardPayload {
  const start = rangeStart(range);
  const currentStartDate = format(start, "yyyy-MM-dd");
  const previousStartDate = format(subDays(start, comparisonDays), "yyyy-MM-dd");
  const previousEndDate = format(subDays(start, 1), "yyyy-MM-dd");
  const latest = db.prepare(`
    SELECT date, sum_value
    FROM daily_aggregates
    WHERE metric_name = 'step_count'
      AND date >= ?
    ORDER BY date DESC
    LIMIT 1
  `).get(currentStartDate) as { date: string; sum_value: number | null } | undefined;

  if (!latest || latest.sum_value === null) {
    return emptyCard("steps", "Steps", "#30D158", stale, "No step data yet.");
  }

  const baseline = db.prepare(`
    SELECT AVG(sum_value) as avg
    FROM daily_aggregates
    WHERE metric_name = 'step_count'
      AND date >= ?
      AND date <= ?
  `).get(previousStartDate, previousEndDate) as { avg: number | null } | undefined;

  const sparkline = (db.prepare(`
    SELECT date, sum_value as value
    FROM daily_aggregates
    WHERE metric_name = 'step_count' AND date >= ?
    ORDER BY date
  `).all(currentStartDate) as Array<{ date: string; value: number | null }>)
    .filter((row) => typeof row.value === "number")
    .map((row) => ({ date: row.date, value: row.value! }));

  const trend = computeTrend(latest.sum_value, baseline?.avg ?? null);
  return {
    id: "steps",
    title: "Steps",
    accent: "#30D158",
    primary: Math.round(latest.sum_value).toLocaleString(),
    secondary: latest.date,
    trend: trend.trend,
    deltaLabel: trend.deltaPct !== null ? `${trend.deltaPct > 0 ? "+" : ""}${trend.deltaPct}%` : "—",
    deltaBasis: `vs previous ${windowLabel(comparisonDays)}`,
    sparkline,
    status: stale ? "stale" : "ok"
  };
}

function workoutCard(db: AppDatabase, range: TimeRange, comparisonDays: number, stale: boolean): DashboardCardPayload {
  const start = rangeStart(range);
  const currentStartDate = format(start, "yyyy-MM-dd");
  const currentEndDate = format(new Date(), "yyyy-MM-dd");
  const previousStartDate = format(subDays(start, comparisonDays), "yyyy-MM-dd");
  const previousEndDate = format(subDays(start, 1), "yyyy-MM-dd");
  const current = db.prepare(`
    SELECT
      COUNT(*) as count,
      SUM(duration_seconds) as durationSeconds,
      SUM(CASE WHEN workout_type = 'Running' THEN distance_km ELSE 0 END) as runningKm
    FROM workouts
    WHERE substr(start_time, 1, 10) >= ? AND substr(start_time, 1, 10) <= ?
  `).get(currentStartDate, currentEndDate) as {
    count: number;
    durationSeconds: number | null;
    runningKm: number | null;
  } | undefined;

  if (!current || current.count === 0) {
    return emptyCard("workouts", "Workouts", "#FF375F", stale, "No workouts in this range.");
  }

  const previous = db.prepare(`
    SELECT COUNT(*) as count
    FROM workouts
    WHERE substr(start_time, 1, 10) >= ? AND substr(start_time, 1, 10) <= ?
  `).get(previousStartDate, previousEndDate) as { count: number } | undefined;

  const latest = db.prepare(`
    SELECT workout_type, start_time, duration_seconds
    FROM workouts
    WHERE substr(start_time, 1, 10) >= ? AND substr(start_time, 1, 10) <= ?
    ORDER BY start_time DESC
    LIMIT 1
  `).get(currentStartDate, currentEndDate) as {
    workout_type: string;
    start_time: string;
    duration_seconds: number | null;
  } | undefined;

  const workoutDays = db.prepare(`
    SELECT substr(start_time, 1, 10) as date, COUNT(*) as value
    FROM workouts
    WHERE substr(start_time, 1, 10) >= ? AND substr(start_time, 1, 10) <= ?
    GROUP BY substr(start_time, 1, 10)
    ORDER BY date
  `).all(currentStartDate, currentEndDate) as Array<{ date: string; value: number }>;

  const sparkline = fillDailySeries(currentStartDate, currentEndDate, workoutDays);
  const trend = computeTrend(current.count, previous?.count ?? null);

  const secondary = [
    current.durationSeconds ? `${formatDurationTotal(current.durationSeconds)} total` : null,
    current.runningKm ? `${current.runningKm.toFixed(1)} km running` : null,
    latest ? `latest ${latest.workout_type.toLowerCase()} ${latest.start_time.slice(5, 10)}` : null
  ].filter(Boolean).join(" • ");

  return {
    id: "workouts",
    title: "Workouts",
    accent: "#FF375F",
    primary: `${current.count} ${current.count === 1 ? "workout" : "workouts"}`,
    secondary,
    trend: trend.trend,
    deltaLabel:
      trend.deltaPct !== null
        ? `${trend.deltaPct > 0 ? "+" : ""}${trend.deltaPct}%`
        : `${current.count - (previous?.count ?? 0) >= 0 ? "+" : ""}${current.count - (previous?.count ?? 0)}`,
    deltaBasis: `vs previous ${windowLabel(comparisonDays)}`,
    sparkline,
    status: stale ? "stale" : "ok"
  };
}

function fillDailySeries(startDate: string, endDate: string, rows: Array<{ date: string; value: number }>) {
  const byDate = new Map(rows.map((row) => [row.date, row.value]));
  const series: Array<{ date: string; value: number }> = [];
  let cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  while (cursor <= end) {
    const date = format(cursor, "yyyy-MM-dd");
    series.push({ date, value: byDate.get(date) ?? 0 });
    cursor = addDays(cursor, 1);
  }

  return series;
}

function formatDurationTotal(seconds: number) {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes} min`;
}

function emptyCard(
  id: string,
  title: string,
  accent: string,
  stale: boolean,
  message: string
): DashboardCardPayload {
  return {
    id,
    title,
    accent,
    primary: "—",
    secondary: message,
    trend: "flat",
    deltaLabel: "—",
    deltaBasis: `vs previous ${windowLabel(30)}`,
    sparkline: [],
    status: stale ? "stale" : "empty"
  };
}

function windowLabel(days: number): string {
  return days === 1 ? "day" : `${days} days`;
}

function formatDelta(delta: number, unit: string): string {
  return `${delta > 0 ? "+" : ""}${delta.toFixed(1)}${unit}`;
}
