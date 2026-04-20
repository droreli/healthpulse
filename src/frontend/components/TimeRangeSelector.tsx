import { useTimeRange } from "../hooks/useTimeRange";
import type { TimeRange } from "../lib/contracts";

const ranges: Array<{ value: TimeRange; label: string }> = [
  { value: "1d", label: "1D" },
  { value: "7d", label: "7D" },
  { value: "14d", label: "14D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "180d", label: "180D" },
  { value: "1y", label: "1Y" }
];

export default function TimeRangeSelector() {
  const range = useTimeRange((state) => state.range);
  const setRange = useTimeRange((state) => state.setRange);

  return (
    <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
      {ranges.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setRange(option.value)}
          aria-pressed={option.value === range}
          className={`rounded-full px-4 py-2 text-sm transition ${
            option.value === range ? "bg-white text-black" : "text-text-secondary hover:text-white"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
