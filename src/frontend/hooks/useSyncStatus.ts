import type { SyncStatusPayload } from "../lib/contracts";
import { useHealthData } from "./useHealthData";

export function useSyncStatus() {
  return useHealthData<SyncStatusPayload>("/api/sync-status", 30000);
}
