import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import type { AppConfig } from "../server/config.js";
import { STALE_IMPORT_DAYS, STALE_SYNC_HOURS } from "../server/config.js";
import { isSyncStale } from "../server/dates.js";
import type { SyncStatusPayload } from "../server/types.js";

export function getSyncStatus(db: Database.Database, config: AppConfig): SyncStatusPayload {
  const metricsFolder = describeFolder(config.metrics_folder);
  const workoutsFolder = describeFolder(config.workouts_folder);
  const relevantTypes =
    config.data_source_mode === "apple_xml_manual" ? ["apple_xml"] : ["metrics", "workouts"];
  const placeholders = relevantTypes.map(() => "?").join(", ");
  const lastSyncRow = db
    .prepare(`SELECT MAX(ingested_at) as value, COUNT(*) as count FROM sync_log WHERE file_type IN (${placeholders})`)
    .get(...relevantTypes) as {
    value: string | null;
    count: number;
  };
  const latestDataRow = db.prepare(`
    SELECT MAX(value) as latest
    FROM (
      SELECT MAX(COALESCE(timestamp_end_local, timestamp_local)) as value FROM health_samples
      UNION ALL
      SELECT MAX(date) as value FROM sleep_sessions
      UNION ALL
      SELECT MAX(start_time) as value FROM workouts
    )
  `).get() as { latest: string | null };

  const issues: string[] = [];
  let stale = false;
  if (config.data_source_mode === "hae_json_auto") {
    if (!metricsFolder.exists) {
      issues.push("Metrics folder is missing.");
    }
    if (!workoutsFolder.exists) {
      issues.push("Workouts folder is missing.");
    }
    if (lastSyncRow.count === 0) {
      issues.push("No files have been imported yet.");
    }
    stale = isSyncStale(lastSyncRow.value, STALE_SYNC_HOURS);
    if (stale && lastSyncRow.count > 0) {
      issues.push(`No new files have been processed in the last ${STALE_SYNC_HOURS} hours.`);
    }
  } else {
    if (lastSyncRow.count === 0) {
      issues.push("No Apple Health export has been imported yet.");
    } else {
      stale = isImportStale(lastSyncRow.value);
      if (stale) {
        issues.push(`Last Apple Health import is older than ${STALE_IMPORT_DAYS} days.`);
      }
    }
  }

  let status: SyncStatusPayload["status"] = "healthy";
  if (config.data_source_mode === "hae_json_auto" && (!metricsFolder.exists || !workoutsFolder.exists)) {
    status = "missing";
  } else if (stale && lastSyncRow.count > 0) {
    status = "stale";
  } else if (issues.length > 0) {
    status = "warning";
  }

  return {
    mode: config.data_source_mode,
    metricsFolder,
    workoutsFolder,
    lastSyncedAt: lastSyncRow.value,
    latestDataTimestamp: latestDataRow.latest,
    stale,
    status,
    issues,
    processedFiles: lastSyncRow.count ?? 0
  };
}

function isImportStale(lastImportedAt: string | null): boolean {
  if (!lastImportedAt) {
    return false;
  }

  const last = new Date(lastImportedAt).getTime();
  const now = Date.now();
  const diffDays = (now - last) / (1000 * 60 * 60 * 24);
  return diffDays >= STALE_IMPORT_DAYS;
}

function describeFolder(folderPath: string) {
  const exists = fs.existsSync(folderPath);
  const fileCount = exists
    ? fs.readdirSync(folderPath).filter((file) => path.extname(file) === ".json").length
    : 0;

  return {
    path: folderPath,
    exists,
    fileCount
  };
}
