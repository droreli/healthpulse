export default function CalendarHeatmap({
  data,
  selectedDate,
  onSelect
}: {
  data: Array<{ date: string; count: number }>;
  selectedDate?: string | null;
  onSelect?: (date: string) => void;
}) {
  const byDate = new Map(data.map((entry) => [entry.date, entry.count]));
  const dates = [...byDate.keys()].sort();

  if (dates.length === 0) {
    return <div className="text-sm text-text-secondary">No workouts in this range yet.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-2 text-[11px] uppercase tracking-[0.18em] text-text-secondary">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div key={day} className="px-2">
            {day}
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {groupByMonth(dates).map((group) => (
          <div key={group.monthKey} className="space-y-2">
            <div className="text-sm font-medium text-white">{group.monthLabel}</div>
            <div className="grid grid-cols-7 gap-2">
              {group.dates.map((date) => {
                const count = byDate.get(date) ?? 0;
                const opacity = Math.min(1, count / 4);
                return (
                  <button
                    type="button"
                    key={date}
                    className={`rounded-2xl p-3 text-left text-xs text-white transition-transform hover:-translate-y-0.5 ${
                      selectedDate === date ? "ring-2 ring-white/70" : ""
                    }`}
                    onClick={() => onSelect?.(date)}
                    style={{ backgroundColor: `rgba(255, 55, 95, ${0.12 + opacity * 0.38})` }}
                    title={`${date}: ${count} workout(s)`}
                  >
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-white/70">
                      <span>{formatMonthDay(date)}</span>
                      <span>{count}</span>
                    </div>
                    <div className="mt-3 text-lg font-semibold">{count === 0 ? "0" : `${count}`}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function groupByMonth(dates: string[]) {
  const groups: Array<{ monthKey: string; monthLabel: string; dates: string[] }> = [];
  for (const date of dates) {
    const monthKey = date.slice(0, 7);
    const monthLabel = formatMonthLabel(date);
    const last = groups[groups.length - 1];
    if (!last || last.monthKey !== monthKey) {
      groups.push({ monthKey, monthLabel, dates: [date] });
    } else {
      last.dates.push(date);
    }
  }
  return groups;
}

function formatMonthLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(`${date}T00:00:00Z`));
}

function formatMonthDay(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit" }).format(new Date(`${date}T00:00:00Z`));
}
