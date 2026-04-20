import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import multer from "multer";
import type Database from "better-sqlite3";
import { createAnnotation, deleteAnnotation, listAnnotations, updateAnnotation } from "./annotations.js";
import { getDashboardPayload } from "./dashboard.js";
import { getSleepPayload } from "./sleep.js";
import { getWorkoutsPayload } from "./workouts.js";
import { getHeartPayload } from "./heart.js";
import { getWeeklyReviewPayload } from "./weekly-review.js";
import { getWorkbenchPayload } from "./workbench.js";
import { getSyncStatus } from "./sync-status.js";
import type { AppConfig } from "../server/config.js";
import type { TimeRange } from "../server/types.js";
import { importAppleHealthZip } from "../apple-import/service.js";
import {
  authenticateUser,
  buildSessionCookie,
  clearSessionCookie,
  cleanupExpiredSessions,
  createUserAccount,
  deleteSession,
  findSessionUser,
  getCookieName,
  isSecureRequest,
  issueSession,
  normalizeUsername,
  parseCookieHeader
} from "../server/auth.js";
import type { AppleImportJobPayload } from "../server/types.js";

interface RequestContext {
  db: Database.Database;
  config: AppConfig;
  user: { id: number; username: string; data_db_path: string };
}

export function createApiRouter(authDb: Database.Database, resolveContext: (req: express.Request) => RequestContext | null) {
  const router = express.Router();
  const uploadDir = path.join(os.tmpdir(), "healthpulse-uploads");
  fs.mkdirSync(uploadDir, { recursive: true });
  const upload = multer({ dest: uploadDir });

  router.get("/auth/me", (req, res) => {
    const user = findSessionUser(authDb, req.headers.cookie);
    res.json({
      user: user ? { username: user.username } : null
    });
  });

  router.post("/auth/signup", express.json(), (req, res) => {
    const username = typeof req.body?.username === "string" ? normalizeUsername(req.body.username) : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    try {
      cleanupExpiredSessions(authDb);
      const user = createUserAccount(authDb, username, password);
      const sessionToken = issueSession(authDb, user.id);
      res.setHeader("Set-Cookie", buildSessionCookie(sessionToken, isSecureRequest(req)));
      res.json({ user: { username: user.username } });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Signup failed" });
    }
  });

  router.post("/auth/login", express.json(), (req, res) => {
    const username = typeof req.body?.username === "string" ? req.body.username : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    try {
      cleanupExpiredSessions(authDb);
      const user = authenticateUser(authDb, username, password);
      if (!user) {
        res.status(401).json({ error: "Invalid username or password" });
        return;
      }

      const sessionToken = issueSession(authDb, user.id);
      res.setHeader("Set-Cookie", buildSessionCookie(sessionToken, isSecureRequest(req)));
      res.json({ user: { username: user.username } });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Login failed" });
    }
  });

  router.post("/auth/logout", (req, res) => {
    const cookies = parseCookieHeader(req.headers.cookie);
    const token = cookies[getCookieName()];
    if (token) {
      deleteSession(authDb, token);
    }
    res.setHeader("Set-Cookie", clearSessionCookie(isSecureRequest(req)));
    res.json({ ok: true });
  });

  router.get("/dashboard", (_req, res) => {
    const context = resolveContext(_req);
    if (!context) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const range = parseRange(_req.query.range);
    res.json(getDashboardPayload(context.db, context.config, range));
  });

  router.get("/workbench", (_req, res) => {
    const context = resolveContext(_req);
    if (!context) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.json(getWorkbenchPayload(context.db, context.config));
  });

  router.get("/sleep", (_req, res) => {
    const context = resolveContext(_req);
    if (!context) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const range = parseRange(_req.query.range);
    res.json(getSleepPayload(context.db, range));
  });

  router.get("/workouts", (_req, res) => {
    const context = resolveContext(_req);
    if (!context) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const range = parseRange(_req.query.range);
    res.json(getWorkoutsPayload(context.db, context.config, range));
  });

  router.get("/heart", (_req, res) => {
    const context = resolveContext(_req);
    if (!context) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const range = parseRange(_req.query.range);
    res.json(getHeartPayload(context.db, context.config, range));
  });

  router.get("/weekly-review", (req, res) => {
    const context = resolveContext(req);
    if (!context) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const week = typeof req.query.week === "string" ? req.query.week : undefined;
    res.json(getWeeklyReviewPayload(context.db, context.config, week));
  });

  router.get("/sync-status", (_req, res) => {
    const context = resolveContext(_req);
    if (!context) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.json(getSyncStatus(context.db, context.config));
  });

  router.get("/annotations", (req, res) => {
    const context = resolveContext(req);
    if (!context) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    res.json(listAnnotations(context.db));
  });

  router.post("/annotations", (req, res) => {
    const context = resolveContext(req);
    if (!context) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      res.status(201).json(createAnnotation(context.db, req.body));
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create annotation" });
    }
  });

  router.patch("/annotations/:id", (req, res) => {
    const context = resolveContext(req);
    if (!context) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Annotation id must be a positive integer" });
      return;
    }

    try {
      res.json(updateAnnotation(context.db, id, req.body));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update annotation";
      res.status(message === "Annotation not found" ? 404 : 400).json({ error: message });
    }
  });

  router.delete("/annotations/:id", (req, res) => {
    const context = resolveContext(req);
    if (!context) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Annotation id must be a positive integer" });
      return;
    }

    try {
      res.json(deleteAnnotation(context.db, id));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete annotation";
      res.status(message === "Annotation not found" ? 404 : 400).json({ error: message });
    }
  });

  router.post("/import/apple-health", upload.single("file"), async (req, res, next) => {
    const context = resolveContext(req);
    if (!context) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "Missing file upload" });
      return;
    }

    try {
      const jobId = crypto.randomUUID();
      const fileName = req.file.originalname || path.basename(req.file.path);
      createImportJob(context.db, jobId, fileName, req.file.path);
      res.status(202).json({
        jobId,
        fileName,
        status: "queued"
      } satisfies AppleImportJobPayload);

      void runImportJob(context.db, jobId, req.file.path, context.config);
    } catch (error) {
      next(error);
    } finally {
      // The background job removes the upload after processing.
    }
  });

  router.get("/import/apple-health/jobs/:jobId", (req, res) => {
    const context = resolveContext(req);
    if (!context) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const jobId = typeof req.params.jobId === "string" ? req.params.jobId : "";
    const job = getImportJob(context.db, jobId);
    if (!job) {
      res.status(404).json({ error: "Import job not found" });
      return;
    }

    res.json(job);
  });

  return router;
}

function parseRange(value: unknown): TimeRange {
  return value === "1d" ||
    value === "7d" ||
    value === "14d" ||
    value === "30d" ||
    value === "90d" ||
    value === "180d" ||
    value === "1y"
    ? value
    : "30d";
}

function createImportJob(db: Database.Database, jobId: string, fileName: string, filePath: string): void {
  db.prepare(
    `
      INSERT INTO import_jobs (id, file_name, file_path, status)
      VALUES (?, ?, ?, 'queued')
    `
  ).run(jobId, fileName, filePath);
}

function getImportJob(db: Database.Database, jobId: string): AppleImportJobPayload | null {
  const row = db.prepare(
    `
      SELECT id, file_name, status, result_json, error_message
      FROM import_jobs
      WHERE id = ?
      LIMIT 1
    `
  ).get(jobId) as {
    id: string;
    file_name: string;
    status: "queued" | "running" | "completed" | "failed";
    result_json: string | null;
    error_message: string | null;
  } | undefined;

  if (!row) {
    return null;
  }

  return {
    jobId: row.id,
    fileName: row.file_name,
    status: row.status,
    result: row.result_json ? (JSON.parse(row.result_json) as AppleImportJobPayload["result"]) : undefined,
    error: row.error_message ?? undefined
  };
}

async function runImportJob(db: Database.Database, jobId: string, filePath: string, config: AppConfig): Promise<void> {
  markImportJob(db, jobId, "running");
  try {
    const result = await importAppleHealthZip(db, filePath, config);
    markImportJob(
      db,
      jobId,
      "completed",
      JSON.stringify({
        ...result,
        importMode: "apple_xml_manual"
      })
    );
  } catch (error) {
    markImportJob(db, jobId, "failed", undefined, error instanceof Error ? error.message : "Import failed");
  } finally {
    fs.rmSync(filePath, { force: true });
  }
}

function markImportJob(
  db: Database.Database,
  jobId: string,
  status: "queued" | "running" | "completed" | "failed",
  resultJson?: string,
  errorMessage?: string
): void {
  db.prepare(
    `
      UPDATE import_jobs
      SET status = ?, result_json = COALESCE(?, result_json), error_message = COALESCE(?, error_message), updated_at = datetime('now')
      WHERE id = ?
    `
  ).run(status, resultJson ?? null, errorMessage ?? null, jobId);
}
