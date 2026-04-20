import type Database from "better-sqlite3";
import type { AppConfig } from "../server/config.js";
import { buildWeeklyReview } from "../evidence/weekly-summary.js";

export function getWeeklyReviewPayload(db: Database.Database, config: AppConfig, week?: string) {
  return buildWeeklyReview(db, config, week);
}
