import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildWeeklyReview } from "../src/evidence/weekly-summary.js";
import { calculateRecoveryScore } from "../src/evidence/recovery-score.js";
import { ingestFile } from "../src/ingester/service.js";
import { createTestContext } from "./helpers/temp-db.js";

const FIXTURES = path.resolve("test/fixtures");
const contexts: Array<ReturnType<typeof createTestContext>> = [];

afterEach(() => {
  while (contexts.length > 0) {
    contexts.pop()?.cleanup();
  }
});

describe("Derived metrics and evidence", () => {
  it("hides recovery score until enough baseline days exist", () => {
    const recovery = calculateRecoveryScore({
      hrv: 40,
      hrvBaseline14d: 42,
      hrvStdDev14d: 2,
      hrvSampleCount: 5,
      restingHR: 58,
      rhrBaseline14d: 56,
      rhrStdDev14d: 1,
      rhrSampleCount: 5,
      sleepEfficiency: 90,
      sleepDurationHours: 7.1,
      sleepGoalHours: 7.5
    });

    expect(recovery.score).toBe(-1);
    expect(recovery.label).toBe("Building Baseline");
  });

  it("degrades recovery score gracefully when sleep is missing", () => {
    const recovery = calculateRecoveryScore({
      hrv: 45,
      hrvBaseline14d: 42,
      hrvStdDev14d: 2,
      hrvSampleCount: 14,
      restingHR: 56,
      rhrBaseline14d: 57,
      rhrStdDev14d: 1,
      rhrSampleCount: 14,
      sleepEfficiency: null,
      sleepDurationHours: null,
      sleepGoalHours: 7.5
    });

    expect(recovery.score).toBeGreaterThanOrEqual(0);
    expect(recovery.degraded).toBe(true);
    expect(recovery.degradedNote).toContain("Sleep");
  });

  it("builds a weekly review with only threshold and trend style insights", async () => {
    const ctx = createAndTrack();
    const metricsFile = path.join(ctx.metricsDir, "synthetic-metrics.json");
    const workoutsFile = path.join(ctx.workoutsDir, "synthetic-workouts.json");

    fs.writeFileSync(metricsFile, buildSyntheticMetricsPayload());
    fs.writeFileSync(workoutsFile, buildSyntheticWorkoutsPayload());

    await ingestFile(ctx.db, metricsFile, "metrics", ctx.config);
    await ingestFile(ctx.db, workoutsFile, "workouts", ctx.config);

    const review = buildWeeklyReview(ctx.db, ctx.config, "2026-W15");

    expect(review.insights.length).toBeGreaterThan(0);
    expect(JSON.stringify(review).toLowerCase()).not.toContain("pearson");
    expect(JSON.stringify(review).toLowerCase()).not.toContain("correlation");
    expect(review.takeaway.nextAction.length).toBeGreaterThan(0);
  });
});

function createAndTrack() {
  const ctx = createTestContext();
  contexts.push(ctx);
  return ctx;
}

function buildSyntheticMetricsPayload() {
  const metrics = [];
  const hrv = [];
  const rhr = [];
  const steps = [];
  const sleep = [];

  for (let day = 1; day <= 14; day += 1) {
    const date = `2026-04-${String(day).padStart(2, "0")}`;
    hrv.push({ date: `${date} 07:00:00 +0300`, qty: 40 + (day % 5) });
    rhr.push({ date: `${date} 06:00:00 +0300`, qty: 58 - (day % 3) });
    steps.push({ date: `${date} 09:00:00 +0300`, qty: 7000 + day * 100 });
    sleep.push({
      date,
      totalSleep: 7 + (day % 2) * 0.4,
      asleep: 6.8 + (day % 2) * 0.3,
      core: 3.2,
      deep: 1.2 + (day % 2) * 0.2,
      rem: 1.5,
      sleepStart: `2026-04-${String(Math.max(1, day - 1)).padStart(2, "0")} 23:15:00 +0300`,
      sleepEnd: `${date} 06:30:00 +0300`,
      inBed: 7.4
    });
  }

  metrics.push({ name: "heart_rate_variability", units: "ms", data: hrv });
  metrics.push({ name: "resting_heart_rate", units: "count/min", data: rhr });
  metrics.push({ name: "step_count", units: "count", data: steps });
  metrics.push({ name: "sleep_analysis", units: "hr", data: sleep });

  return JSON.stringify({ data: { metrics } }, null, 2);
}

function buildSyntheticWorkoutsPayload() {
  const workouts = [
    {
      id: "run-1",
      name: "Running",
      start: "2026-04-07 06:30:00 +0300",
      end: "2026-04-07 07:10:00 +0300",
      duration: 2400,
      distance: { qty: 6.2, units: "km" },
      avgHeartRate: { qty: 145, units: "bpm" },
      maxHeartRate: { qty: 164, units: "bpm" },
      activeEnergyBurned: { qty: 420, units: "kcal" },
      heartRateData: [
        { date: "2026-04-07 06:30:00 +0300", Avg: 112 },
        { date: "2026-04-07 06:31:00 +0300", Avg: 126 },
        { date: "2026-04-07 06:32:00 +0300", Avg: 138 }
      ]
    },
    {
      id: "run-2",
      name: "Running",
      start: "2026-04-09 19:30:00 +0300",
      end: "2026-04-09 20:10:00 +0300",
      duration: 2400,
      distance: { qty: 5.8, units: "km" },
      avgHeartRate: { qty: 150, units: "bpm" },
      maxHeartRate: { qty: 170, units: "bpm" },
      activeEnergyBurned: { qty: 390, units: "kcal" },
      heartRateData: [
        { date: "2026-04-09 19:30:00 +0300", Avg: 118 },
        { date: "2026-04-09 19:31:00 +0300", Avg: 146 },
        { date: "2026-04-09 19:32:00 +0300", Avg: 158 }
      ]
    }
  ];

  return JSON.stringify({ data: { workouts } }, null, 2);
}
