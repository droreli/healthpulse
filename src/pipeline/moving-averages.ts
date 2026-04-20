import type Database from "better-sqlite3";

const WINDOWS = [1, 7, 14, 30, 180, 365];
const SUM_METRICS = new Set(["step_count", "active_energy_burned", "walking_running_distance"]);
const DAY_MS = 24 * 60 * 60 * 1000;

interface AggregateRow {
  date: string;
  metric_name: string;
  avg_value: number | null;
  sum_value: number | null;
}

interface MetricPoint {
  date: string;
  dateMs: number;
  value: number | null;
}

export function rebuildMovingAverages(db: Database.Database): void {
  db.prepare("DELETE FROM moving_averages").run();

  const rows = db.prepare(`
    SELECT date, metric_name, avg_value, sum_value
    FROM daily_aggregates
    ORDER BY metric_name, date
  `).all() as AggregateRow[];

  const grouped = groupByMetric(rows);
  const insert = db.prepare(`
    INSERT INTO moving_averages (date, metric_name, window_days, avg_value, std_dev, sample_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    for (const [metric, metricRows] of Object.entries(grouped)) {
      const points = metricRows.map(toMetricPoint);
      for (const windowDays of WINDOWS) {
        insertWindowRows(insert, metric, points, windowDays);
      }
    }
  });

  transaction();
}

function groupByMetric(rows: AggregateRow[]): Record<string, AggregateRow[]> {
  return rows.reduce<Record<string, AggregateRow[]>>((acc, row) => {
    if (!acc[row.metric_name]) {
      acc[row.metric_name] = [];
    }
    acc[row.metric_name].push(row);
    return acc;
  }, {});
}

function primaryAggregateValue(row: AggregateRow): number | null {
  return SUM_METRICS.has(row.metric_name) ? row.sum_value : row.avg_value;
}

function toMetricPoint(row: AggregateRow): MetricPoint {
  return {
    date: row.date,
    dateMs: Date.parse(`${row.date}T00:00:00Z`),
    value: primaryAggregateValue(row)
  };
}

function insertWindowRows(
  insert: Database.Statement,
  metricName: string,
  points: MetricPoint[],
  windowDays: number
): void {
  let startIndex = 0;
  let sum = 0;
  let sumSquares = 0;
  let count = 0;

  for (let currentIndex = 0; currentIndex < points.length; currentIndex += 1) {
    const point = points[currentIndex];
    if (point.value !== null) {
      sum += point.value;
      sumSquares += point.value * point.value;
      count += 1;
    }

    const cutoffMs = point.dateMs - (windowDays - 1) * DAY_MS;
    while (startIndex <= currentIndex && points[startIndex].dateMs < cutoffMs) {
      const outgoing = points[startIndex];
      if (outgoing.value !== null) {
        sum -= outgoing.value;
        sumSquares -= outgoing.value * outgoing.value;
        count -= 1;
      }
      startIndex += 1;
    }

    if (count === 0) {
      continue;
    }

    insert.run(
      point.date,
      metricName,
      windowDays,
      round(sum / count, 2),
      count > 1 ? round(sampleStandardDeviationFromWindow(sum, sumSquares, count), 3) : 0,
      count
    );
  }
}

function sampleStandardDeviationFromWindow(sum: number, sumSquares: number, count: number): number {
  if (count <= 1) {
    return 0;
  }

  const variance = (sumSquares - (sum * sum) / count) / (count - 1);
  return Math.sqrt(Math.max(variance, 0));
}

function round(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}
