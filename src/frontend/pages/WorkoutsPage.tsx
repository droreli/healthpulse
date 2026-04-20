import { useEffect, useState } from "react";
import CalendarHeatmap from "../components/charts/CalendarHeatmap";
import HRZoneBar from "../components/charts/HRZoneBar";
import TrendLine from "../components/charts/TrendLine";
import TimeRangeSelector from "../components/TimeRangeSelector";
import { useHealthData } from "../hooks/useHealthData";
import { useTimeRange } from "../hooks/useTimeRange";
import type { WorkoutsPayload } from "../lib/contracts";
import { formatDurationMinutes } from "../lib/format";

export default function WorkoutsPage() {
  const range = useTimeRange((state) => state.range);
  const { data, loading, error } = useHealthData<WorkoutsPayload>(`/api/workouts?range=${range}`);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [expandedWorkoutId, setExpandedWorkoutId] = useState<string | null>(null);
  const latestWeek = data?.weeklyRunning?.at(-1);
  const selectedWorkouts =
    data?.workouts.filter((workout) => workoutDate(String(workout.start_time)) === selectedDate) ?? [];
  const recentWorkoutKeys = new Set((data?.workouts.slice(0, 10) ?? []).map((workout) => workoutKey(workout)));
  const selectedExpandedWorkout =
    selectedWorkouts.find((workout) => workoutKey(workout) === expandedWorkoutId) ?? selectedWorkouts[0] ?? null;

  useEffect(() => {
    if (!data) {
      return;
    }

    const availableDates = new Set(data.heatmap.map((day) => day.date));
    if (selectedDate && availableDates.has(selectedDate)) {
      return;
    }

    const firstWorkoutDate = data.workouts[0]?.start_time ? workoutDate(String(data.workouts[0].start_time)) : null;
    const firstActiveHeatmapDate = data.heatmap
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .find((day) => day.count > 0)?.date;
    setSelectedDate(firstActiveHeatmapDate ?? firstWorkoutDate);
  }, [data, selectedDate, range]);

  useEffect(() => {
    if (!expandedWorkoutId || !data) {
      return;
    }

    const stillExists = data.workouts.some((workout) => workoutKey(workout) === expandedWorkoutId);
    if (!stillExists) {
      setExpandedWorkoutId(null);
    }
  }, [data, expandedWorkoutId]);

  if (loading) return <div className="text-text-secondary">Loading workouts…</div>;
  if (error || !data) return <div className="text-red-300">Failed to load workouts: {error}</div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-text-secondary">Training</p>
          <h2 className="mt-2 text-4xl font-semibold text-white">Workout load and heart-rate zones</h2>
        </div>
        <TimeRangeSelector />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr,1fr]">
        <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-medium text-white">Workout calendar</h3>
          <div className="mt-4">
            <CalendarHeatmap data={data.heatmap} selectedDate={selectedDate} onSelect={setSelectedDate} />
          </div>
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">Selected day</p>
                <h4 className="mt-1 text-xl font-medium text-white">
                  {selectedDate ? formatDayLabel(selectedDate) : "Pick a day"}
                </h4>
              </div>
              <p className="text-sm text-text-secondary">
                {selectedDate ? `${selectedWorkouts.length} workout${selectedWorkouts.length === 1 ? "" : "s"}` : "Click a tile"}
              </p>
            </div>
            <div className="mt-4 space-y-3">
              {selectedDate ? (
                selectedWorkouts.length > 0 ? (
                  selectedWorkouts.map((workout) => (
                    <button
                      key={workoutKey(workout)}
                      type="button"
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        expandedWorkoutId === workoutKey(workout)
                          ? "border-white/30 bg-white/10"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                      onClick={() => {
                        const key = workoutKey(workout);
                        setExpandedWorkoutId(key);
                        if (recentWorkoutKeys.has(key)) {
                          const target = document.getElementById(`workout-${String(workout.start_time)}`);
                          target?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }
                      }}
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-medium text-white">{String(workout.workout_type)}</p>
                          <p className="text-sm text-text-secondary">{formatWorkoutTimestamp(String(workout.start_time))}</p>
                        </div>
                        <div className="text-sm text-text-secondary">{primaryWorkoutMetric(workout)}</div>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-text-secondary">
                    No workouts on this date.
                  </p>
                )
              ) : (
                <p className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-text-secondary">
                  Click a day in the calendar to inspect workouts.
                </p>
              )}
            </div>
            {selectedExpandedWorkout && !recentWorkoutKeys.has(workoutKey(selectedExpandedWorkout)) ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">Expanded workout</p>
                    <p className="mt-2 text-lg font-medium text-white">{String(selectedExpandedWorkout.workout_type)}</p>
                  </div>
                  <div className="text-sm text-text-secondary">{formatWorkoutTimestamp(String(selectedExpandedWorkout.start_time))}</div>
                </div>
                <WorkoutDetailsContent workout={selectedExpandedWorkout} />
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-medium text-white">Weekly running distance</h3>
          <p className="mt-1 text-sm text-text-secondary">
            {latestWeek ? `Latest week: ${latestWeek.label}` : "No running data in this range yet."}
          </p>
          <div className="mt-4 h-72">
            <TrendLine
              data={data.weeklyRunning}
              lines={[{ key: "totalKm", color: "#FF453A", name: "Running km", valueFormatter: (value) => `${value.toFixed(2)} km` }]}
              axes={[{ id: "left", tickFormatter: (value) => `${value.toFixed(0)} km`, domain: [0, "dataMax + 1"] }]}
            />
          </div>
        </section>
      </div>

      <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
        <h3 className="text-lg font-medium text-white">Recent workouts</h3>
        <div className="mt-4 space-y-4">
          {data.workouts.slice(0, 10).map((workout) => (
            <details
              key={workoutKey(workout)}
              id={`workout-${String(workout.start_time)}`}
              className="rounded-2xl bg-black/20 p-4"
              open={expandedWorkoutId === workoutKey(workout)}
            >
              <summary
                className="cursor-pointer list-none"
                onClick={(event) => {
                  event.preventDefault();
                  setExpandedWorkoutId((current) => (current === workoutKey(workout) ? null : workoutKey(workout)));
                }}
              >
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-lg font-medium text-white">{String(workout.workout_type)}</p>
                    <p className="text-sm text-text-secondary">{formatWorkoutTimestamp(String(workout.start_time))}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm text-text-secondary lg:grid-cols-4">
                    <span>{primaryWorkoutMetric(workout)}</span>
                    <span>{valueLabel(durationMinutes(workout.duration_seconds), "min", 0)}</span>
                    <span>{valueLabel(workout.avg_heart_rate, "bpm", 0)}</span>
                    <span>{valueLabel(zone2Pct(workout), "%", 0)} Zone 2</span>
                  </div>
                </div>
              </summary>
              <WorkoutDetailsContent workout={workout} />
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

function zonesFromWorkout(workout: Record<string, unknown>) {
  return [
    { label: "Z1", seconds: numeric(workout.zone1_seconds) ?? 0 },
    { label: "Z2", seconds: numeric(workout.zone2_seconds) ?? 0 },
    { label: "Z3", seconds: numeric(workout.zone3_seconds) ?? 0 },
    { label: "Z4", seconds: numeric(workout.zone4_seconds) ?? 0 },
    { label: "Z5", seconds: numeric(workout.zone5_seconds) ?? 0 }
  ];
}

function zone2Pct(workout: Record<string, unknown>) {
  const zone2 = numeric(workout.zone2_seconds) ?? 0;
  const zoneTotal =
    (numeric(workout.zone1_seconds) ?? 0) +
    (numeric(workout.zone2_seconds) ?? 0) +
    (numeric(workout.zone3_seconds) ?? 0) +
    (numeric(workout.zone4_seconds) ?? 0) +
    (numeric(workout.zone5_seconds) ?? 0);
  return zoneTotal > 0 ? (zone2 / zoneTotal) * 100 : null;
}

function zone2Detail(workout: Record<string, unknown>) {
  const zone2 = numeric(workout.zone2_seconds);
  const duration = numeric(workout.duration_seconds);
  if (zone2 === null || duration === null || duration <= 0) {
    return "—";
  }
  return `${Math.round(zone2 / 60)}m (${zone2Pct(workout)?.toFixed(0)}%)`;
}

function durationMinutes(value: unknown) {
  const numericValue = numeric(value);
  return numericValue !== null ? numericValue / 60 : null;
}

function valueLabel(value: unknown, unit: string, digits = 1) {
  const numericValue = numeric(value);
  return numericValue !== null ? `${numericValue.toFixed(digits)} ${unit}` : "—";
}

function primaryWorkoutMetric(workout: Record<string, unknown>) {
  const distance = numeric(workout.distance_km);
  if (distance !== null) {
    return `${distance.toFixed(1)} km`;
  }

  const calories = numeric(workout.active_energy_kcal);
  if (calories !== null) {
    return `${Math.round(calories)} kcal`;
  }

  const pace = numeric(workout.avg_pace_min_per_km);
  if (pace !== null) {
    return `${pace.toFixed(2)} min/km`;
  }

  const zone2 = numeric(workout.zone2_seconds);
  if (zone2 !== null) {
    return `${Math.round(zone2 / 60)} min`;
  }

  return "—";
}

function numeric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function workoutDate(value: string) {
  return value.slice(0, 10);
}

function MiniPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">{label}</p>
      <p className="mt-2 text-xl font-medium text-white">{value}</p>
    </div>
  );
}

function WorkoutDetailsContent({ workout }: { workout: Record<string, unknown> }) {
  const heartRateSeries = safeHeartRateSeries(workout.heart_rate_data);

  return (
    <div className="mt-5 space-y-5">
      <HRZoneBar zones={zonesFromWorkout(workout)} />
      {heartRateSeries.length > 1 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">Heart-rate trace</p>
              <p className="mt-2 text-sm text-text-secondary">Average heart rate across the workout window.</p>
            </div>
            <p className="text-sm text-text-secondary">{heartRateSeries.length} points</p>
          </div>
          <div className="mt-4 h-48">
            <TrendLine
              data={heartRateSeries}
              lines={[{ key: "Avg", color: "#FF375F", name: "Avg HR", valueFormatter: (value) => `${value.toFixed(0)} bpm` }]}
              axes={[{ id: "left", tickFormatter: (value) => `${value.toFixed(0)}` }]}
              xTickFormatter={formatWorkoutTimeTick}
              tooltipLabelFormatter={formatWorkoutTooltipLabel}
            />
          </div>
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <MiniPanel label="Distance" value={valueLabel(workout.distance_km, "km", 2)} />
        <MiniPanel label="Avg pace" value={valueLabel(workout.avg_pace_min_per_km, "min/km", 2)} />
        <MiniPanel label="Calories" value={valueLabel(workout.active_energy_kcal, "kcal", 0)} />
        <MiniPanel label="Avg HR" value={valueLabel(workout.avg_heart_rate, "bpm", 0)} />
        <MiniPanel label="Max HR" value={valueLabel(workout.max_heart_rate, "bpm", 0)} />
        <MiniPanel label="Duration" value={formatDurationMinutes(durationMinutes(workout.duration_seconds))} />
        <MiniPanel label="Zone 2" value={zone2Detail(workout)} />
        <MiniPanel label="Workout load" value={primaryWorkoutMetric(workout)} />
      </div>
    </div>
  );
}

function safeHeartRateSeries(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (point): point is { date: string; Avg: number } =>
      Boolean(point) &&
      typeof point === "object" &&
      typeof (point as { date?: unknown }).date === "string" &&
      typeof (point as { Avg?: unknown }).Avg === "number"
  );
}

function formatWorkoutTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDayLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric"
  }).format(new Date(`${date}T00:00:00Z`));
}

function formatWorkoutTimeTick(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatWorkoutTooltipLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function workoutKey(workout: Record<string, unknown>) {
  return `${String(workout.workout_type)}-${String(workout.start_time)}`;
}
