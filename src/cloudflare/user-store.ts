import { DurableObject } from "cloudflare:workers";
import type Database from "better-sqlite3";
import { createAnnotation, deleteAnnotation, listAnnotations, updateAnnotation } from "../api/annotations.js";
import { getDashboardPayload } from "./dashboard.js";
import { getHeartPayload } from "../api/heart.js";
import { getSleepPayload } from "../api/sleep.js";
import { getWeeklyReviewPayload } from "../api/weekly-review.js";
import { getWorkoutsPayload } from "../api/workouts.js";
import { getWorkbenchPayload } from "../api/workbench.js";
import type { AppConfig } from "./config.js";
import { DEFAULT_CONFIG } from "./config.js";
import { DurableSqlDatabase } from "./db.js";
import type { AppDatabase } from "./db.js";
import { ACCOUNT_SCHEMA_SQL } from "./schema.js";
import {
  hashPassword,
  issueSessionToken,
  normalizeUsername,
  sessionExpiryTimestamp,
  usernameKey,
  verifyPassword
} from "./auth.js";
import type { TimeRange } from "../server/types.js";
import type { AppleImportResult } from "../apple-import/types.js";
import { importAppleHealthZip } from "./apple-import.js";
import type { SyncStatusPayload } from "../server/types.js";
import { getSyncStatus } from "./sync-status.js";

export interface Env {
  USER_STORE: DurableObjectNamespace<UserStore>;
}

type SessionRow = {
  token: string;
  expires_at: number;
};

type AccountRow = {
  username: string;
  username_key: string;
  password_hash: string;
  created_at: string;
};

type ImportJobRow = {
  id: string;
  file_name: string;
  status: "queued" | "running" | "completed" | "failed";
  result_json: string | null;
  error_message: string | null;
};

export class UserStore extends DurableObject {
  private readonly state: DurableObjectState;
  private readonly db: DurableSqlDatabase;
  private readonly config: AppConfig = DEFAULT_CONFIG;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.state = ctx;
    this.db = new DurableSqlDatabase(ctx.storage);
    ctx.blockConcurrencyWhile(async () => {
      this.bootstrap();
    });
  }

  signup(input: { username: string; password: string }): Promise<{ user: { username: string }; sessionToken: string }> {
    return this.withWrite(async () => {
      const username = normalizeUsername(input.username);
      if (!username) {
        throw new Error("Username is required");
      }
      if (input.password.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }

      if (this.accountExists()) {
        throw new Error("Username is already taken");
      }

      const passwordHash = await hashPassword(input.password);
      this.db.prepare(`
        INSERT INTO account (username, username_key, password_hash)
        VALUES (?, ?, ?)
      `).run(username, usernameKey(username), passwordHash);

      const sessionToken = issueSessionToken();
      this.createSession(sessionToken);
      return { user: { username }, sessionToken };
    });
  }

  login(input: { username: string; password: string }): Promise<{ user: { username: string }; sessionToken: string }> {
    return this.withReadWrite(async () => {
      const account = this.getAccount();
      const username = normalizeUsername(input.username);
      if (!account || account.username_key !== usernameKey(username)) {
        throw new Error("Invalid username or password");
      }

      const ok = await verifyPassword(input.password, account.password_hash);
      if (!ok) {
        throw new Error("Invalid username or password");
      }

      const sessionToken = issueSessionToken();
      this.createSession(sessionToken);
      return { user: { username: account.username }, sessionToken };
    });
  }

  resetPassword(input: { username: string; password: string }): Promise<{ user: { username: string }; sessionToken: string }> {
    return this.withWrite(async () => {
      const username = normalizeUsername(input.username);
      const account = this.getAccount();
      if (!username || !account || account.username_key !== usernameKey(username)) {
        throw new Error("No account found for that username");
      }

      if (input.password.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }

      const passwordHash = await hashPassword(input.password);
      this.db
        .prepare(
          `
            UPDATE account
            SET password_hash = ?
            WHERE username_key = ?
          `
        )
        .run(passwordHash, usernameKey(username));

      this.db.prepare("DELETE FROM sessions").run();
      const sessionToken = issueSessionToken();
      this.createSession(sessionToken);
      return { user: { username: account.username }, sessionToken };
    });
  }

  me(input: { token: string }): Promise<{ user: { username: string } | null }> {
    return this.withReadOnly(async () => {
      const sessionToken = input.token;
      const session = this.getSession(sessionToken);
      const account = this.getAccount();
      if (!session || !account) {
        return { user: null };
      }

      if (session.expires_at <= Date.now()) {
        return { user: null };
      }

      return { user: { username: account.username } };
    });
  }

  logout(input: { token: string }): Promise<{ ok: true }> {
    return this.withWrite(async () => {
      this.deleteSession(input.token);
      return { ok: true };
    });
  }

  dashboard(input: { range: TimeRange; token: string }) {
    return this.withReadOnly(async () => {
      this.assertSession(input.token);
      return getDashboardPayload(this.db as unknown as AppDatabase, this.config, input.range);
    });
  }

  workbench(input: { token: string }) {
    return this.withReadOnly(async () => {
      this.assertSession(input.token);
      return getWorkbenchPayload(this.db as unknown as Database.Database, this.config);
    });
  }

  sleep(input: { range: TimeRange; token: string }) {
    return this.withReadOnly(async () => {
      this.assertSession(input.token);
      return getSleepPayload(this.db as unknown as Database.Database, input.range);
    });
  }

  workouts(input: { range: TimeRange; token: string }) {
    return this.withReadOnly(async () => {
      this.assertSession(input.token);
      return getWorkoutsPayload(this.db as unknown as Database.Database, this.config, input.range);
    });
  }

  heart(input: { range: TimeRange; token: string }) {
    return this.withReadOnly(async () => {
      this.assertSession(input.token);
      return getHeartPayload(this.db as unknown as Database.Database, this.config, input.range);
    });
  }

  weeklyReview(input: { week?: string; token: string }) {
    return this.withReadOnly(async () => {
      this.assertSession(input.token);
      return getWeeklyReviewPayload(this.db as unknown as Database.Database, this.config, input.week);
    });
  }

  syncStatus(input: { token: string }): Promise<SyncStatusPayload> {
    return this.withReadOnly(async () => {
      this.assertSession(input.token);
      return getSyncStatus(this.db as unknown as AppDatabase, this.config);
    });
  }

  listAnnotations(input: { token: string }) {
    return this.withReadOnly(async () => {
      this.assertSession(input.token);
      return listAnnotations(this.db as unknown as Database.Database);
    });
  }

  createAnnotation(input: { token: string; date: string; kind: string; label: string }) {
    return this.withWrite(async () => {
      this.assertSession(input.token);
      return createAnnotation(this.db as unknown as Database.Database, input);
    });
  }

  updateAnnotation(input: { token: string; id: number; date?: string; kind?: string; label?: string }) {
    return this.withWrite(async () => {
      this.assertSession(input.token);
      if (!Number.isInteger(input.id) || input.id <= 0) {
        throw new Error("Annotation id must be a positive integer");
      }
      return updateAnnotation(this.db as unknown as Database.Database, input.id, input);
    });
  }

  deleteAnnotation(input: { token: string; id: number }) {
    return this.withWrite(async () => {
      this.assertSession(input.token);
      if (!Number.isInteger(input.id) || input.id <= 0) {
        throw new Error("Annotation id must be a positive integer");
      }
      return deleteAnnotation(this.db as unknown as Database.Database, input.id);
    });
  }

  startImport(input: { fileName: string; token: string }) {
    return this.withWrite(async () => {
      this.assertSession(input.token);
      const jobId = crypto.randomUUID();
      this.db
        .prepare(
          `
            INSERT INTO import_jobs (id, file_name, status)
            VALUES (?, ?, 'queued')
          `
        )
        .run(jobId, input.fileName);
      return { jobId, fileName: input.fileName, status: "queued" as const };
    });
  }

  getImportJob(input: { jobId: string; token: string }) {
    return this.withReadOnly(async () => {
      this.assertSession(input.token);
      return this.getImportJobRow(input.jobId);
    });
  }

  processImport(input: { jobId: string; fileName: string; bytes: ArrayBuffer | Uint8Array; token: string }) {
    return this.withWrite(async () => {
      this.assertSession(input.token);
      this.updateImportJob(input.jobId, "running");

      try {
        const result = await importAppleHealthZip(this.db as unknown as AppDatabase, input.bytes, input.fileName, this.config);
        this.updateImportJob(input.jobId, "completed", result);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Import failed";
        this.updateImportJob(input.jobId, "failed", undefined, message);
        throw error;
      }
    });
  }

  async stageImportChunk(input: {
    jobId: string;
    index: number;
    chunkCount: number;
    bytes: ArrayBuffer | Uint8Array;
    token: string;
  }): Promise<{ ok: true }> {
    return this.withWrite(async () => {
      this.assertSession(input.token);
      const chunk = input.bytes instanceof Uint8Array ? input.bytes : new Uint8Array(input.bytes);
      await this.state.storage.put(this.importChunkKey(input.jobId, input.index), chunk);
      return { ok: true };
    });
  }

  async queueImport(input: { jobId: string; fileName: string; chunkCount: number; token: string }): Promise<{ ok: true }> {
    return this.withWrite(async () => {
      this.assertSession(input.token);
      await this.state.storage.put(this.importMetaKey(input.jobId), { chunkCount: input.chunkCount });
      await this.state.storage.setAlarm(Date.now());
      return { ok: true };
    });
  }

  async failImport(input: {
    jobId: string;
    chunkCount?: number;
    token: string;
    errorMessage: string;
  }): Promise<{ ok: true }> {
    return this.withWrite(async () => {
      this.assertSession(input.token);
      this.updateImportJob(input.jobId, "failed", undefined, input.errorMessage);
      if (typeof input.chunkCount === "number" && input.chunkCount > 0) {
        await this.clearStagedImportBytes(input.jobId, input.chunkCount);
      }
      return { ok: true };
    });
  }

  async alarm(): Promise<void> {
    const queuedJobs = this.db
      .prepare(
        `
          SELECT id, file_name
          FROM import_jobs
          WHERE status = 'queued'
          ORDER BY created_at, id
        `
      )
      .all() as Array<{ id: string; file_name: string }>;

    for (const job of queuedJobs) {
      const meta = await this.state.storage.get<{ chunkCount: number }>(this.importMetaKey(job.id));
      if (!meta || typeof meta.chunkCount !== "number" || meta.chunkCount <= 0) {
        this.updateImportJob(job.id, "failed", undefined, "Import upload is missing staged metadata");
        continue;
      }

      try {
        await this.processQueuedImport(job.id, job.file_name, meta.chunkCount);
      } catch (error) {
        console.error("Alarm import failed", { jobId: job.id, error });
      }
    }
  }

  private bootstrap(): void {
    this.db.exec(ACCOUNT_SCHEMA_SQL);
    this.db
      .prepare(
        `
          INSERT OR IGNORE INTO config (key, value) VALUES
          ('data_source_mode', ?),
          ('metrics_folder', ?),
          ('workouts_folder', ?),
          ('max_heart_rate', ?),
          ('zone2_lower_pct', ?),
          ('zone2_upper_pct', ?),
          ('sleep_goal_hours', ?)
        `
      )
      .run(
        DEFAULT_CONFIG.data_source_mode,
        DEFAULT_CONFIG.metrics_folder,
        DEFAULT_CONFIG.workouts_folder,
        DEFAULT_CONFIG.max_heart_rate,
        DEFAULT_CONFIG.zone2_lower_pct,
        DEFAULT_CONFIG.zone2_upper_pct,
        DEFAULT_CONFIG.sleep_goal_hours
      );
  }

  private async withReadOnly<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }

  private async withReadWrite<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }

  private async withWrite<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }

  private accountExists(): boolean {
    return Boolean(this.getAccount());
  }

  private getAccount(): AccountRow | null {
    return (
      (this.db
        .prepare(
          `
            SELECT username, username_key, password_hash, created_at
            FROM account
            LIMIT 1
          `
        )
        .get() as AccountRow | undefined) ?? null
    );
  }

  private getSession(token: string): SessionRow | null {
    return (
      (this.db
        .prepare(
          `
            SELECT token, expires_at
            FROM sessions
            WHERE token = ?
            LIMIT 1
          `
        )
        .get(token) as SessionRow | undefined) ?? null
    );
  }

  private assertSession(token: string): void {
    const session = this.getSession(token);
    if (!session || session.expires_at <= Date.now()) {
      throw new Error("Unauthorized");
    }
  }

  private deleteSession(token: string): void {
    this.db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  }

  private createSession(token: string): void {
    this.db
      .prepare(
        `
          INSERT INTO sessions (token, expires_at)
          VALUES (?, ?)
        `
      )
      .run(token, sessionExpiryTimestamp());
  }

  private getImportJobRow(jobId: string) {
    const row = this.db
      .prepare(
        `
          SELECT id, file_name, status, result_json, error_message
          FROM import_jobs
          WHERE id = ?
          LIMIT 1
        `
      )
      .get(jobId) as ImportJobRow | undefined;

    if (!row) {
      throw new Error("Import job not found");
    }

    return {
      jobId: row.id,
      fileName: row.file_name,
      status: row.status,
      result: row.result_json ? (JSON.parse(row.result_json) as AppleImportResult) : undefined,
      error: row.error_message ?? undefined
    };
  }

  private updateImportJob(
    jobId: string,
    status: "queued" | "running" | "completed" | "failed",
    result?: AppleImportResult,
    errorMessage?: string
  ): void {
    this.state.storage.transactionSync(() => {
      this.db
        .prepare(
          `
            UPDATE import_jobs
            SET status = ?, result_json = ?, error_message = ?, updated_at = datetime('now')
            WHERE id = ?
          `
        )
        .run(status, result ? JSON.stringify(result) : null, errorMessage ?? null, jobId);
    });
  }

  private importChunkKey(jobId: string, index: number): string {
    return `import:${jobId}:chunk:${index}`;
  }

  private importMetaKey(jobId: string): string {
    return `import:${jobId}:meta`;
  }

  private async readStagedImportBytes(jobId: string, chunkCount: number): Promise<Uint8Array> {
    const chunks: Uint8Array[] = [];
    let totalLength = 0;

    for (let index = 0; index < chunkCount; index += 1) {
      const stored = await this.state.storage.get<ArrayBuffer | Uint8Array>(this.importChunkKey(jobId, index));
      if (!stored) {
        throw new Error(`Import upload is missing chunk ${index + 1} of ${chunkCount}`);
      }

      const bytes = stored instanceof Uint8Array ? stored : new Uint8Array(stored);
      chunks.push(bytes);
      totalLength += bytes.byteLength;
    }

    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return combined;
  }

  private async clearStagedImportBytes(jobId: string, chunkCount: number): Promise<void> {
    for (let index = 0; index < chunkCount; index += 1) {
      await this.state.storage.delete(this.importChunkKey(jobId, index));
    }
  }

  private async processQueuedImport(jobId: string, fileName: string, chunkCount: number): Promise<void> {
    this.updateImportJob(jobId, "running");

    try {
      const bytes = await this.readStagedImportBytes(jobId, chunkCount);
      const result = await importAppleHealthZip(this.db as unknown as AppDatabase, bytes, fileName, this.config);
      this.updateImportJob(jobId, "completed", result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed";
      this.updateImportJob(jobId, "failed", undefined, message);
      throw error;
    } finally {
      await this.clearStagedImportBytes(jobId, chunkCount);
      await this.state.storage.delete(this.importMetaKey(jobId));
    }
  }
}
