import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDatabase, loadConfig, setConfigValue } from "../../src/db/client.js";

export function createTestContext() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "healthpulse-"));
  const dbPath = path.join(root, "data.db");
  const metricsDir = path.join(root, "metrics");
  const workoutsDir = path.join(root, "workouts");
  fs.mkdirSync(metricsDir, { recursive: true });
  fs.mkdirSync(workoutsDir, { recursive: true });

  const db = openDatabase(dbPath);
  setConfigValue(db, "metrics_folder", metricsDir);
  setConfigValue(db, "workouts_folder", workoutsDir);

  return {
    root,
    db,
    metricsDir,
    workoutsDir,
    config: loadConfig(db),
    cleanup() {
      db.close();
      fs.rmSync(root, { recursive: true, force: true });
    }
  };
}
