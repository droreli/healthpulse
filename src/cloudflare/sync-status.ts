import type { AppDatabase } from "./db.js";
import type { AppConfig } from "./config.js";
import type { SyncStatusPayload } from "../server/types.js";

const STALE_IMPORT_DAYS = 14;

export function getSyncStatus(db: AppDatabase, _config: AppConfig): SyncStatusPayload {
  const lastSyncRow = db
    .prepare("SELECT MAX(ingested_at) as value, COUNT(*) as count FROM sync_log WHERE file_type = 'apple_xml'")
    .get() as { value: string | null; count: number } | undefined;

  const latestDataRow = db.prepare(`
    SELECT MAX(value) as latest
    FROM (
      SELECT MAX(COALESCE(timestamp_end_local, timestamp_local)) as value FROM health_samples
      UNION ALL
      SELECT MAX(date) as value FROM sleep_sessions
      UNION ALL
      SELECT MAX(start_time) as value FROM workouts
    )
  `).get() as { latest: string | null } | undefined;

  const lastSyncedAt = lastSyncRow?.value ?? null;
  const processedFiles = lastSyncRow?.count ?? 0;
  const stale = isImportStale(lastSyncedAt);
  const issues: string[] = [];

  if (processedFiles === 0) {
    issues.push("No Apple Health export has been imported yet.");
  } else if (stale) {
    issues.push(`Last Apple Health import is older than ${STALE_IMPORT_DAYS} days.`);
  }

  const status: SyncStatusPayload["status"] =
    processedFiles === 0 ? "warning" : stale ? "stale" : "healthy";

  return {
    mode: "apple_xml_manual",
    metricsFolder: {
      path: "Cloudflare Durable Object",
      exists: true,
      fileCount: processedFiles
    },
    workoutsFolder: {
      path: "Cloudflare Durable Object",
      exists: true,
      fileCount: processedFiles
    },
    lastSyncedAt,
    latestDataTimestamp: latestDataRow?.latest ?? null,
    stale,
    status,
    issues,
    processedFiles
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
