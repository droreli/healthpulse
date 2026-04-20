import type { WorkoutZoneTotals } from "./types.js";

export function computeHRZones(
  heartRateData: Array<{ date?: string; Avg?: number }>,
  maxHeartRate: number,
  options: {
    restingHeartRate?: number | null;
    zone2LowerPct?: number;
    zone2UpperPct?: number;
    workoutStart?: string | null;
    workoutEnd?: string | null;
  } = {}
): WorkoutZoneTotals {
  const zones: WorkoutZoneTotals = { zone1: 0, zone2: 0, zone3: 0, zone4: 0, zone5: 0 };
  const points = heartRateData
    .map((point) => ({
      time: typeof point.date === "string" ? new Date(point.date).getTime() : Number.NaN,
      avg: point.Avg
    }))
    .filter((point): point is { time: number; avg: number } =>
      Number.isFinite(point.time) && typeof point.avg === "number" && Number.isFinite(point.avg) && point.avg > 0
    )
    .sort((a, b) => a.time - b.time);

  if (points.length === 0) {
    return zones;
  }

  const fallbackInterval = inferIntervalSeconds(points);
  const thresholds = buildZoneThresholds(maxHeartRate, options);
  const startTime = parseOptionalTime(options.workoutStart);
  const endTime = parseOptionalTime(options.workoutEnd);

  if (startTime !== null && startTime < points[0].time) {
    const leadingSeconds = Math.round((points[0].time - startTime) / 1000);
    if (leadingSeconds > 0 && leadingSeconds <= 60) {
      zones[zoneKey(points[0].avg, thresholds)] += leadingSeconds;
    }
  }

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const intervalSeconds =
      next && next.time > current.time
        ? Math.max(1, Math.round((next.time - current.time) / 1000))
        : fallbackInterval;
    zones[zoneKey(current.avg, thresholds)] += intervalSeconds;
  }

  const lastPoint = points[points.length - 1];
  if (endTime !== null && endTime > lastPoint.time) {
    const trailingSeconds = Math.round((endTime - lastPoint.time) / 1000);
    const alreadyCountedLastPoint = fallbackInterval;
    const extraSeconds = trailingSeconds - alreadyCountedLastPoint;
    if (extraSeconds > 0 && extraSeconds <= 60) {
      zones[zoneKey(lastPoint.avg, thresholds)] += extraSeconds;
    }
  }

  return zones;
}

function buildZoneThresholds(
  maxHeartRate: number,
  options: {
    restingHeartRate?: number | null;
    zone2LowerPct?: number;
    zone2UpperPct?: number;
  }
) {
  const lower = options.zone2LowerPct ?? 60;
  const upper = options.zone2UpperPct ?? 70;
  const bandWidth = Math.max(1, upper - lower);
  const percentages = [lower, upper, upper + bandWidth, upper + bandWidth * 2];
  const restingHeartRate =
    typeof options.restingHeartRate === "number" && Number.isFinite(options.restingHeartRate) && options.restingHeartRate > 0
      ? options.restingHeartRate
      : null;

  if (restingHeartRate !== null && maxHeartRate > restingHeartRate) {
    const reserve = maxHeartRate - restingHeartRate;
    return percentages.map((pct) => restingHeartRate + reserve * (pct / 100));
  }

  return percentages.map((pct) => maxHeartRate * (pct / 100));
}

function zoneKey(value: number, thresholds: number[]): keyof WorkoutZoneTotals {
  if (value < thresholds[0]) {
    return "zone1";
  }
  if (value < thresholds[1]) {
    return "zone2";
  }
  if (value < thresholds[2]) {
    return "zone3";
  }
  if (value < thresholds[3]) {
    return "zone4";
  }
  return "zone5";
}

function parseOptionalTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function inferIntervalSeconds(points: Array<{ time: number }>) {
  if (points.length < 2) {
    return 60;
  }

  const intervals = points
    .slice(1)
    .map((point, index) => Math.max(1, Math.round((point.time - points[index].time) / 1000)))
    .filter((interval) => Number.isFinite(interval) && interval > 0)
    .sort((a, b) => a - b);

  if (intervals.length === 0) {
    return 60;
  }

  const mid = Math.floor(intervals.length / 2);
  const median =
    intervals.length % 2 === 0 ? (intervals[mid - 1] + intervals[mid]) / 2 : intervals[mid];
  return Math.max(1, Math.min(60, Math.round(median)));
}
