import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { importAppleHealthZip } from "../src/apple-import/service.js";
import { insertSamples } from "../src/ingester/service.js";
import { createTestContext } from "./helpers/temp-db.js";

const contexts: Array<ReturnType<typeof createTestContext>> = [];

afterEach(() => {
  while (contexts.length > 0) {
    contexts.pop()?.cleanup();
  }
});

describe("Apple Health zip import", () => {
  it("imports a full Apple Health export and enriches workouts from heart-rate records", async () => {
    const ctx = createAndTrack();
    const zipPath = buildAppleExportZip(ctx.root, buildAppleExportXml({ includeRecentExtra: false }));

    const result = await importAppleHealthZip(ctx.db, zipPath, ctx.config);

    expect(result.skipped).toBe(false);
    expect(result.samplesIngested).toBeGreaterThan(0);
    expect(result.workoutsIngested).toBe(1);
    expect(result.sleepSessionsUpdated).toBe(1);

    const workout = ctx.db.prepare("SELECT * FROM workouts LIMIT 1").get() as {
      heart_rate_data: string | null;
      zone2_seconds: number | null;
      zone4_seconds: number | null;
    };
    const sleep = ctx.db.prepare("SELECT * FROM sleep_sessions LIMIT 1").get() as {
      deep_hours: number | null;
      rem_hours: number | null;
    };

    expect(workout.heart_rate_data).not.toBeNull();
    expect(workout.zone2_seconds).toBe(60);
    expect(workout.zone4_seconds).toBe(60);
    expect(sleep.deep_hours).toBeCloseTo(1.0, 2);
    expect(sleep.rem_hours).toBeCloseTo(1.5, 2);
  });

  it("reconciles a later full export by importing only the new/recent window", async () => {
    const ctx = createAndTrack();
    const firstZip = buildAppleExportZip(ctx.root, buildAppleExportXml({ includeRecentExtra: false }));
    await importAppleHealthZip(ctx.db, firstZip, ctx.config);

    const countBefore = (ctx.db.prepare("SELECT COUNT(*) as count FROM health_samples").get() as { count: number }).count;

    const secondZip = buildAppleExportZip(
      ctx.root,
      buildAppleExportXml({ includeRecentExtra: true }),
      "export-later.zip"
    );
    const second = await importAppleHealthZip(ctx.db, secondZip, ctx.config);

    const countAfter = (ctx.db.prepare("SELECT COUNT(*) as count FROM health_samples").get() as { count: number }).count;
    const latestSteps = ctx.db
      .prepare("SELECT MAX(sum_value) as value FROM daily_aggregates WHERE metric_name = 'step_count' AND date = '2026-04-16'")
      .get() as { value: number | null };

    expect(second.skipped).toBe(false);
    expect(second.cutoffDate).not.toBeNull();
    expect(countAfter).toBeGreaterThan(countBefore);
    expect(latestSteps.value).toBe(8800);
  });

  it("updates an existing sample when the same metric timestamp and source arrive with a different dedup key", () => {
    const ctx = createAndTrack();

    insertSamples(ctx.db, [
      {
        metric_name: "step_count",
        value: 1200,
        value_min: null,
        value_max: null,
        unit: "count",
        timestamp_utc: "2026-04-09T06:00:00.000Z",
        timestamp_local: "2026-04-09T09:00:00+03:00",
        timestamp_end_utc: "2026-04-09T06:05:00.000Z",
        timestamp_end_local: "2026-04-09T09:05:00+03:00",
        source: "Apple Watch",
        dedup_key: "apple:step_count:original"
      }
    ]);

    insertSamples(ctx.db, [
      {
        metric_name: "step_count",
        value: 1800,
        value_min: null,
        value_max: null,
        unit: "count",
        timestamp_utc: "2026-04-09T06:00:00.000Z",
        timestamp_local: "2026-04-09T09:00:00+03:00",
        timestamp_end_utc: "2026-04-09T06:10:00.000Z",
        timestamp_end_local: "2026-04-09T09:10:00+03:00",
        source: "Apple Watch",
        dedup_key: "apple:step_count:changed"
      }
    ]);

    const rows = ctx.db
      .prepare(
        `
          SELECT value, timestamp_end_utc, dedup_key
          FROM health_samples
          WHERE metric_name = 'step_count'
        `
      )
      .all() as Array<{ value: number; timestamp_end_utc: string | null; dedup_key: string }>;

    expect(rows).toHaveLength(1);
    expect(rows[0]?.value).toBe(1800);
    expect(rows[0]?.timestamp_end_utc).toBe("2026-04-09T06:10:00.000Z");
    expect(rows[0]?.dedup_key).toBe("apple:step_count:original");
  });
});

function createAndTrack() {
  const ctx = createTestContext();
  contexts.push(ctx);
  return ctx;
}

function buildAppleExportZip(root: string, xml: string, name = "export.zip") {
  const exportDir = path.join(root, "apple_health_export");
  fs.mkdirSync(exportDir, { recursive: true });
  fs.writeFileSync(path.join(exportDir, "export.xml"), xml);
  const zipPath = path.join(root, name);
  if (fs.existsSync(zipPath)) {
    fs.rmSync(zipPath);
  }
  execFileSync("zip", ["-rq", zipPath, "apple_health_export"], { cwd: root });
  return zipPath;
}

function buildAppleExportXml({ includeRecentExtra }: { includeRecentExtra: boolean }) {
  const extra = includeRecentExtra
    ? `
  <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Apple Watch" unit="count" creationDate="2026-04-16 09:00:00 +0300" startDate="2026-04-16 09:00:00 +0300" endDate="2026-04-16 09:05:00 +0300" value="8800"/>
  <Record type="HKQuantityTypeIdentifierHeartRateVariabilitySDNN" sourceName="Apple Watch" unit="ms" creationDate="2026-04-16 07:00:00 +0300" startDate="2026-04-16 07:00:00 +0300" endDate="2026-04-16 07:00:00 +0300" value="47"/>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<HealthData locale="en_US">
  <ExportDate value="${includeRecentExtra ? "2026-04-16 10:00:00 +0300" : "2026-04-09 10:00:00 +0300"}"/>
  <Me />
  <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Apple Watch" unit="count" creationDate="2026-04-09 09:00:00 +0300" startDate="2026-04-09 09:00:00 +0300" endDate="2026-04-09 09:05:00 +0300" value="1200"/>
  <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Apple Watch" unit="count/min" creationDate="2026-04-09 06:30:00 +0300" startDate="2026-04-09 06:30:00 +0300" endDate="2026-04-09 06:30:00 +0300" value="118"/>
  <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Apple Watch" unit="count/min" creationDate="2026-04-09 06:31:00 +0300" startDate="2026-04-09 06:31:00 +0300" endDate="2026-04-09 06:31:00 +0300" value="142"/>
  <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Apple Watch" unit="count/min" creationDate="2026-04-09 06:32:00 +0300" startDate="2026-04-09 06:32:00 +0300" endDate="2026-04-09 06:32:00 +0300" value="164"/>
  <Record type="HKQuantityTypeIdentifierRestingHeartRate" sourceName="Apple Watch" unit="count/min" creationDate="2026-04-09 07:00:00 +0300" startDate="2026-04-09 07:00:00 +0300" endDate="2026-04-09 07:00:00 +0300" value="57"/>
  <Record type="HKQuantityTypeIdentifierHeartRateVariabilitySDNN" sourceName="Apple Watch" unit="ms" creationDate="2026-04-09 07:05:00 +0300" startDate="2026-04-09 07:05:00 +0300" endDate="2026-04-09 07:05:00 +0300" value="44"/>
  <Record type="HKQuantityTypeIdentifierVO2Max" sourceName="Apple Watch" unit="mL/min·kg" creationDate="2026-04-09 08:00:00 +0300" startDate="2026-04-09 08:00:00 +0300" endDate="2026-04-09 08:00:00 +0300" value="43.5"/>
  <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" creationDate="2026-04-09 06:00:00 +0300" startDate="2026-04-08 23:00:00 +0300" endDate="2026-04-09 06:30:00 +0300" value="HKCategoryValueSleepAnalysisInBed"/>
  <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" creationDate="2026-04-09 06:00:00 +0300" startDate="2026-04-08 23:15:00 +0300" endDate="2026-04-09 02:15:00 +0300" value="HKCategoryValueSleepAnalysisAsleepCore"/>
  <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" creationDate="2026-04-09 06:00:00 +0300" startDate="2026-04-09 02:15:00 +0300" endDate="2026-04-09 03:15:00 +0300" value="HKCategoryValueSleepAnalysisAsleepDeep"/>
  <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" creationDate="2026-04-09 06:00:00 +0300" startDate="2026-04-09 03:15:00 +0300" endDate="2026-04-09 04:45:00 +0300" value="HKCategoryValueSleepAnalysisAsleepREM"/>
  <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" creationDate="2026-04-09 06:00:00 +0300" startDate="2026-04-09 04:45:00 +0300" endDate="2026-04-09 06:15:00 +0300" value="HKCategoryValueSleepAnalysisAsleepUnspecified"/>
  <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="2100" durationUnit="s" totalDistance="5.2" totalDistanceUnit="km" totalEnergyBurned="410" totalEnergyBurnedUnit="kcal" sourceName="Apple Watch" startDate="2026-04-09 06:30:00 +0300" endDate="2026-04-09 07:05:00 +0300">
    <WorkoutStatistics type="HKQuantityTypeIdentifierHeartRate" startDate="2026-04-09 06:30:00 +0300" endDate="2026-04-09 07:05:00 +0300" average="141" minimum="118" maximum="164" unit="count/min"/>
  </Workout>
  ${extra}
</HealthData>`;
}
