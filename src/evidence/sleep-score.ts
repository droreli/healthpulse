import type Database from "better-sqlite3";

export interface SleepScoreSummary {
  metricName: string | null;
  label: string;
  source: "score" | "unavailable";
  valuesByDate: Map<string, number>;
}

export function loadSleepScoreSummary(db: Database.Database, startDate: string, endDate: string): SleepScoreSummary {
  const metricName = discoverSleepScoreMetricName(db);
  if (!metricName) {
    return {
      metricName: null,
      label: "Sleep score",
      source: "unavailable",
      valuesByDate: new Map()
    };
  }

  return {
    metricName,
    label: "Sleep score",
    source: "score",
    valuesByDate: sleepScoreValuesForRange(db, metricName, startDate, endDate)
  };
}

function discoverSleepScoreMetricName(db: Database.Database) {
  const dailyMetric = db.prepare(`
    SELECT metric_name
    FROM daily_aggregates
    WHERE lower(metric_name) LIKE '%sleep%'
      AND lower(metric_name) LIKE '%score%'
    ORDER BY metric_name
    LIMIT 1
  `).get() as { metric_name: string } | undefined;

  if (dailyMetric?.metric_name) {
    return dailyMetric.metric_name;
  }

  const sampleMetric = db.prepare(`
    SELECT metric_name
    FROM health_samples
    WHERE lower(metric_name) LIKE '%sleep%'
      AND lower(metric_name) LIKE '%score%'
    ORDER BY metric_name
    LIMIT 1
  `).get() as { metric_name: string } | undefined;

  return sampleMetric?.metric_name ?? null;
}

function sleepScoreValuesForRange(db: Database.Database, metricName: string, startDate: string, endDate: string) {
  const aggregateRows = db.prepare(`
    SELECT date, COALESCE(avg_value, sum_value) as value
    FROM daily_aggregates
    WHERE metric_name = ?
      AND date BETWEEN ? AND ?
    ORDER BY date
  `).all(metricName, startDate, endDate) as Array<{ date: string; value: number | null }>;

  if (aggregateRows.length > 0) {
    return new Map(
      aggregateRows
        .filter((row) => typeof row.value === "number" && Number.isFinite(row.value))
        .map((row) => [row.date, row.value as number])
    );
  }

  const sampleRows = db.prepare(`
    SELECT substr(COALESCE(timestamp_end_local, timestamp_local), 1, 10) as date, value
    FROM health_samples
    WHERE metric_name = ?
      AND substr(COALESCE(timestamp_end_local, timestamp_local), 1, 10) BETWEEN ? AND ?
    ORDER BY COALESCE(timestamp_end_local, timestamp_local) DESC
  `).all(metricName, startDate, endDate) as Array<{ date: string; value: number | null }>;

  const valuesByDate = new Map<string, number>();
  for (const row of sampleRows) {
    if (valuesByDate.has(row.date)) {
      continue;
    }
    if (typeof row.value === "number" && Number.isFinite(row.value)) {
      valuesByDate.set(row.date, row.value);
    }
  }

  return valuesByDate;
}
