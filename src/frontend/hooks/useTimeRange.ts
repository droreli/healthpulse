import { create } from "zustand";
import type { TimeRange } from "../lib/contracts";

interface TimeRangeState {
  range: TimeRange;
  setRange: (range: TimeRange) => void;
}

export const useTimeRange = create<TimeRangeState>((set) => ({
  range: "30d",
  setRange: (range) => set({ range })
}));
