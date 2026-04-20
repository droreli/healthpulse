import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { DEFAULT_CONFIG, DEFAULT_DATA_DIR, DEFAULT_DB_PATH, type AppConfig, type ConfigKey } from "../server/config.js";

const MIGRATIONS_TABLE = "schema_migrations";

export function openDatabase(dbPath = DEFAULT_DB_PATH): Database.Database {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
  seedDefaultConfig(db);
  return db;
}

export function ensureDataDir(): string {
  fs.mkdirSync(DEFAULT_DATA_DIR, { recursive: true });
  return DEFAULT_DATA_DIR;
}

function applyMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const migrationDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "migrations");
  const files = fs.readdirSync(migrationDir).filter((file) => file.endsWith(".sql")).sort();
  const applied = new Set<string>(
    db.prepare(`SELECT version FROM ${MIGRATIONS_TABLE}`).all().map((row) => (row as { version: string }).version)
  );

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationDir, file), "utf8");
    const transaction = db.transaction(() => {
      db.exec(sql);
      db.prepare(`INSERT INTO ${MIGRATIONS_TABLE} (version) VALUES (?)`).run(file);
    });
    transaction();
  }
}

export function seedDefaultConfig(db: Database.Database): void {
  const insert = db.prepare("INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)");
  for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
    insert.run(key, String(value));
  }
}

export function loadConfig(db: Database.Database): AppConfig {
  const rows = db.prepare("SELECT key, value FROM config").all() as Array<{ key: ConfigKey; value: string }>;
  const merged = { ...DEFAULT_CONFIG };

  for (const row of rows) {
    if (!(row.key in merged)) {
      continue;
    }

    if (typeof DEFAULT_CONFIG[row.key] === "number") {
      // better-sqlite stores config values as text to keep the table generic.
      (merged as Record<string, unknown>)[row.key] = Number(row.value);
    } else {
      (merged as Record<string, unknown>)[row.key] = row.value;
    }
  }

  return merged;
}

export function setConfigValue(db: Database.Database, key: ConfigKey, value: string | number): void {
  db.prepare(`
    INSERT INTO config (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value));
}
