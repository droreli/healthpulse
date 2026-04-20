import type { WorkbenchPayload } from "../../api/workbench";

export type UiRange = "7D" | "14D" | "30D" | "90D";
export type Edition = "editorial" | "instrument";
export type ThemeMode = "dark" | "light";
export type WorkbenchPage = "dashboard" | "sleep" | "workouts" | "heart" | "correlate" | "weekly" | "settings";

export type AnnotationView = WorkbenchPayload["annotations"][number] & {
  dot: string;
  dayIdx: number;
};

export type WorkoutView = WorkbenchPayload["workouts"][number] & {
  dateValue: Date;
};

export interface WorkbenchModel {
  dates: Date[];
  sleep: number[];
  sleepStages: Array<{
    total: number;
    rem: number;
    deep: number;
    core: number;
    awake: number;
    bedtime: number;
    waketime: number;
  }>;
  hrv: number[];
  hrvBaseline: number[];
  rhr: number[];
  rhrBaseline: number[];
  sleepBaseline: number[];
  vo2: number[];
  steps: number[];
  workouts: WorkoutView[];
  readiness: number[];
  annotations: AnnotationView[];
  today: {
    readiness: number;
    readinessYest: number;
    sleep: number;
    sleepStages: {
      total: number;
      rem: number;
      deep: number;
      core: number;
      awake: number;
      bedtime: number;
      waketime: number;
    };
    hrv: number;
    hrvBase: number;
    rhr: number;
    rhrBase: number;
    vo2: number;
    steps: number;
  };
  correlations: {
    sleepToHRV: number;
    sleepToRHR: number;
    deepToHRV: number;
    remToReady: number;
  };
  alcoholImpact: {
    baseline: number;
    afterAlcohol: number;
    drop: number;
    samples: number;
  };
  syncLabel: string;
  syncDetail: string;
}

type SleepSessionView = WorkbenchModel["sleepStages"][number];

const RANGE_DAYS: Record<UiRange, number> = {
  "7D": 7,
  "14D": 14,
  "30D": 30,
  "90D": 90
};

export function buildWorkbenchModel(payload: WorkbenchPayload): WorkbenchModel {
  const endDate = newestDate(payload) ?? new Date();
  const dates = buildDateWindow(endDate, 90);
  const keys = dates.map((date) => toDateKey(date));

  const sleepByDate = new Map(payload.sleep.map((entry) => [entry.date, entry]));
  const hrvByDate = new Map(payload.hrv.map((entry) => [entry.date, entry.value]));
  const rhrByDate = new Map(payload.rhr.map((entry) => [entry.date, entry.value]));
  const vo2ByDate = new Map(payload.vo2.map((entry) => [entry.date, entry.value]));
  const stepsByDate = new Map(payload.steps.map((entry) => [entry.date, entry.value]));

  const sleepSessions: SleepSessionView[] = [];
  for (const [index, key] of keys.entries()) {
    const fallback = index > 0 ? sleepSessions[index - 1] : defaultSleepSession();
    const current = sleepByDate.get(key);
    sleepSessions.push({
      total: current?.total ?? fallback.total,
      rem: current?.rem ?? fallback.rem,
      deep: current?.deep ?? fallback.deep,
      core: current?.core ?? fallback.core,
      awake: current?.awake ?? fallback.awake,
      bedtime: toDecimalHour(current?.bedtime ?? null) ?? fallback.bedtime,
      waketime: toDecimalHour(current?.waketime ?? null) ?? fallback.waketime
    });
  }

  const sleep = sleepSessions.map((entry) => entry.total);
  const hrv = buildDenseMetricSeries(keys, hrvByDate, 30);
  const rhr = buildDenseMetricSeries(keys, rhrByDate, 60);
  const vo2 = buildDenseMetricSeries(keys, vo2ByDate, 40);
  const steps = buildDenseMetricSeries(keys, stepsByDate, 7000);
  const hrvBaseline = rollingMean(hrv, 14);
  const rhrBaseline = rollingMean(rhr, 14);
  const sleepBaseline = rollingMean(sleep, 14);
  const readiness = sleep.map((sleepValue, index) => {
    const hrvZ = (hrv[index] - hrvBaseline[index]) / 6;
    const rhrZ = (rhrBaseline[index] - rhr[index]) / 4;
    const sleepZ = (sleepValue - sleepBaseline[index]) / 1.2;
    return clamp(Math.round(70 + hrvZ * 7 + rhrZ * 5 + sleepZ * 6), 30, 99);
  });

  const annotations = payload.annotations
    .map((annotation): AnnotationView => ({
      ...annotation,
      dot: annotationGlyph(annotation.kind),
      dayIdx: keys.indexOf(annotation.date)
    }))
    .filter((annotation) => annotation.dayIdx >= 0);

  const workouts = payload.workouts
    .map((workout) => ({
      ...workout,
      dateValue: new Date(`${workout.date}T00:00:00`)
    }))
    .sort((left, right) => right.start.localeCompare(left.start));

  const correlations = {
    sleepToHRV: corr(clip(sleep, 1), shift(hrv, 1)),
    sleepToRHR: corr(clip(sleep, 1), shift(rhr, 1)),
    deepToHRV: corr(clip(sleepSessions.map((entry) => entry.deep), 1), shift(hrv, 1)),
    remToReady: corr(clip(sleepSessions.map((entry) => entry.rem), 1), shift(readiness, 1))
  };

  const alcoholDays = annotations.filter((annotation) => annotation.kind === "alcohol").map((annotation) => annotation.dayIdx);
  const nextDayHrv = alcoholDays
    .map((index) => hrv[index + 1] ?? null)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const afterAlcohol = nextDayHrv.length
    ? nextDayHrv.reduce((sum, value) => sum + value, 0) / nextDayHrv.length
    : hrvBaseline[hrvBaseline.length - 1];
  const baseline = hrvBaseline[hrvBaseline.length - 1];

  return {
    dates,
    sleep,
    sleepStages: sleepSessions,
    hrv,
    hrvBaseline,
    rhr,
    rhrBaseline,
    sleepBaseline,
    vo2,
    steps,
    workouts,
    readiness,
    annotations,
    today: {
      readiness: readiness.at(-1) ?? 70,
      readinessYest: readiness.at(-2) ?? readiness.at(-1) ?? 70,
      sleep: sleep.at(-1) ?? 0,
      sleepStages: sleepSessions.at(-1) ?? defaultSleepSession(),
      hrv: hrv.at(-1) ?? 0,
      hrvBase: hrvBaseline.at(-1) ?? 0,
      rhr: rhr.at(-1) ?? 0,
      rhrBase: rhrBaseline.at(-1) ?? 0,
      vo2: vo2.at(-1) ?? 0,
      steps: steps.at(-1) ?? 0
    },
    correlations,
    alcoholImpact: {
      baseline,
      afterAlcohol,
      drop: baseline - afterAlcohol,
      samples: nextDayHrv.length
    },
    syncLabel: formatSyncLabel(payload.sync.lastSyncedAt),
    syncDetail: payload.sync.lastSyncedAt
      ? `Latest sample ${payload.sync.latestDataTimestamp?.slice(0, 16).replace("T", " ") ?? "available"}`
      : "No sync yet"
  };
}

export function rangeDays(range: UiRange): number {
  return RANGE_DAYS[range];
}

export function annotationOptions() {
  return ["alcohol", "travel", "illness", "stress", "custom"];
}

export function formatModelDate(date: Date, style: "md" | "ymd" | "short" | "full" | "dow" = "md") {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  if (style === "md") {
    return `${month}-${day}`;
  }
  if (style === "ymd") {
    return `${date.getFullYear()}-${month}-${day}`;
  }
  if (style === "short") {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (style === "full") {
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

export function formatPace(pace: number | null) {
  if (!pace || !Number.isFinite(pace)) {
    return "—";
  }
  const minutes = Math.floor(pace);
  const seconds = Math.round((pace % 1) * 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatClock(hour: number | null) {
  if (hour === null || !Number.isFinite(hour)) {
    return "—";
  }
  const normalized = ((hour % 24) + 24) % 24;
  const whole = Math.floor(normalized);
  const minutes = Math.round((normalized % 1) * 60);
  return `${String(whole).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function groupWorkoutsByDay(workouts: WorkoutView[]) {
  const grouped = new Map<string, WorkoutView[]>();
  for (const workout of workouts) {
    const list = grouped.get(workout.date) ?? [];
    list.push(workout);
    grouped.set(workout.date, list);
  }
  return grouped;
}

export function corr(left: number[], right: number[]) {
  const count = Math.min(left.length, right.length);
  if (count < 2) {
    return 0;
  }

  const a = left.slice(-count);
  const b = right.slice(-count);
  const meanA = a.reduce((sum, value) => sum + value, 0) / count;
  const meanB = b.reduce((sum, value) => sum + value, 0) / count;
  let numerator = 0;
  let varianceA = 0;
  let varianceB = 0;

  for (let index = 0; index < count; index += 1) {
    const deltaA = a[index] - meanA;
    const deltaB = b[index] - meanB;
    numerator += deltaA * deltaB;
    varianceA += deltaA * deltaA;
    varianceB += deltaB * deltaB;
  }

  if (varianceA === 0 || varianceB === 0) {
    return 0;
  }

  return numerator / Math.sqrt(varianceA * varianceB);
}

export function clip(values: number[], count: number) {
  return values.slice(0, values.length - count);
}

export function shift(values: number[], count: number) {
  return values.slice(count);
}

function newestDate(payload: WorkbenchPayload) {
  const candidates = [
    ...payload.sleep.map((entry) => entry.date),
    ...payload.hrv.map((entry) => entry.date),
    ...payload.rhr.map((entry) => entry.date),
    ...payload.vo2.map((entry) => entry.date),
    ...payload.steps.map((entry) => entry.date),
    ...payload.workouts.map((entry) => entry.date),
    ...payload.annotations.map((entry) => entry.date)
  ].filter(Boolean);

  if (candidates.length === 0) {
    return null;
  }

  const latest = candidates.sort().at(-1);
  return latest ? new Date(`${latest}T00:00:00`) : null;
}

function buildDateWindow(endDate: Date, days: number) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(endDate);
    date.setDate(endDate.getDate() - (days - index - 1));
    return date;
  });
}

function buildDenseMetricSeries(keys: string[], valuesByDate: Map<string, number | null>, fallbackSeed: number) {
  let previous = firstFinite(valuesByDate.values()) ?? fallbackSeed;
  return keys.map((key) => {
    const next = valuesByDate.get(key);
    if (typeof next === "number" && Number.isFinite(next)) {
      previous = next;
      return next;
    }
    return previous;
  });
}

function firstFinite(values: Iterable<number | null>) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function rollingMean(values: number[], window: number) {
  return values.map((_, index) => {
    const start = Math.max(0, index - window + 1);
    const slice = values.slice(start, index + 1);
    return slice.reduce((sum, value) => sum + value, 0) / slice.length;
  });
}

function defaultSleepSession() {
  return {
    total: 7.2,
    rem: 1.5,
    deep: 1,
    core: 4.3,
    awake: 0.4,
    bedtime: 23,
    waketime: 7
  };
}

function annotationGlyph(kind: string) {
  if (kind === "alcohol") {
    return "●";
  }
  if (kind === "travel") {
    return "✈";
  }
  if (kind === "illness") {
    return "◐";
  }
  if (kind === "stress") {
    return "△";
  }
  return "·";
}

function toDecimalHour(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return Number((date.getHours() + date.getMinutes() / 60).toFixed(2));
}

function toDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatSyncLabel(value: string | null) {
  if (!value) {
    return "Not synced";
  }

  const deltaMs = Date.now() - new Date(value).getTime();
  const deltaMinutes = Math.max(0, Math.round(deltaMs / 60000));
  if (deltaMinutes < 60) {
    return `Synced · ${deltaMinutes}m ago`;
  }
  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `Synced · ${deltaHours}h ago`;
  }
  return `Synced · ${Math.round(deltaHours / 24)}d ago`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
