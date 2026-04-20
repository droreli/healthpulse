export interface AppleImportResult {
  skipped: boolean;
  fileName: string;
  recordsIngested: number;
  samplesIngested: number;
  workoutsIngested: number;
  sleepSessionsUpdated: number;
  exportDate: string | null;
  cutoffDate: string | null;
  warnings: string[];
}
