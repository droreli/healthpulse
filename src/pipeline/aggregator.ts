import type Database from "better-sqlite3";
import { rebuildMovingAverages } from "./moving-averages.js";
import { rebuildSleepDerivedFields } from "./sleep-derived.js";

export function rebuildDerivedTables(db: Database.Database): void {
  rebuildDailyAggregates(db);
  rebuildSleepDerivedFields(db);
  rebuildMovingAverages(db);
}

function rebuildDailyAggregates(db: Database.Database): void {
  db.prepare("DELETE FROM daily_aggregates").run();

  db.exec(`
    INSERT INTO daily_aggregates (date, metric_name, avg_value, min_value, max_value, sum_value, sample_count)
    SELECT
      substr(COALESCE(timestamp_end_local, timestamp_local), 1, 10) as date,
      metric_name,
      ROUND(AVG(value), 3) as avg_value,
      MIN(COALESCE(value_min, value)) as min_value,
      MAX(COALESCE(value_max, value)) as max_value,
      ROUND(SUM(value), 3) as sum_value,
      COUNT(*) as sample_count
    FROM health_samples
    WHERE metric_name <> 'step_count'
    GROUP BY substr(COALESCE(timestamp_end_local, timestamp_local), 1, 10), metric_name
  `);

  const stepRows = db
    .prepare(`
      SELECT
        substr(COALESCE(timestamp_end_local, timestamp_local), 1, 10) as date,
        CASE WHEN lower(source) LIKE '%watch%' THEN 'watch' ELSE 'other' END as source_group,
        ROUND(AVG(value), 3) as avg_value,
        MIN(COALESCE(value_min, value)) as min_value,
        MAX(COALESCE(value_max, value)) as max_value,
        ROUND(SUM(value), 3) as sum_value,
        COUNT(*) as sample_count
      FROM health_samples
      WHERE metric_name = 'step_count'
      GROUP BY substr(COALESCE(timestamp_end_local, timestamp_local), 1, 10), source_group
      ORDER BY date
    `)
    .all() as Array<{
    date: string;
    source_group: string;
    avg_value: number | null;
    min_value: number | null;
    max_value: number | null;
    sum_value: number | null;
    sample_count: number;
  }>;

  const selectedByDate = new Map<string, (typeof stepRows)[number]>();
  for (const row of stepRows) {
    const existing = selectedByDate.get(row.date);
    if (!existing) {
      selectedByDate.set(row.date, row);
      continue;
    }

    const existingRank = sourceRank(existing.source_group);
    const nextRank = sourceRank(row.source_group);
    if (nextRank < existingRank || (nextRank === existingRank && (row.sample_count > existing.sample_count || (row.sum_value ?? 0) > (existing.sum_value ?? 0)))) {
      selectedByDate.set(row.date, row);
    }
  }

  const insertStep = db.prepare(`
    INSERT INTO daily_aggregates (date, metric_name, avg_value, min_value, max_value, sum_value, sample_count)
    VALUES (?, 'step_count', ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    for (const row of selectedByDate.values()) {
      insertStep.run(row.date, row.avg_value, row.min_value, row.max_value, row.sum_value, row.sample_count);
    }
  });

  transaction();
}

function sourceRank(sourceGroup: string): number {
  return sourceGroup === "watch" ? 0 : 1;
}
