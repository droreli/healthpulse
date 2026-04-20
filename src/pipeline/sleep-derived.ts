import type Database from "better-sqlite3";

export function rebuildSleepDerivedFields(db: Database.Database): void {
  db.exec(`
    UPDATE sleep_sessions
    SET
      sleep_efficiency = CASE
        WHEN asleep_hours IS NOT NULL AND in_bed_hours IS NOT NULL AND in_bed_hours > 0
        THEN ROUND((asleep_hours / in_bed_hours) * 100, 1)
        ELSE NULL
      END,
      deep_pct = CASE
        WHEN deep_hours IS NOT NULL AND total_sleep_hours IS NOT NULL AND total_sleep_hours > 0
        THEN ROUND((deep_hours / total_sleep_hours) * 100, 1)
        ELSE NULL
      END,
      rem_pct = CASE
        WHEN rem_hours IS NOT NULL AND total_sleep_hours IS NOT NULL AND total_sleep_hours > 0
        THEN ROUND((rem_hours / total_sleep_hours) * 100, 1)
        ELSE NULL
      END,
      core_pct = CASE
        WHEN core_hours IS NOT NULL AND total_sleep_hours IS NOT NULL AND total_sleep_hours > 0
        THEN ROUND((core_hours / total_sleep_hours) * 100, 1)
        ELSE NULL
      END,
      awake_minutes = CASE
        WHEN in_bed_hours IS NOT NULL AND total_sleep_hours IS NOT NULL
        THEN ROUND((in_bed_hours - total_sleep_hours) * 60, 1)
        ELSE NULL
      END
  `);
}
