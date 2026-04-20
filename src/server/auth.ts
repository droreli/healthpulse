import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { DEFAULT_DATA_DIR, DEFAULT_DB_PATH } from "./config.js";

const AUTH_DB_PATH = path.join(DEFAULT_DATA_DIR, "auth.db");
const SESSION_COOKIE = "healthpulse_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_BYTES = 64;

export interface AuthUser {
  id: number;
  username: string;
  data_db_path: string;
}

interface SessionRow {
  token_hash: string;
  user_id: number;
  expires_at: number;
}

let authDb: Database.Database | null = null;

export function getAuthDb(): Database.Database {
  if (authDb) {
    return authDb;
  }

  fs.mkdirSync(DEFAULT_DATA_DIR, { recursive: true });
  authDb = new Database(AUTH_DB_PATH);
  authDb.pragma("journal_mode = WAL");
  authDb.pragma("foreign_keys = ON");
  applyMigrations(authDb);
  return authDb;
}

export function closeAuthDb(): void {
  if (!authDb) {
    return;
  }
  authDb.close();
  authDb = null;
}

export function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(";").reduce<Record<string, string>>((acc, part) => {
    const index = part.indexOf("=");
    if (index === -1) {
      return acc;
    }

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) {
      acc[key] = decodeURIComponent(value);
    }
    return acc;
  }, {});
}

export function getCookieName(): string {
  return SESSION_COOKIE;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(PASSWORD_SALT_BYTES).toString("hex");
  const derived = crypto.scryptSync(password, salt, PASSWORD_KEY_BYTES).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [scheme, salt, expected] = storedHash.split("$");
  if (scheme !== "scrypt" || !salt || !expected) {
    return false;
  }

  const actual = crypto.scryptSync(password, salt, PASSWORD_KEY_BYTES).toString("hex");
  if (actual.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function usernameKey(username: string): string {
  return normalizeUsername(username).toLowerCase();
}

export function slugifyUsername(username: string): string {
  return usernameKey(username).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "user";
}

export function defaultDataDbPath(username: string): string {
  return path.join(DEFAULT_DATA_DIR, "users", slugifyUsername(username), "data.db");
}

export function issueSession(db: Database.Database, userId: number): string {
  const token = crypto.randomUUID();
  const tokenHash = hashSessionToken(token);
  const expiresAt = Date.now() + SESSION_TTL_MS;

  db.prepare(
    `
      INSERT INTO sessions (token_hash, user_id, expires_at)
      VALUES (?, ?, ?)
    `
  ).run(tokenHash, userId, expiresAt);

  return token;
}

export function deleteSession(db: Database.Database, token: string): void {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashSessionToken(token));
}

export function findSessionUser(db: Database.Database, cookieHeader: string | undefined): AuthUser | null {
  const cookies = parseCookieHeader(cookieHeader);
  const token = cookies[SESSION_COOKIE];
  if (!token) {
    return null;
  }

  const session = db.prepare(
    `
      SELECT token_hash, user_id, expires_at
      FROM sessions
      WHERE token_hash = ? AND expires_at > ?
      LIMIT 1
    `
  ).get(hashSessionToken(token), Date.now()) as SessionRow | undefined;

  if (!session) {
    return null;
  }

  const user = db.prepare(
    `
      SELECT id, username, data_db_path
      FROM users
      WHERE id = ?
      LIMIT 1
    `
  ).get(session.user_id) as AuthUser | undefined;

  return user ?? null;
}

export function createUserAccount(db: Database.Database, username: string, password: string): AuthUser {
  const trimmed = normalizeUsername(username);
  if (!trimmed) {
    throw new Error("Username is required");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const key = usernameKey(trimmed);
  const existing = db.prepare("SELECT id FROM users WHERE username_key = ? LIMIT 1").get(key) as { id: number } | undefined;
  if (existing) {
    throw new Error("Username is already taken");
  }

  const nextUserCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  const dataDbPath = nextUserCount.count === 0 ? DEFAULT_DB_PATH : defaultDataDbPath(trimmed);
  fs.mkdirSync(path.dirname(dataDbPath), { recursive: true });

  const insert = db.prepare(
    `
      INSERT INTO users (username, username_key, password_hash, data_db_path)
      VALUES (?, ?, ?, ?)
    `
  );
  const result = insert.run(trimmed, key, hashPassword(password), dataDbPath);
  return {
    id: Number(result.lastInsertRowid),
    username: trimmed,
    data_db_path: dataDbPath
  };
}

export function authenticateUser(db: Database.Database, username: string, password: string): AuthUser | null {
  const key = usernameKey(username);
  const user = db.prepare(
    `
      SELECT id, username, password_hash, data_db_path
      FROM users
      WHERE username_key = ?
      LIMIT 1
    `
  ).get(key) as AuthUser & { password_hash: string } | undefined;

  if (!user || !verifyPassword(password, user.password_hash)) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    data_db_path: user.data_db_path
  };
}

export function buildSessionCookie(token: string, isSecure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  ];

  if (isSecure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function clearSessionCookie(isSecure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0"
  ];

  if (isSecure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

type HeaderBag = Record<string, string | string[] | undefined>;

export function isSecureRequest(request: { headers: HeaderBag }): boolean {
  const forwardedProto = headerValue(request.headers, "x-forwarded-proto");
  const cfVisitor = headerValue(request.headers, "cf-visitor");
  return forwardedProto === "https" || cfVisitor?.includes("\"scheme\":\"https\"") === true;
}

export function cleanupExpiredSessions(db: Database.Database): void {
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
}

function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function headerValue(headers: HeaderBag, name: string): string | null {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return typeof value === "string" ? value : null;
}

function applyMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      username_key TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      data_db_path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_users_username_key ON users(username_key);
  `);
}
