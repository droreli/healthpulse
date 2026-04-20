import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ingestFile } from "../src/ingester/service.js";
import { createTestContext } from "./helpers/temp-db.js";

const FIXTURES = path.resolve("test/fixtures");
const contexts: Array<ReturnType<typeof createTestContext>> = [];

afterEach(() => {
  while (contexts.length > 0) {
    contexts.pop()?.cleanup();
  }
});

describe("HAE ingestion", () => {
  it("ingests valid metrics including sleep and aggregates", async () => {
    const ctx = createAndTrack();
    const result = await ingestFile(ctx.db, path.join(FIXTURES, "prd-metrics.json"), "metrics", ctx.config);

    expect(result.skipped).toBe(false);
    expect(result.recordsIngested).toBe(8);

    const sampleCount = (ctx.db.prepare("SELECT COUNT(*) as count FROM health_samples").get() as { count: number }).count;
    const sleepCount = (ctx.db.prepare("SELECT COUNT(*) as count FROM sleep_sessions").get() as { count: number }).count;
    const aggregate = ctx.db
      .prepare("SELECT sum_value FROM daily_aggregates WHERE metric_name = 'step_count' AND date = '2026-04-09'")
      .get() as { sum_value: number };

    expect(sampleCount).toBe(7);
    expect(sleepCount).toBe(1);
    expect(aggregate.sum_value).toBe(1247);
  });

  it("ingests workouts and computes heart-rate zones", async () => {
    const ctx = createAndTrack();
    const result = await ingestFile(ctx.db, path.join(FIXTURES, "prd-workouts.json"), "workouts", ctx.config);

    expect(result.recordsIngested).toBe(1);

    const workout = ctx.db.prepare("SELECT * FROM workouts LIMIT 1").get() as {
      zone1_seconds: number | null;
      zone2_seconds: number | null;
      zone3_seconds: number | null;
      zone4_seconds: number | null;
      avg_pace_min_per_km: number | null;
    };

    expect(workout.zone1_seconds).toBe(0);
    expect(workout.zone2_seconds).toBe(60);
    expect(workout.zone3_seconds).toBe(60);
    expect(workout.zone4_seconds).toBe(60);
    expect(workout.avg_pace_min_per_km).toBeCloseTo(6.72, 2);
  });

  it("skips malformed JSON without partial inserts", async () => {
    const ctx = createAndTrack();

    await expect(ingestFile(ctx.db, path.join(FIXTURES, "malformed.json"), "metrics", ctx.config)).rejects.toThrow();

    const sampleCount = (ctx.db.prepare("SELECT COUNT(*) as count FROM health_samples").get() as { count: number }).count;
    expect(sampleCount).toBe(0);
  });

  it("skips bad records while keeping valid ones", async () => {
    const ctx = createAndTrack();
    const result = await ingestFile(ctx.db, path.join(FIXTURES, "bad-metrics.json"), "metrics", ctx.config);

    expect(result.warnings.length).toBeGreaterThan(0);

    const samples = ctx.db
      .prepare("SELECT metric_name, value FROM health_samples ORDER BY metric_name, value")
      .all() as Array<{ metric_name: string; value: number }>;

    expect(samples).toEqual([
      { metric_name: "heart_rate", value: 70 },
      { metric_name: "step_count", value: 5000 }
    ]);
  });

  it("skips the same file hash and reprocesses changed content", async () => {
    const ctx = createAndTrack();
    const filePath = path.join(ctx.metricsDir, "rolling.json");
    const original = fs.readFileSync(path.join(FIXTURES, "prd-metrics.json"), "utf8");
    fs.writeFileSync(filePath, original);

    const first = await ingestFile(ctx.db, filePath, "metrics", ctx.config);
    const second = await ingestFile(ctx.db, filePath, "metrics", ctx.config);

    expect(first.skipped).toBe(false);
    expect(second.skipped).toBe(true);

    const modified = original.replace('"qty": 1247', '"qty": 2000');
    fs.writeFileSync(filePath, modified);
    const third = await ingestFile(ctx.db, filePath, "metrics", ctx.config);

    const steps = ctx.db
      .prepare("SELECT value FROM health_samples WHERE metric_name = 'step_count' ORDER BY id DESC LIMIT 1")
      .get() as { value: number };

    expect(third.skipped).toBe(false);
    expect(steps.value).toBe(2000);
  });
});

function createAndTrack() {
  const ctx = createTestContext();
  contexts.push(ctx);
  return ctx;
}
