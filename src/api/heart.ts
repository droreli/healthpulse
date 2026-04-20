import type Database from "better-sqlite3";
import { format } from "date-fns";
import type { AppConfig } from "../server/config.js";
import { calculateRecoveryScore } from "../evidence/recovery-score.js";
import { rangeStart } from "../server/dates.js";
import type { TimeRange } from "../server/types.js";

export function getHeartPayload(db: Database.Database, config: AppConfig, range: TimeRange) {
  const rangeDate = format(rangeStart(range), "yyyy-MM-dd");
  const series = {
    hrv: metricSeries(db, "heart_rate_variability", rangeDate),
    restingHr: metricSeries(db, "resting_heart_rate", rangeDate),
    vo2: metricSeries(db, "vo2_max", rangeDate)
  };

  const latestHrv = latestMetric(db, "heart_rate_variability");
  const latestRhr = latestMetric(db, "resting_heart_rate");
  const latestSleep = db.prepare(`
    SELECT sleep_efficiency, total_sleep_hours
    FROM sleep_sessions
    ORDER BY date DESC
    LIMIT 1
  `).get() as { sleep_efficiency: number | null; total_sleep_hours: number | null } | undefined;

  const recovery = calculateRecoveryScore({
    hrv: latestHrv.latest,
    hrvBaseline14d: latestHrv.baselineAvg,
    hrvStdDev14d: latestHrv.stdDev,
    hrvSampleCount: latestHrv.sampleCount,
    restingHR: latestRhr.latest,
    rhrBaseline14d: latestRhr.baselineAvg,
    rhrStdDev14d: latestRhr.stdDev,
    rhrSampleCount: latestRhr.sampleCount,
    sleepEfficiency: latestSleep?.sleep_efficiency ?? null,
    sleepDurationHours: latestSleep?.total_sleep_hours ?? null,
    sleepGoalHours: config.sleep_goal_hours
  });

  return {
    range,
    series,
    recovery,
    vo2Bands: [
      { label: "Superior", min: 48.0 },
      { label: "Excellent", min: 44.2 },
      { label: "Good", min: 40.5 },
      { label: "Fair", min: 36.7 },
      { label: "Poor", min: 0 }
    ]
  };
}

function metricSeries(db: Database.Database, metricName: string, rangeDate: string) {
  return db.prepare(`
    SELECT
      d.date,
      d.avg_value as value,
      ma7.avg_value as avg7,
      ma14.avg_value as avg14,
      ma30.avg_value as avg30
    FROM daily_aggregates d
    LEFT JOIN moving_averages ma7
      ON ma7.metric_name = d.metric_name AND ma7.date = d.date AND ma7.window_days = 7
    LEFT JOIN moving_averages ma14
      ON ma14.metric_name = d.metric_name AND ma14.date = d.date AND ma14.window_days = 14
    LEFT JOIN moving_averages ma30
      ON ma30.metric_name = d.metric_name AND ma30.date = d.date AND ma30.window_days = 30
    WHERE d.metric_name = ? AND d.date >= ?
    ORDER BY d.date
  `).all(metricName, rangeDate);
}

function latestMetric(db: Database.Database, metricName: string) {
  const latest = db.prepare(`
    SELECT value
    FROM health_samples
    WHERE metric_name = ?
    ORDER BY COALESCE(timestamp_end_utc, timestamp_utc) DESC
    LIMIT 1
  `).get(metricName) as { value: number } | undefined;

  const baseline = db.prepare(`
    SELECT avg_value, std_dev, sample_count
    FROM moving_averages
    WHERE metric_name = ? AND window_days = 14
    ORDER BY date DESC
    LIMIT 1
  `).get(metricName) as { avg_value: number | null; std_dev: number | null; sample_count: number | null } | undefined;

  return {
    latest: latest?.value ?? null,
    baselineAvg: baseline?.avg_value ?? null,
    stdDev: baseline?.std_dev ?? null,
    sampleCount: baseline?.sample_count ?? 0
  };
}
