import chokidar from "chokidar";
import type Database from "better-sqlite3";
import type { AppConfig } from "../server/config.js";
import { ingestFile } from "./service.js";

export function startFileWatchers(db: Database.Database, config: AppConfig): () => Promise<void> {
  const timers = new Map<string, NodeJS.Timeout>();
  const watchTargets = [config.metrics_folder, config.workouts_folder];
  const watcher = chokidar.watch(watchTargets, {
    ignoreInitial: true,
    persistent: true
  });

  const schedule = (filePath: string, fileType: "metrics" | "workouts") => {
    if (!filePath.endsWith(".json")) {
      return;
    }

    const existing = timers.get(filePath);
    if (existing) {
      clearTimeout(existing);
    }

    timers.set(
      filePath,
      setTimeout(async () => {
        timers.delete(filePath);
        try {
          await ingestFile(db, filePath, fileType, config);
        } catch (error) {
          console.error(`Failed ingest for ${filePath}`, error);
        }
      }, 2000)
    );
  };

  watcher.on("add", (filePath) =>
    schedule(filePath, filePath.includes("Workouts") ? "workouts" : "metrics")
  );
  watcher.on("change", (filePath) =>
    schedule(filePath, filePath.includes("Workouts") ? "workouts" : "metrics")
  );

  return async () => {
    await watcher.close();
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
  };
}
