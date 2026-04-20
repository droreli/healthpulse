import crypto from "node:crypto";
import type Database from "better-sqlite3";
import type { HaeFileType } from "./types.js";

export function hashFileContents(contents: crypto.BinaryLike): string {
  return crypto.createHash("sha256").update(contents).digest("hex");
}

export function hasProcessedFile(db: Database.Database, hash: string): boolean {
  const row = db.prepare("SELECT 1 FROM sync_log WHERE file_hash = ? LIMIT 1").get(hash);
  return Boolean(row);
}

export function insertSyncLog(
  db: Database.Database,
  filePath: string,
  fileHash: string,
  fileType: HaeFileType,
  recordsIngested: number
): void {
  db.prepare(`
    INSERT OR IGNORE INTO sync_log (filepath, file_hash, file_type, records_ingested)
    VALUES (?, ?, ?, ?)
  `).run(filePath, fileHash, fileType, recordsIngested);
}
