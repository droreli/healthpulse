import type Database from "better-sqlite3";
import { format, parseISO } from "date-fns";
import { loadSleepScoreSummary } from "../evidence/sleep-score.js";
import { rangeStart } from "../server/dates.js";
import type { TimeRange } from "../server/types.js";

export function getSleepPayload(db: Database.Database, range: TimeRange) {
  const rangeDate = format(rangeStart(range), "yyyy-MM-dd");
  const sessions = db.prepare(`
    SELECT *
    FROM sleep_sessions
    WHERE date >= ?
    ORDER BY date
  `).all(rangeDate) as Array<{
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
  }>;
  const sleepScore = loadSleepScoreSummary(db, rangeDate, sessions.at(-1)?.date ?? rangeDate);

  const startTimes = sessions
    .map((session) => session.sleep_start)
    .filter((value): value is string => Boolean(value))
    .map((value) => parseISO(value));

  return {
    range,
    sessions: sessions.map((session) => ({
      ...session,
      sleep_score: sleepScore.valuesByDate.get(session.date) ?? null,
      asleep_minutes: minutes(session.asleep_hours),
      core_minutes: minutes(session.core_hours),
      deep_minutes: minutes(session.deep_hours),
      rem_minutes: minutes(session.rem_hours),
      in_bed_minutes: minutes(session.in_bed_hours)
    })),
    benchmarks: {
      deepPct: "15-20%",
      remPct: "20-25%",
      sleepEfficiency: "85%+"
    },
    summary: {
      avgDuration: average(sessions.map((session) => session.total_sleep_hours).filter(isNumber)),
      avgEfficiency: average(sessions.map((session) => session.sleep_efficiency).filter(isNumber)),
      avgSleepScore: average(sessions.map((session) => sleepScore.valuesByDate.get(session.date)).filter(isFiniteNumber)),
      sleepMetricLabel: sleepScore.label,
      sleepMetricSource: sleepScore.source,
      bedtimeConsistencyMinutes: standardDeviationMinutes(startTimes)
    }
  };
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(2));
}

function standardDeviationMinutes(values: Date[]): number | null {
  if (values.length < 2) {
    return null;
  }

  const minutes = values.map((value) => value.getHours() * 60 + value.getMinutes());
  const avg = minutes.reduce((total, value) => total + value, 0) / minutes.length;
  const variance = minutes.reduce((total, value) => total + (value - avg) ** 2, 0) / minutes.length;
  return Number(Math.sqrt(variance).toFixed(1));
}

function isNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function minutes(value: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Number((value * 60).toFixed(1)) : null;
}
