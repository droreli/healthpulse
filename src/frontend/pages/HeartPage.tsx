import RecoveryGauge from "../components/charts/RecoveryGauge";
import TrendLine from "../components/charts/TrendLine";
import TimeRangeSelector from "../components/TimeRangeSelector";
import { useHealthData } from "../hooks/useHealthData";
import { useTimeRange } from "../hooks/useTimeRange";
import type { HeartPayload } from "../lib/contracts";

export default function HeartPage() {
  const range = useTimeRange((state) => state.range);
  const { data, loading, error } = useHealthData<HeartPayload>(`/api/heart?range=${range}`);

  if (loading) return <div className="text-text-secondary">Loading heart metrics…</div>;
  if (error || !data) return <div className="text-red-300">Failed to load heart metrics: {error}</div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-text-secondary">Recovery</p>
          <h2 className="mt-2 text-4xl font-semibold text-white">Heart strain and baseline recovery</h2>
        </div>
        <TimeRangeSelector />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr,0.8fr]">
        <section className="space-y-5">
          <Panel title="HRV">
            <div className="h-64">
              <TrendLine
                data={data.series.hrv}
                lines={[
                  { key: "value", color: "#64D2FF", name: "HRV" },
                  { key: "avg7", color: "#5E5CE6", name: "7d avg" },
                  { key: "avg14", color: "#30D158", name: "14d avg" }
                ]}
              />
            </div>
          </Panel>
          <Panel title="Resting HR">
            <div className="h-64">
              <TrendLine
                data={data.series.restingHr}
                lines={[
                  { key: "value", color: "#FF453A", name: "Resting HR" },
                  { key: "avg7", color: "#FF9F0A", name: "7d avg" },
                  { key: "avg14", color: "#8E8E93", name: "14d avg" }
                ]}
              />
            </div>
          </Panel>
          <Panel title="VO2 Max">
            <div className="h-64">
              <TrendLine data={data.series.vo2} lines={[{ key: "value", color: "#5AC8FA", name: "VO2 Max" }]} />
            </div>
          </Panel>
        </section>

        <section className="space-y-5">
          <RecoveryGauge score={data.recovery.score} color={data.recovery.color} label={data.recovery.label} />
          <Panel title="Recovery basis">
            <p className="text-sm leading-6 text-text-secondary">{data.recovery.basis}</p>
            {data.recovery.degradedNote ? (
              <p className="mt-3 text-sm text-amber-300">{data.recovery.degradedNote}</p>
            ) : (
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-text-secondary">
                Personal heuristic, not medical advice
              </p>
            )}
          </Panel>
          <Panel title="VO2 classifications">
            <div className="space-y-3">
              {data.vo2Bands.map((band) => (
                <div key={band.label} className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                  <span className="text-text-secondary">{band.label}</span>
                  <span className="font-medium text-white">{band.min.toFixed(1)}+</span>
                </div>
              ))}
            </div>
          </Panel>
        </section>
      </div>
    </div>
  );
}

function Panel({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
      <h3 className="text-lg font-medium text-white">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}
