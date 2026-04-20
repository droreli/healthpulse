import { addDays, format, parse, parseISO, startOfWeek, subWeeks } from "date-fns";
import type Database from "better-sqlite3";
import type { AppConfig } from "../server/config.js";
import { loadSleepScoreSummary } from "./sleep-score.js";
import { sleepGoalInsight, zone2Insight, type ThresholdInsight } from "./thresholds.js";
import { computeTrend } from "./trends.js";

export interface WeeklyTakeaway {
  improved: string;
  declined: string;
  likelyCause: string;
  nextAction: string;
}

export interface WeeklyReviewPayload {
  week: string;
  recovery: {
    hrvAverage: number | null;
    hrvTrend: ReturnType<typeof computeTrend>;
    restingHrAverage: number | null;
    restingHrTrend: ReturnType<typeof computeTrend>;
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
    runningTrend: ReturnType<typeof computeTrend>;
    zone2Pct: number | null;
    days: Array<{ date: string; sessions: number; runningKm: number | null; zone2Pct: number | null }>;
  };
  insights: ThresholdInsight[];
  takeaway: WeeklyTakeaway;
}

export function buildWeeklyReview(db: Database.Database, config: AppConfig, week?: string): WeeklyReviewPayload {
  const resolvedWeek = week ?? format(startOfWeek(new Date(), { weekStartsOn: 1 }), "RRRR-'W'II");
  const weekStart = parseWeekStart(resolvedWeek);
  const weekStartDate = format(weekStart, "yyyy-MM-dd");
  const weekEnd = format(addDays(weekStart, 6), "yyyy-MM-dd");
  const visibleEndDate = minIsoDate(weekEnd, format(new Date(), "yyyy-MM-dd"));
  const previousWeekStart = format(subWeeks(weekStart, 1), "yyyy-MM-dd");
  const previousWeekEnd = format(addDays(subWeeks(weekStart, 1), 6), "yyyy-MM-dd");
  const weekRows = db.prepare(`
    SELECT *
    FROM sleep_sessions
    WHERE date BETWEEN ? AND ?
    ORDER BY date
  `).all(format(weekStart, "yyyy-MM-dd"), weekEnd) as Array<{
    date: string;
    total_sleep_hours: number | null;
    sleep_efficiency: number | null;
    deep_pct: number | null;
    rem_pct: number | null;
    sleep_start: string | null;
  }>;
  const sleepScore = loadSleepScoreSummary(db, weekStartDate, visibleEndDate);
  const recoveryDays = recoveryDaysForWeek(db, weekStartDate, visibleEndDate);
  const trainingDays = trainingDaysForWindow(db, weekStartDate, visibleEndDate);
  const previousTrainingDays = trainingDaysForWindow(db, previousWeekStart, previousWeekEnd);

  const hrvAverage = averageMetricForWeek(db, "heart_rate_variability", weekStartDate, weekEnd);
  const hrvPrevious = averageMetricForWeek(db, "heart_rate_variability", previousWeekStart, previousWeekEnd);
  const rhrAverage = averageMetricForWeek(db, "resting_heart_rate", weekStartDate, weekEnd);
  const rhrPrevious = averageMetricForWeek(db, "resting_heart_rate", previousWeekStart, previousWeekEnd);
  const runningKm = sumRunningKm(trainingDays);
  const previousRunningKm = sumRunningKm(previousTrainingDays);
  const zone2Pct = zone2PctForWindow(trainingDays);

  const avgSleep = average(weekRows.map((row) => row.total_sleep_hours).filter(isNumber));
  const avgSleepEfficiency = average(weekRows.map((row) => row.sleep_efficiency).filter(isNumber));
  const avgDeep = average(weekRows.map((row) => row.deep_pct).filter(isNumber));
  const avgRem = average(weekRows.map((row) => row.rem_pct).filter(isNumber));
  const bedtimeConsistencyMinutes = bedtimeStdDevMinutes(
    weekRows.map((row) => row.sleep_start).filter((value): value is string => Boolean(value))
  );

  const sleepInsight = sleepGoalInsight(avgSleep, config.sleep_goal_hours);
  const zoneInsight = zone2Insight(zone2Pct);
  const runningTrend = computeTrend(runningKm, previousRunningKm);
  const hrvTrend = computeTrend(hrvAverage, hrvPrevious);
  const rhrTrend = computeTrend(rhrAverage, rhrPrevious, true);

  return {
    week: resolvedWeek,
    recovery: {
      hrvAverage,
      hrvTrend,
      restingHrAverage: rhrAverage,
      restingHrTrend: rhrTrend,
      days: recoveryDays
    },
    sleep: {
      avgDuration: avgSleep,
      avgEfficiency: avgSleepEfficiency,
      avgSleepScore: average(weekRows.map((row) => sleepScore.valuesByDate.get(row.date)).filter(isFiniteNumber)),
      sleepMetricLabel: sleepScore.label,
      sleepMetricSource: sleepScore.source,
      deepPct: avgDeep,
      remPct: avgRem,
      bedtimeConsistencyMinutes,
      nights: weekRows.map((row) => ({
        date: row.date,
        duration: row.total_sleep_hours,
        efficiency: row.sleep_efficiency,
        sleepScore: sleepScore.valuesByDate.get(row.date) ?? null,
        deepPct: row.deep_pct,
        remPct: row.rem_pct
      }))
    },
    training: {
      sessions: trainingDays.reduce((total, day) => total + day.sessions, 0),
      runningKm,
      runningTrend,
      zone2Pct,
      days: trainingDays.map(({ date, sessions, runningKm: dayRunningKm, zone2Pct: dayZone2Pct }) => ({
        date,
        sessions,
        runningKm: dayRunningKm,
        zone2Pct: dayZone2Pct
      }))
    },
    insights: [sleepInsight, zoneInsight],
    takeaway: buildTakeaway({ hrvTrend, rhrTrend, runningTrend, sleepInsight, zoneInsight, weekRows })
  };
}

function buildTakeaway(input: {
  hrvTrend: ReturnType<typeof computeTrend>;
  rhrTrend: ReturnType<typeof computeTrend>;
  runningTrend: ReturnType<typeof computeTrend>;
  sleepInsight: ThresholdInsight;
  zoneInsight: ThresholdInsight;
  weekRows: Array<{ date: string; total_sleep_hours: number | null; deep_pct: number | null }>;
}): WeeklyTakeaway {
  const improved =
    input.sleepInsight.status === "pass"
      ? `Sleep met target at ${input.sleepInsight.value}.`
      : `Training volume ${input.runningTrend.deltaPct ? `${input.runningTrend.deltaPct}%` : "held steady"} vs last week.`;
  const declined =
    input.rhrTrend.trend === "down"
      ? "Resting HR moved higher than the prior week."
      : input.zoneInsight.status === "warn"
        ? `Zone 2 time landed at ${input.zoneInsight.value}.`
        : "No clear decline detected.";

  const worstNight = [...input.weekRows]
    .filter((row) => row.total_sleep_hours !== null)
    .sort((a, b) => (a.total_sleep_hours ?? Number.POSITIVE_INFINITY) - (b.total_sleep_hours ?? Number.POSITIVE_INFINITY))[0];

  const likelyCause =
    worstNight && worstNight.total_sleep_hours !== null
      ? `Sleep dipped most on ${worstNight.date} at ${worstNight.total_sleep_hours.toFixed(1)}h; review training load and bedtime that day.`
      : "Need more complete sleep and workout coverage before identifying a likely cause.";

  const nextAction =
    input.zoneInsight.status === "warn"
      ? "Keep easy runs below Zone 3 and target at least 70% Zone 2 time next week."
      : input.sleepInsight.status === "warn"
        ? "Add 15-30 minutes to your planned sleep window on at least 5 nights next week."
        : "Repeat the same training and sleep pattern next week and re-check the review.";

  return { improved, declined, likelyCause, nextAction };
}

function averageMetricForWeek(db: Database.Database, metric: string, startDate: string, endDate: string): number | null {
  const row = db.prepare(`
    SELECT AVG(avg_value) as value
    FROM daily_aggregates
    WHERE metric_name = ? AND date BETWEEN ? AND ?
  `).get(metric, startDate, endDate) as { value: number | null };

  return row?.value ?? null;
}

function recoveryDaysForWeek(db: Database.Database, startDate: string, endDate: string) {
  const hrvRows = db.prepare(`
    SELECT date, avg_value
    FROM daily_aggregates
    WHERE metric_name = 'heart_rate_variability'
      AND date BETWEEN ? AND ?
    ORDER BY date
  `).all(startDate, endDate) as Array<{ date: string; avg_value: number | null }>;
  const restingHrRows = db.prepare(`
    SELECT date, avg_value
    FROM daily_aggregates
    WHERE metric_name = 'resting_heart_rate'
      AND date BETWEEN ? AND ?
    ORDER BY date
  `).all(startDate, endDate) as Array<{ date: string; avg_value: number | null }>;
  const hrvByDate = new Map(hrvRows.map((row) => [row.date, row.avg_value]));
  const restingHrByDate = new Map(restingHrRows.map((row) => [row.date, row.avg_value]));

  return dateSpan(startDate, endDate).map((date) => ({
    date,
    hrv: hrvByDate.get(date) ?? null,
    restingHr: restingHrByDate.get(date) ?? null
  }));
}

function trainingDaysForWindow(db: Database.Database, startDate: string, endDate: string) {
  const rows = db.prepare(`
    SELECT start_time, end_time, workout_type, distance_km, zone2_seconds, duration_seconds
    FROM workouts
    WHERE substr(start_time, 1, 10) BETWEEN ? AND ?
    ORDER BY start_time
  `).all(startDate, endDate) as Array<{
    start_time: string;
    end_time: string;
    workout_type: string;
    distance_km: number | null;
    zone2_seconds: number | null;
    duration_seconds: number | null;
  }>;

  const byDate = new Map(
    dateSpan(startDate, endDate).map((date) => [
      date,
      { date, sessions: 0, runningKm: 0, runningDurationSeconds: 0, zone2Seconds: 0 }
    ])
  );

  for (const row of rows) {
    const date = row.start_time.slice(0, 10);
    const bucket = byDate.get(date);
    if (!bucket) {
      continue;
    }

    bucket.sessions += 1;

    if (!isRunningWorkout(row.workout_type)) {
      continue;
    }

    const distanceKm = resolvedWorkoutDistanceKm(db, row.start_time, row.end_time, row.distance_km);
    if (distanceKm !== null) {
      bucket.runningKm = Number((bucket.runningKm + distanceKm).toFixed(2));
    }

    if (typeof row.zone2_seconds === "number" && Number.isFinite(row.zone2_seconds)) {
      bucket.zone2Seconds += row.zone2_seconds;
    }
    if (typeof row.duration_seconds === "number" && Number.isFinite(row.duration_seconds) && row.duration_seconds > 0) {
      bucket.runningDurationSeconds += row.duration_seconds;
    }
  }

  return [...byDate.values()].map((day) => ({
    date: day.date,
    sessions: day.sessions,
    runningKm: day.runningKm > 0 ? Number(day.runningKm.toFixed(2)) : null,
    zone2Pct:
      day.runningDurationSeconds > 0 ? Number(((day.zone2Seconds / day.runningDurationSeconds) * 100).toFixed(1)) : null,
    runningDurationSeconds: day.runningDurationSeconds,
    zone2Seconds: day.zone2Seconds
  }));
}

function resolvedWorkoutDistanceKm(
  db: Database.Database,
  startTime: string,
  endTime: string,
  existingDistanceKm: number | null
) {
  if (typeof existingDistanceKm === "number" && Number.isFinite(existingDistanceKm)) {
    return existingDistanceKm;
  }

  const row = db.prepare(`
    SELECT ROUND(SUM(value), 2) as total
    FROM health_samples
    WHERE metric_name = 'walking_running_distance'
      AND COALESCE(timestamp_end_local, timestamp_local) >= ?
      AND timestamp_local <= ?
  `).get(startTime, endTime) as { total: number | null } | undefined;
  return row?.total ?? null;
}

function sumRunningKm(days: Array<{ runningKm: number | null }>) {
  const total = days.reduce((sum, day) => sum + (day.runningKm ?? 0), 0);
  return total > 0 ? Number(total.toFixed(2)) : null;
}

function zone2PctForWindow(days: Array<{ zone2Seconds: number; runningDurationSeconds: number }>) {
  const totals = days.reduce(
    (accumulator, day) => ({
      zone2Seconds: accumulator.zone2Seconds + day.zone2Seconds,
      runningDurationSeconds: accumulator.runningDurationSeconds + day.runningDurationSeconds
    }),
    { zone2Seconds: 0, runningDurationSeconds: 0 }
  );

  return totals.runningDurationSeconds > 0
    ? Number(((totals.zone2Seconds / totals.runningDurationSeconds) * 100).toFixed(1))
    : null;
}

function dateSpan(startDate: string, endDate: string) {
  const dates: string[] = [];
  for (let cursor = parseISO(startDate); cursor <= parseISO(endDate); cursor = addDays(cursor, 1)) {
    dates.push(format(cursor, "yyyy-MM-dd"));
  }
  return dates;
}

function minIsoDate(a: string, b: string) {
  return a <= b ? a : b;
}

function bedtimeStdDevMinutes(values: string[]): number | null {
  if (values.length < 2) {
    return null;
  }

  const minutes = values.map((value) => {
    const date = parseISO(value);
    return date.getHours() * 60 + date.getMinutes();
  });

  const avg = average(minutes);
  if (avg === null) {
    return null;
  }

  const variance = average(minutes.map((value) => (value - avg) ** 2));
  return variance === null ? null : Number(Math.sqrt(variance).toFixed(1));
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(2));
}

function isNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRunningWorkout(workoutType: string | null | undefined) {
  return typeof workoutType === "string" && workoutType.toLowerCase().includes("run");
}

function parseWeekStart(week: string) {
  return parse(`${week}-1`, "RRRR-'W'II-i", new Date());
}
