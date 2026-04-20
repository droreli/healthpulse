import type { AppDatabase } from "./db.js";
import type { HaeFileType } from "../ingester/types.js";

export async function hashFileContents(contents: ArrayBuffer | Uint8Array | string): Promise<string> {
  const bytes =
    typeof contents === "string"
      ? new TextEncoder().encode(contents)
      : contents instanceof Uint8Array
        ? contents
        : new Uint8Array(contents);
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function hasProcessedFile(db: AppDatabase, hash: string): boolean {
  const row = db.prepare("SELECT 1 FROM sync_log WHERE file_hash = ? LIMIT 1").get(hash);
  return Boolean(row);
}

export function insertSyncLog(
  db: AppDatabase,
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
