import { useState } from "react";
import AppleImportPanel from "../components/AppleImportPanel";
import { CompareBars, CorrMatrix, HeatCalendar, LineChart, PaceSplits, Ring, Scatter, SleepStages, Sparkline, WorkoutSessionChart, ZoneBar } from "./charts";
import { annotationOptions, clip, corr, formatClock, formatModelDate, formatPace, groupWorkoutsByDay, rangeDays, shift, type AnnotationView, type UiRange, type WorkbenchModel, type WorkoutView } from "./model";
import { RangePills } from "./Sidebar";

interface PageProps {
  model: WorkbenchModel;
  range: UiRange;
  onRangeChange: (range: UiRange) => void;
}

interface SettingsProps extends PageProps {
  saving: boolean;
  onImported: () => Promise<void>;
  onCreateAnnotation: (input: { date: string; kind: string; label: string }) => Promise<void>;
  onUpdateAnnotation: (id: number, input: { date: string; kind: string; label: string }) => Promise<void>;
  onDeleteAnnotation: (id: number) => Promise<void>;
}

export function EditorialDashboard({ model }: PageProps) {
  const today = model.today;
  const readyDelta = today.readiness - today.readinessYest;
  const hrvDelta = today.hrv - today.hrvBase;
  const rhrDelta = today.rhr - today.rhrBase;
  const last14Ready = model.readiness.slice(-14);
  const last14Hrv = model.hrv.slice(-14);
  const last14HrvBase = model.hrvBaseline.slice(-14);
  const last14Sleep = model.sleep.slice(-14);
  const last14Dates = model.dates.slice(-14);
  const recentWorkouts = model.workouts.filter((workout) => workout.date >= formatModelDate(model.dates.at(-7) ?? new Date(), "ymd"));
  const recentDistance = recentWorkouts.reduce((sum, workout) => sum + (workout.distance_km ?? 0), 0);
  const recentDuration = recentWorkouts.reduce((sum, workout) => sum + (workout.duration_min ?? 0), 0);
  const recentZone2 = recentWorkouts.reduce((sum, workout) => sum + (workout.zones[1] ?? 0), 0);
  const annotationPreview = model.annotations.slice(0, 6);

  return (
    <>
      <div style={mastheadStyle}>
        <div className="ed-byline">
          <span>Vol. II · № {String(model.dates.length).padStart(3, "0")}</span>
        </div>
        <div className="ed-byline" style={{ fontFamily: "var(--serif)", fontSize: 16, letterSpacing: "0.02em", textTransform: "none", color: "var(--ink-1)" }}>
          The Morning Edition
        </div>
        <div className="ed-byline">
          <span>{model.dates.at(-1)?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span>
        </div>
      </div>

      <div style={heroSplitStyle}>
        <div>
          <div className="label" style={{ marginBottom: 14 }}>
            Today's Reading
          </div>
          <h1 className="ed-headline" style={{ fontSize: 60 }}>
            Recovered, <em>underfueled</em> by sleep.
          </h1>
          <p className="ed-deck" style={{ fontSize: 19 }}>
            HRV sits {hrvDelta >= 0 ? "above" : "below"} baseline at {today.hrv.toFixed(1)}ms. Last night closed at {today.sleep.toFixed(1)}h with {today.sleepStages.rem.toFixed(1)}h REM. Readiness stays constructive, but the sleep debt still argues for an easier day.
          </p>
          <div style={{ display: "flex", gap: 32, marginTop: 28, paddingTop: 24, borderTop: "1px solid var(--line)", flexWrap: "wrap" }}>
            <NarrativeStat label="READINESS" value={today.readiness} unit="" delta={readyDelta} good={readyDelta >= 0} />
            <NarrativeStat label="HRV" value={today.hrv.toFixed(1)} unit="ms" delta={hrvDelta} good={hrvDelta >= 0} sub={`base ${today.hrvBase.toFixed(1)}`} />
            <NarrativeStat label="SLEEP" value={today.sleep.toFixed(1)} unit="h" delta={today.sleep - today.sleepStages.total} good={today.sleep >= 7} sub={`14D avg ${model.sleepBaseline.at(-1)?.toFixed(1) ?? "—"}h`} />
            <NarrativeStat label="RHR" value={today.rhr.toFixed(0)} unit="bpm" delta={rhrDelta} good={rhrDelta <= 0} sub={`base ${today.rhrBase.toFixed(1)}`} reverse />
          </div>
        </div>

        <div style={{ paddingLeft: 40, borderLeft: "1px solid var(--line-strong)" }}>
          <div className="label" style={{ marginBottom: 14 }}>
            The Forecast
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 20, flexWrap: "wrap" }}>
            <Ring value={today.readiness} size={120} thickness={4} color="var(--recov)" sub="Readiness" />
            <div>
              <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 20, lineHeight: 1.3, color: "var(--ink-1)" }}>"Easy aerobic or full rest."</div>
              <div className="tiny" style={{ marginTop: 8 }}>
                Personal heuristic · not medical advice
              </div>
            </div>
          </div>
          <div style={{ borderTop: "1px dotted var(--line-strong)", paddingTop: 14, marginTop: 14 }}>
            <div className="label" style={{ marginBottom: 10 }}>
              Three-Day Outlook
            </div>
            {[
              { day: "Today", readiness: today.readiness, advice: "Easy aerobic / rest" },
              { day: "Tomorrow", readiness: Math.min(99, today.readiness + 3), advice: "Longer Zone 2 if sleep recovers" },
              { day: "Next", readiness: Math.min(99, today.readiness + 5), advice: "Resume quality if HRV holds" }
            ].map((item) => (
              <div key={item.day} style={forecastRowStyle}>
                <span style={forecastDayStyle}>{item.day}</span>
                <span className="mono" style={{ color: "var(--ink-0)", fontSize: 13 }}>
                  {item.readiness}
                </span>
                <span style={{ fontFamily: "var(--serif)", fontStyle: "italic", color: "var(--ink-1)" }}>{item.advice}</span>
                <span style={{ width: 24, height: 4, background: `oklch(${60 + item.readiness * 0.3}% 0.12 150)`, borderRadius: 1 }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ borderTop: "3px double var(--line-strong)", marginBottom: 28 }} />

      <div style={threeColumnStyle}>
        <section>
          <div className="label" style={{ color: "var(--sleep)", marginBottom: 8 }}>
            Sleep
          </div>
          <h2 style={sectionHeadlineStyle}>A shorter night, but structure held.</h2>
          <div className="ed-body ed-dropcap" style={{ marginBottom: 12 }}>
            <p>
              Core at {percent(today.sleepStages.core, today.sleep)}, Deep at {percent(today.sleepStages.deep, today.sleep)}, REM at {percent(today.sleepStages.rem, today.sleep)}. Total sleep still trails the 14-day rolling mean of {model.sleepBaseline.at(-1)?.toFixed(1) ?? "—"}h.
            </p>
          </div>
          <LineChart data={last14Sleep} dates={last14Dates} width={360} height={88} stroke="oklch(70% 0.12 285)" area showAxis={false} showGrid={false} />
        </section>

        <section>
          <div className="label" style={{ color: "var(--heart)", marginBottom: 8 }}>
            Heart & Recovery
          </div>
          <h2 style={sectionHeadlineStyle}>HRV has returned toward baseline.</h2>
          <div className="ed-body ed-dropcap" style={{ marginBottom: 12 }}>
            <p>
              Morning HRV is {today.hrv.toFixed(1)}ms against a 14-day mean of {today.hrvBase.toFixed(1)}ms. Resting HR is {today.rhr.toFixed(0)} bpm, with the gap narrowing after the last few days of stable sleep.
            </p>
          </div>
          <LineChart data={last14Hrv} baseline={last14HrvBase} dates={last14Dates} width={360} height={88} stroke="oklch(68% 0.14 22)" showAxis={false} showGrid={false} />
        </section>

        <section>
          <div className="label" style={{ color: "var(--train)", marginBottom: 8 }}>
            Training
          </div>
          <h2 style={sectionHeadlineStyle}>{recentWorkouts.length > 0 ? "Load is steady, intensity drifts upward." : "Training is still waiting on imported sessions."}</h2>
          <div className="ed-body ed-dropcap" style={{ marginBottom: 12 }}>
            {recentWorkouts.length > 0 ? (
              <p>
                {recentWorkouts.length} sessions in the last seven days, totaling {recentDistance.toFixed(1)} km and {recentDuration.toFixed(0)} minutes. Zone 2 represented {recentDuration > 0 ? ((recentZone2 / recentDuration) * 100).toFixed(0) : "0"}% of running time.
              </p>
            ) : (
              <p>
                No workouts landed in the current account yet, so the training view is holding space for load, pace, and zone detail until the next Apple Health import completes.
              </p>
            )}
          </div>
          <LineChart data={model.steps.slice(-14)} dates={last14Dates} width={360} height={88} stroke="oklch(72% 0.13 55)" area showAxis={false} showGrid={false} />
        </section>
      </div>

      <div style={annotationStripStyle}>
        <div>
          <div className="label">Life events</div>
          <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", color: "var(--ink-2)", fontSize: 14, marginTop: 6 }}>Context for the numbers</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
          {annotationPreview.length > 0 ? (
            annotationPreview.map((annotation) => (
              <div key={annotation.id} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                <span style={{ fontSize: 12, color: "var(--ink-2)" }}>{annotation.dot}</span>
                <div>
                  <div style={annotationDateStyle}>{formatModelDate(model.dates[annotation.dayIdx], "short")}</div>
                  <div style={{ fontSize: 13, color: "var(--ink-1)" }}>{annotation.label}</div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 13, color: "var(--ink-2)", fontStyle: "italic" }}>
              No annotations yet. Add travel, alcohol, stress, or illness in Settings to layer context onto the charts.
            </div>
          )}
        </div>
      </div>

      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14, gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="label" style={{ marginBottom: 4 }}>
              Supplementary charts · 30 days
            </div>
            <h2 style={{ fontFamily: "var(--serif)", fontWeight: 400, fontSize: 30, margin: 0, letterSpacing: "-0.01em" }}>The long view</h2>
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>○ Annotation · life event</div>
        </div>
        <div className="card pad-lg">
          <div className="card-header">
            <h3 style={{ color: "var(--recov)" }}>Readiness composite</h3>
            <span className="label">hrv_z · rhr_z · sleep_z</span>
          </div>
          <LineChart
            data={model.readiness.slice(-30)}
            dates={model.dates.slice(-30)}
            width={1040}
            height={220}
            stroke="oklch(72% 0.12 150)"
            area
            annotations={model.annotations.map((annotation) => ({ ...annotation, dayIdx: annotation.dayIdx - (model.dates.length - 30) })).filter((annotation) => annotation.dayIdx >= 0)}
          />
        </div>
      </section>
    </>
  );
}

export function EditorialSleep({ model, range, onRangeChange }: PageProps) {
  const days = rangeDays(range);
  const stages = model.sleepStages.slice(-days);
  const dates = model.dates.slice(-days);
  const offset = model.dates.length - days;
  const [selectedSleepIndex, setSelectedSleepIndex] = useState<number | null>(null);
  const sleep = model.sleep.slice(-days);
  const avgSleep = average(sleep);
  const avgRem = average(stages.map((stage) => stage.rem));
  const avgDeep = average(stages.map((stage) => stage.deep));
  const avgAwake = average(stages.map((stage) => stage.awake));
  const normalizedBedtimes = stages.map((stage) => normalizeSleepWindowHour(stage.bedtime));
  const avgBedtime = average(normalizedBedtimes);
  const bedtimeDrift = Math.sqrt(average(normalizedBedtimes.map((bedtime) => (bedtime - avgBedtime) ** 2)));
  const deepShare = percentNumber(avgDeep, avgSleep);
  const remShare = percentNumber(avgRem, avgSleep);
  const efficiency = ((avgSleep - avgAwake) / Math.max(0.1, avgSleep)) * 100;
  const deepBandStatus = deepShare < 15 ? "below" : deepShare > 20 ? "above" : "inside";

  return (
    <>
      <PageHead eyebrow="Chapter II · Sleep" title="Night structure & rhythm" subtitle={`Last ${days} nights — duration, stage composition, and timing consistency.`} accent="var(--sleep)" range={range} onRangeChange={onRangeChange} />

      <div style={statGridStyle(3)}>
        <BigStat label="Avg duration" value={avgSleep.toFixed(1)} unit="h" sub={`14D avg ${model.sleepBaseline.at(-1)?.toFixed(1) ?? "—"}h`} color="var(--sleep)" />
        <BigStat label="Avg deep" value={deepShare.toFixed(1)} unit="% of night" sub={`${(avgDeep * 60).toFixed(0)} min`} color="var(--sleep)" />
        <BigStat label="Bedtime drift" value={bedtimeDrift.toFixed(1)} unit="h sd" sub="Std dev of sleep onset" color="var(--sleep)" />
      </div>

      <div className="grid g-12" style={{ marginBottom: 16 }}>
        <div className="card col-8 pad-lg">
          <div className="card-header">
            <h3>Stage composition</h3>
            <span className="label">click a night for full detail</span>
          </div>
          <SleepStages stages={stages} dates={dates} width={720} height={320} selectedIndex={selectedSleepIndex} onSelect={setSelectedSleepIndex} />
        </div>
        <div className="card col-4 pad-lg">
          <h3 style={{ marginBottom: 14 }}>Consistency</h3>
          <SleepWindowChart
            stages={stages.slice(-14)}
            dates={dates.slice(-14)}
            compact
            onSelect={(index) => setSelectedSleepIndex(Math.max(0, stages.length - 14 + index))}
            selectedIndex={selectedSleepIndex !== null && selectedSleepIndex >= Math.max(0, stages.length - 14) ? selectedSleepIndex - Math.max(0, stages.length - 14) : null}
          />
          <div style={{ borderTop: "1px dotted var(--line-strong)", paddingTop: 14, marginTop: 14 }}>
            <div className="label" style={{ marginBottom: 8 }}>
              Against benchmarks
            </div>
            {[
              ["Deep sleep share", "Common reference 15–20%", `${deepShare.toFixed(1)}% of your night`],
              ["REM sleep share", "Common reference 20–25%", `${remShare.toFixed(1)}% of your night`],
              ["Sleep efficiency", "Typical goal 85%+", `${efficiency.toFixed(1)}% asleep vs awake`]
            ].map(([label, target, value]) => (
              <div key={label} style={benchmarkRowStyle}>
                <span style={{ color: "var(--ink-1)" }}>{label}</span>
                <span>
                  <span className="mono" style={{ color: "var(--ink-3)", marginRight: 10, fontSize: 10 }}>
                    {target}
                  </span>
                  <span className="mono" style={{ color: "var(--ink-1)" }}>
                    {value}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid g-12" style={{ marginBottom: 16 }}>
        <div className="card col-8 pad-lg">
          <div className="label" style={{ color: "var(--sleep)", marginBottom: 10 }}>
            What this means
          </div>
          <h2 style={{ ...sectionHeadlineStyle, fontSize: 34 }}>Deep sleep is the slow-wave portion of sleep that supports overnight restoration.</h2>
          <div className="ed-body" style={{ fontSize: 14 }}>
            <p>
              Your average deep sleep share is {deepShare.toFixed(1)}% over the last {days} nights, which sits {deepBandStatus} the 15-20% reference band shown in this view. Deep sleep tends to cluster earlier in the night, so shorter nights and fragmented first-half sleep can pull the share down quickly.
            </p>
            <p>
              The biggest practical drags are often alcohol close to bedtime, inconsistent sleep timing, and simply not leaving enough total sleep opportunity. A steadier bedtime, less alcohol near bed, and a cool, dark, quiet room are usually the most reliable first levers.
            </p>
          </div>
        </div>
        <div className="card col-4 pad-lg">
          <div className="label" style={{ marginBottom: 10 }}>Signals worth watching</div>
          <div className="annot">
            <span className="d">DEEP</span>
            <span style={{ color: "var(--ink-1)" }}>{deepShare.toFixed(1)}% of sleep, {deepBandStatus} the reference band.</span>
          </div>
          <div className="annot">
            <span className="d">DRIFT</span>
            <span style={{ color: "var(--ink-1)" }}>{bedtimeDrift.toFixed(1)}h of bedtime variability, which suggests timing is part of the story.</span>
          </div>
          <div className="annot">
            <span className="d">CONTEXT</span>
            <span style={{ color: "var(--ink-1)" }}>
              {model.alcoholImpact.samples > 0
                ? "Alcohol annotations are present in this account, so the correlate page can help you check whether drinking nights line up with rougher mornings."
                : "If you start logging alcohol, travel, illness, or stress, the correlation view can turn these sleep changes into a clearer story."}
            </span>
          </div>
        </div>
      </div>

      <div className="card pad-lg">
        <div className="card-header">
          <h3>Nightly log</h3>
          <span className="label">duration · stages · bedtime</span>
        </div>
        <div className="sleep-log-header sleep-log-header--editorial">
          {["DATE", "TOTAL", "DEEP", "REM", "CORE", "BED", "WAKE"].map((label) => (
            <div key={label} style={{ color: "var(--ink-3)", padding: "4px 6px" }}>
              {label}
            </div>
          ))}
        </div>
        {stages
          .slice()
          .reverse()
          .slice(0, 14)
          .map((stage, index) => {
            const realIndex = stages.length - 1 - index;
            return (
              <button key={`${stage.total}-${index}`} type="button" onClick={() => setSelectedSleepIndex(realIndex)} className="sleep-log-row sleep-log-row--editorial">
                <div className="sleep-log-date">{formatModelDate(dates[realIndex], "full").replace(",", "")}</div>
                <div className="sleep-log-total">
                  {stage.total.toFixed(1)}
                  <span style={{ fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--mono)" }}>h</span>
                </div>
                <div className="sleep-log-segment">
                  <SegPct value={percentNumber(stage.deep, stage.total)} color="oklch(45% 0.12 265)" />
                </div>
                <div className="sleep-log-segment">
                  <SegPct value={percentNumber(stage.rem, stage.total)} color="oklch(70% 0.13 310)" />
                </div>
                <div className="sleep-log-segment">
                  <SegPct value={percentNumber(stage.core, stage.total)} color="oklch(62% 0.12 265)" />
                </div>
                <div className="sleep-log-time" data-label="Bed">{formatClock(stage.bedtime)}</div>
                <div className="sleep-log-time" data-label="Wake">{formatClock(stage.waketime)}</div>
              </button>
            );
          })}
      </div>
      <SleepDetailModal model={model} localIndex={selectedSleepIndex} offset={offset} dates={dates} stages={stages} onClose={() => setSelectedSleepIndex(null)} />
    </>
  );
}

export function EditorialWorkouts({ model, range, onRangeChange }: PageProps) {
  const [selected, setSelected] = useState<WorkoutView | null>(model.workouts[0] ?? null);
  const [selectedTrainingDayIndex, setSelectedTrainingDayIndex] = useState<number | null>(null);
  const days = rangeDays(range);
  const recent = workoutsInRange(model, days);
  const totalDistance = recent.reduce((sum, workout) => sum + (workout.distance_km ?? 0), 0);
  const totalMinutes = recent.reduce((sum, workout) => sum + (workout.duration_min ?? 0), 0);
  const zone2Minutes = recent.reduce((sum, workout) => sum + (workout.zones[1] ?? 0), 0);
  const grouped = groupWorkoutsByDay(model.workouts);
  const heatDates = model.dates.slice(-56);
  const heatValues = heatDates.map((date) => grouped.get(formatModelDate(date, "ymd"))?.reduce((sum, workout) => sum + (workout.duration_min ?? 0), 0) ?? 0);
  const loadDates = model.dates.slice(-days);
  const dailyMinutes = loadDates.map((date) => model.workouts.filter((workout) => workout.date === formatModelDate(date, "ymd")).reduce((sum, workout) => sum + (workout.duration_min ?? 0), 0));
  const current = recent.find((workout) => workout.id === selected?.id) ?? recent[0] ?? null;
  const selectedTrainingDate = selectedTrainingDayIndex === null ? null : heatDates[selectedTrainingDayIndex];
  const selectedTrainingKey = selectedTrainingDate ? formatModelDate(selectedTrainingDate, "ymd") : null;
  const selectedDayWorkouts = selectedTrainingKey ? grouped.get(selectedTrainingKey) ?? [] : [];

  if (recent.length === 0) {
    return (
      <>
        <PageHead eyebrow="Chapter III · Training" title="The cadence of the week" subtitle="Load and intensity distribution across recent sessions." accent="var(--train)" range={range} onRangeChange={onRangeChange} />

        <div style={statGridStyle(4)}>
          <BigStat label="Sessions" value={0} unit={`/${days}d`} sub="Selected window" color="var(--train)" />
          <BigStat label="Distance" value="0.0" unit="km" sub="Avg 0.0 km" color="var(--train)" />
          <BigStat label="Zone 2" value="0" unit="%" sub="Share of total minutes" color="var(--train)" />
          <BigStat label="Minutes" value="0" unit="min" sub="Aerobic volume" color="var(--train)" />
        </div>

        <div className="grid g-12">
          <div className="card col-7 pad-lg">
            <div className="label" style={{ color: "var(--train)", marginBottom: 10 }}>
              {model.workouts.length > 0 ? "Selected window is empty" : "Training import pending"}
            </div>
            <h2 style={sectionHeadlineStyle}>{model.workouts.length > 0 ? "No sessions landed in this date window." : "No workouts have been imported into this account yet."}</h2>
            <div className="ed-body" style={{ maxWidth: 620 }}>
              {model.workouts.length > 0
                ? `There are no workouts in the selected ${days}-day window. Switch to 30D or 90D to inspect older sessions, or wait for new workouts to land.`
                : "Once Apple Health contributes workout sessions, this page will turn into a session desk with route detail, splits, heart-rate zones, and recent-load patterns."}
            </div>
          </div>
          <div className="card col-5 pad-lg">
            <div className="label" style={{ marginBottom: 10 }}>
              Next step
            </div>
            <div className="ed-body" style={{ fontSize: 14 }}>
              Upload a fresh Apple Health `export.zip` from the `Settings` tab. After the importer finishes, training load, the 8-week calendar, and session-level drilldowns will populate automatically.
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead eyebrow="Chapter III · Training" title="The cadence of the week" subtitle="Load and intensity distribution across recent sessions." accent="var(--train)" range={range} onRangeChange={onRangeChange} />

      <div style={statGridStyle(4)}>
        <BigStat label="Sessions" value={recent.length} unit={`/${days}d`} sub="Selected window" color="var(--train)" />
        <BigStat label="Distance" value={totalDistance.toFixed(1)} unit="km" sub={`Avg ${(totalDistance / Math.max(1, recent.length)).toFixed(1)} km`} color="var(--train)" />
        <BigStat label="Zone 2" value={totalMinutes > 0 ? ((zone2Minutes / totalMinutes) * 100).toFixed(0) : "0"} unit="%" sub="Share of total minutes" color="var(--train)" />
        <BigStat label="Minutes" value={totalMinutes.toFixed(0)} unit="min" sub="Aerobic volume" color="var(--train)" />
      </div>

      <div className="grid g-12" style={{ marginBottom: 16 }}>
        <div className="card col-8 pad-lg">
          <div className="card-header">
            <h3>Session detail — {current ? formatModelDate(current.dateValue, "full") : "No workouts yet"}</h3>
            <span className="label">{current ? `${current.type} · ${current.distance_km?.toFixed(1) ?? "—"} km` : ""}</span>
          </div>
          {current ? <WorkoutSessionChart workout={current} color="var(--train)" width={720} height={220} /> : null}
          {current ? (
            <>
              <div style={miniMetricGridStyle}>
                <MiniStat label="Distance" value={current.distance_km?.toFixed(1) ?? "—"} unit="km" />
                <MiniStat label="Duration" value={current.duration_min?.toFixed(0) ?? "—"} unit="min" />
                <MiniStat label="Avg pace" value={formatPace(current.pace)} unit="/km" />
                <MiniStat label="Avg HR" value={current.avgHR?.toFixed(0) ?? "—"} unit="bpm" />
                <MiniStat label="Max HR" value={current.maxHR?.toFixed(0) ?? "—"} unit="bpm" />
                <MiniStat label="Cadence" value={current.cadence?.toFixed(0) ?? "—"} unit="spm" />
              </div>
              <div style={sectionBlockStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <div className="label">Zone distribution</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.08em" }}>Z1 · Z2 · Z3 · Z4 · Z5</div>
                </div>
                <ZoneBar zones={current.zones} height={14} />
              </div>
              <div style={sectionBlockStyle}>
                <div className="label" style={{ marginBottom: 10 }}>
                  Km splits
                </div>
                <PaceSplits splits={current.splits} color="var(--train)" />
              </div>
            </>
          ) : null}
        </div>

        <div className="card col-4 pad-lg">
          <h3 style={{ marginBottom: 14 }}>Recent sessions</h3>
          <div style={{ maxHeight: 640, overflow: "auto", margin: "0 -18px" }}>
            {recent.map((workout) => (
              <button key={workout.id} type="button" onClick={() => setSelected(workout)} style={{ ...workoutRowStyle, background: current?.id === workout.id ? "var(--bg-2)" : "transparent", borderLeft: current?.id === workout.id ? "2px solid var(--train)" : "2px solid transparent" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={annotationDateStyle}>{formatModelDate(workout.dateValue, "short")}</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)" }}>{formatPace(workout.pace)}/km</span>
                </div>
                <div style={{ fontFamily: "var(--serif)", fontSize: 20, color: "var(--ink-0)", lineHeight: 1 }}>
                  {workout.distance_km?.toFixed(1) ?? "—"}
                  <span style={{ fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--mono)", marginLeft: 4 }}>km</span>
                </div>
                <ZoneBar zones={workout.zones} height={4} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid g-12">
        <div className="card col-5 pad-lg">
          <div className="card-header">
            <h3>Training calendar — last 8 weeks</h3>
            <span className="label">click a loaded day for detail</span>
          </div>
          <HeatCalendar
            values={heatValues}
            dates={heatDates}
            width={420}
            color="oklch(72% 0.13 55)"
            valueFormatter={(value) => `${value.toFixed(0)} min of training`}
            selectedIndex={selectedTrainingDayIndex}
            onSelect={(index) => {
              if ((heatValues[index] ?? 0) <= 0) {
                return;
              }
              const date = heatDates[index];
              const workouts = grouped.get(formatModelDate(date, "ymd")) ?? [];
              setSelectedTrainingDayIndex(index);
              if (workouts[0]) {
                setSelected(workouts[0]);
              }
            }}
          />
        </div>
        <div className="card col-7 pad-lg">
          <div className="card-header">
            <h3>Daily load</h3>
            <span className="label">{days} day window</span>
          </div>
          <LineChart
            data={dailyMinutes}
            dates={loadDates}
            width={620}
            height={190}
            stroke="var(--train)"
            area
            tooltipLabel="Training"
            tooltipValueFormatter={(value) => `${value.toFixed(0)} min`}
          />
        </div>
      </div>
      <TrainingDayModal date={selectedTrainingDate} workouts={selectedDayWorkouts} onClose={() => setSelectedTrainingDayIndex(null)} />
    </>
  );
}

export function EditorialHeart({ model, range, onRangeChange }: PageProps) {
  const days = rangeDays(range);
  const dates = model.dates.slice(-days);
  const hrv = model.hrv.slice(-days);
  const hrvBase = model.hrvBaseline.slice(-days);
  const rhr = model.rhr.slice(-days);
  const rhrBase = model.rhrBaseline.slice(-days);
  const vo2 = model.vo2.slice(-days);
  const hrvDelta = model.today.hrv - model.today.hrvBase;
  const rhrDelta = model.today.rhr - model.today.rhrBase;
  const recentVo2 = average(model.vo2.slice(-7));
  const priorVo2 = average(model.vo2.slice(-14, -7));
  const vo2Delta = recentVo2 - priorVo2;
  const qualifyingSessions = workoutsInRange(model, days).filter((workout) => /walk|run|hike/i.test(workout.type));
  const recoveryReadout =
    hrvDelta >= 0 && rhrDelta <= 0
      ? "Recovery looks supportive right now: HRV is running at or above baseline while resting heart rate is staying contained."
      : hrvDelta < 0 && rhrDelta > 0
        ? "Recovery looks a bit strained: HRV is below baseline while resting heart rate is elevated versus the last two weeks."
        : "The signal is mixed: one recovery marker improved while the other is still dragging, so it is better to read the trend than a single point.";
  const vo2Readout =
    qualifyingSessions.length < 2
      ? "Apple's cardio fitness estimate is built from qualifying outdoor walk, run, and hike effort. This window has sparse qualifying sessions, so today's dip can partly reflect thin input rather than a clean fitness verdict."
      : vo2Delta <= -0.2
        ? "The recent VO2 estimate is drifting down. That can reflect fewer hard aerobic efforts, fewer qualifying outdoor sessions, or real deconditioning, so treat it as a trend to watch rather than a one-day judgement."
        : vo2Delta >= 0.2
          ? "The recent VO2 estimate is nudging upward, which usually points to steadier qualifying aerobic work or better recovery supporting those sessions."
          : "The VO2 estimate is broadly stable. Small day-to-day moves are normal, especially when the number and intensity of qualifying outdoor sessions changes.";

  return (
    <>
      <PageHead eyebrow="Chapter IV · Heart" title="Strain & recovery" subtitle={`Autonomic state over ${days} days with 14-day baselines.`} accent="var(--heart)" range={range} onRangeChange={onRangeChange} />

      <div className="grid g-12" style={{ marginBottom: 16 }}>
        <div className="card col-4 pad-lg" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
          <Ring value={model.today.readiness} size={180} thickness={6} color="var(--recov)" sub="Recovery Index" />
          <div style={{ textAlign: "center", maxWidth: 240 }}>
            <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 18, color: "var(--ink-1)", lineHeight: 1.3 }}>
              HRV {model.today.hrv.toFixed(1)}ms <span style={{ color: "var(--ink-3)" }}>vs</span> {model.today.hrvBase.toFixed(1)}ms baseline
            </div>
            <div className="tiny" style={{ marginTop: 10 }}>
              Personal heuristic · not medical advice
            </div>
          </div>
        </div>

        <div className="card col-8 pad-lg">
          <div className="card-header">
            <h3>HRV vs baseline</h3>
            <span className="label">hover a day for detail</span>
          </div>
          <LineChart
            data={hrv}
            baseline={hrvBase}
            dates={dates}
            width={720}
            height={200}
            stroke="oklch(68% 0.14 22)"
            tooltipLabel="HRV"
            tooltipValueFormatter={(value) => `${value.toFixed(1)} ms`}
            baselineLabel="14D mean"
            baselineValueFormatter={(value) => `${value.toFixed(1)} ms`}
            annotations={model.annotations.map((annotation) => ({ ...annotation, dayIdx: annotation.dayIdx - (model.dates.length - days) })).filter((annotation) => annotation.dayIdx >= 0)}
          />
        </div>
      </div>

      <div className="grid g-12" style={{ marginBottom: 16 }}>
        <div className="card col-6 pad-lg">
          <div className="card-header">
            <h3>Resting heart rate</h3>
          </div>
          <LineChart
            data={rhr}
            baseline={rhrBase}
            dates={dates}
            width={520}
            height={180}
            stroke="oklch(60% 0.14 22)"
            tooltipLabel="RHR"
            tooltipValueFormatter={(value) => `${value.toFixed(0)} bpm`}
            baselineLabel="14D mean"
            baselineValueFormatter={(value) => `${value.toFixed(1)} bpm`}
          />
        </div>
        <div className="card col-6 pad-lg">
          <div className="card-header">
            <h3>VO₂ max estimate</h3>
          </div>
          <LineChart
            data={vo2}
            dates={dates}
            width={520}
            height={180}
            stroke="oklch(70% 0.12 240)"
            tooltipLabel="VO₂ max"
            tooltipValueFormatter={(value) => `${value.toFixed(1)} ml/kg`}
            showGrid
          />
        </div>
      </div>

      <div className="grid g-12">
        <div className="card col-6 pad-lg">
          <div className="label" style={{ color: "var(--heart)", marginBottom: 10 }}>
            Plain-language readout
          </div>
          <h2 style={{ ...sectionHeadlineStyle, fontSize: 32 }}>What the recovery trend suggests</h2>
          <div className="ed-body" style={{ fontSize: 14 }}>
            <p>{recoveryReadout}</p>
            <p>
              Today HRV is {model.today.hrv.toFixed(1)} ms versus a 14-day mean of {model.today.hrvBase.toFixed(1)} ms, while resting heart rate is {model.today.rhr.toFixed(0)} bpm versus {model.today.rhrBase.toFixed(1)} bpm.
            </p>
          </div>
        </div>
        <div className="card col-6 pad-lg">
          <div className="label" style={{ color: "var(--info)", marginBottom: 10 }}>
            Cardio fitness note
          </div>
          <h2 style={{ ...sectionHeadlineStyle, fontSize: 32 }}>Why VO₂ can drift</h2>
          <div className="ed-body" style={{ fontSize: 14 }}>
            <p>{vo2Readout}</p>
            <p>
              In this {days}-day window, the cardio fitness line moved {vo2Delta >= 0 ? "+" : ""}{vo2Delta.toFixed(1)} ml/kg versus the prior week average.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export function EditorialCorrelate({ model }: PageProps) {
  const pairEntries = clip(model.sleep, 1).map((value, index) => ({
    sleep: value,
    hrv: model.hrv[index + 1],
    date: model.dates[index + 1]
  })).slice(-60);
  const pairs = pairEntries.map((entry) => [entry.sleep, entry.hrv] as [number, number]);
  const cards = [
    { label: "Longer sleep → next-day HRV", value: model.correlations.sleepToHRV, detail: "Does more sleep usually line up with a calmer next morning?" },
    { label: "Longer sleep → next-day RHR", value: model.correlations.sleepToRHR, detail: "A negative value is usually what you want here because lower resting HR is better." },
    { label: "More deep sleep → next-day HRV", value: model.correlations.deepToHRV, detail: "This checks whether better sleep depth tends to show up in recovery." },
    { label: "More REM sleep → next-day readiness", value: model.correlations.remToReady, detail: "This asks whether dream-heavy nights tend to feed the readiness score." }
  ] as const;
  const strongest = [...cards].sort((left, right) => Math.abs(right.value) - Math.abs(left.value))[0];
  const sleepHrvRead = describeCorrelation(model.correlations.sleepToHRV);

  return (
    <>
      <div className="pagehead">
        <div>
          <div className="eyebrow" style={{ color: "var(--info)" }}>
            Chapter V · Correlate
          </div>
          <h1>
            What <em>moves</em> what?
          </h1>
          <p className="sub">Relationships between habits, sleep, and next-day autonomic state from your own data.</p>
        </div>
      </div>

      <div className="grid g-12" style={{ marginBottom: 16 }}>
        <div className="card col-7 pad-lg">
          <div className="label" style={{ color: "oklch(68% 0.14 22)", marginBottom: 10 }}>
            Feature
          </div>
          <h2 style={{ fontFamily: "var(--serif)", fontWeight: 400, fontSize: 42, lineHeight: 1.05, margin: "0 0 14px", letterSpacing: "-0.015em" }}>
            {model.alcoholImpact.samples > 0 ? (
              <>
                Nights with drinks knock <em>{Math.abs(model.alcoholImpact.drop).toFixed(1)}ms</em> {model.alcoholImpact.drop >= 0 ? "off" : "onto"} HRV the next morning.
              </>
            ) : (
              <>
                Add annotations and turn this into a <em>real context explorer.</em>
              </>
            )}
          </h2>
          <div className="ed-body ed-dropcap" style={{ fontSize: 15, marginBottom: 18 }}>
            <p>
              {model.alcoholImpact.samples > 0
                ? `Across ${model.alcoholImpact.samples} alcohol annotations in the last 90 days, the following-morning HRV averaged ${model.alcoholImpact.afterAlcohol.toFixed(1)}ms against a rolling baseline of ${model.alcoholImpact.baseline.toFixed(1)}ms.`
                : "Once you annotate drinks, travel, illness, or stress, this page turns into a real context explorer instead of a static chart wall."}
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            {cards.map((card) => (
              <div key={card.label} className="card" style={{ padding: 14, background: "var(--bg-2)" }}>
                <div className="label" style={{ marginBottom: 6 }}>{card.label}</div>
                <div style={{ fontFamily: "var(--serif)", fontSize: 28, color: card.value >= 0 ? "var(--recov)" : "var(--heart)" }}>{card.value >= 0 ? "+" : ""}{card.value.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card col-5 pad-lg">
          <div className="card-header">
            <h3>Before / after alcohol</h3>
            <span className="label">HRV baseline vs next day</span>
          </div>
          <CompareBars
            items={[{ label: "BASE", a: model.alcoholImpact.baseline, b: model.alcoholImpact.baseline }, { label: "D+1", a: model.alcoholImpact.baseline, b: model.alcoholImpact.afterAlcohol }]}
            width={360}
            height={200}
            color="oklch(68% 0.14 22)"
            aLabel="Rolling baseline"
            bLabel="Morning after"
            valueFormatter={(value) => `${value.toFixed(1)} ms`}
          />
          <div style={{ borderTop: "1px dotted var(--line)", marginTop: 16, paddingTop: 12, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
            Grey bars anchor the rolling baseline. Coral bars show the observed value on the following morning.
          </div>
        </div>
      </div>

      <div className="grid g-12" style={{ marginBottom: 16 }}>
        <div className="card col-7 pad-lg">
          <div className="card-header">
            <h3>Sleep duration → next-day HRV</h3>
            <span className="label">{sleepHrvRead.strength} {sleepHrvRead.direction} signal</span>
          </div>
          <Scatter
            pairs={pairs}
            width={620}
            height={280}
            color="var(--sleep)"
            xLabel="Sleep"
            yLabel="Next-day HRV"
            xFormatter={(value) => `${value.toFixed(1)} h`}
            yFormatter={(value) => `${value.toFixed(1)} ms`}
            pointLabels={pairEntries.map((entry) => formatModelDate(entry.date, "full"))}
          />
          <div style={{ borderTop: "1px dotted var(--line)", marginTop: 14, paddingTop: 12, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
            If the cloud tilts upward from left to right, longer sleep is usually pairing with better next-day HRV in your data. Hover any dot for the exact night and following morning.
          </div>
        </div>
        <div className="card col-5 pad-lg">
          <div className="card-header">
            <h3>Plain-English readout</h3>
            <span className="label">what seems to matter most</span>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {cards.map((card) => {
              const read = describeCorrelation(card.value);
              return (
                <div key={card.label} className="card" style={{ padding: 14, background: "var(--bg-2)" }}>
                  <div className="label" style={{ marginBottom: 6 }}>{card.label}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", marginBottom: 8 }}>
                    <div style={{ fontFamily: "var(--serif)", fontSize: 26, color: card.value >= 0 ? "var(--recov)" : "var(--heart)" }}>
                      {card.value >= 0 ? "+" : ""}{card.value.toFixed(2)}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{read.strength} {read.direction}</div>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
                    {card.detail}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ borderTop: "1px dotted var(--line)", marginTop: 14, paddingTop: 12, fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 }}>
            Strongest current relationship: {strongest.label.toLowerCase()} ({strongest.value >= 0 ? "+" : ""}{strongest.value.toFixed(2)}). Rough guide: under 0.15 = little signal, 0.15-0.35 = weak, 0.35-0.55 = moderate, above 0.55 = strong.
          </div>
        </div>
      </div>

      <div className="grid g-12">
        <div className="card col-6 pad-lg">
          <div className="card-header">
            <h3>Recent life context</h3>
            <span className="label">{model.annotations.length} total annotations</span>
          </div>
          {model.annotations.length > 0 ? (
            <div className="annotation-editor-list">
              {model.annotations.slice(-8).reverse().map((annotation) => (
                <div key={annotation.id} className="annotation-row">
                  <div>
                    <div style={annotationDateStyle}>{annotation.date} · {annotation.kind}</div>
                    <div style={{ marginTop: 4, color: "var(--ink-1)" }}>{annotation.label}</div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-2)" }}>{annotation.dot}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="tiny">No annotations yet. Add them in Settings to connect events to recovery changes.</div>
          )}
        </div>
        <div className="card col-6 pad-lg">
          <div className="card-header">
            <h3>How to read this page</h3>
          </div>
          <div className="ed-body" style={{ fontSize: 14 }}>
            <p>Use the scatter plot to inspect individual days. Use the matrix to understand which metrics tend to move together over the last 90 days.</p>
            <p>Annotations are the missing context layer: travel, illness, stress, or alcohol often explain outliers better than the raw chart alone.</p>
          </div>
        </div>
      </div>
    </>
  );
}

export function EditorialWeekly({ model }: PageProps) {
  const thisWeekSleep = model.sleep.slice(-7);
  const lastWeekSleep = model.sleep.slice(-14, -7);
  const thisWeekHrv = model.hrv.slice(-7);
  const lastWeekHrv = model.hrv.slice(-14, -7);
  const thisWeekRhr = model.rhr.slice(-7);
  const lastWeekRhr = model.rhr.slice(-14, -7);
  const thisWeekWorkouts = model.workouts.filter((workout) => workout.date >= formatModelDate(model.dates.at(-7) ?? new Date(), "ymd"));
  const lastWeekWorkouts = model.workouts.filter((workout) => workout.date >= formatModelDate(model.dates.at(-14) ?? new Date(), "ymd") && workout.date < formatModelDate(model.dates.at(-7) ?? new Date(), "ymd"));
  const weekDates = model.dates.slice(-14);
  const sleepCompare = buildWeekCompareItems(model.sleep.slice(-14), model.sleep.slice(-7), model.dates.slice(-7));
  const readinessCompare = buildWeekCompareItems(model.readiness.slice(-14), model.readiness.slice(-7), model.dates.slice(-7));

  const rows = [
    { label: "Sleep average", current: average(thisWeekSleep), prior: average(lastWeekSleep), unit: "h" },
    { label: "HRV average", current: average(thisWeekHrv), prior: average(lastWeekHrv), unit: "ms" },
    { label: "RHR average", current: average(thisWeekRhr), prior: average(lastWeekRhr), unit: "bpm", betterWhenLower: true },
    { label: "Running km", current: sum(thisWeekWorkouts.map((workout) => workout.distance_km ?? 0)), prior: sum(lastWeekWorkouts.map((workout) => workout.distance_km ?? 0)), unit: "km" },
    { label: "Sessions", current: thisWeekWorkouts.length, prior: lastWeekWorkouts.length, unit: "" }
  ];

  return (
    <>
      <div style={mastheadStyle}>
        <div className="ed-byline">
          <span>Weekly Review</span>
        </div>
        <div className="ed-byline" style={{ fontFamily: "var(--serif)", fontSize: 16, letterSpacing: "0.02em", textTransform: "none", color: "var(--ink-1)" }}>
          Sunday Review
        </div>
        <div className="ed-byline">
          <span>This week vs prior</span>
        </div>
      </div>

      <div style={heroSplitStyle}>
        <div>
          <div className="label" style={{ marginBottom: 12 }}>
            The Week in Summary
          </div>
          <h1 className="ed-headline" style={{ fontSize: 72 }}>
            Consistent work, shorter nights, <em>steady recovery.</em>
          </h1>
          <div className="ed-deck">
            Total {sum(thisWeekWorkouts.map((workout) => workout.distance_km ?? 0)).toFixed(1)} km across {thisWeekWorkouts.length} sessions, averaging {average(thisWeekSleep).toFixed(1)}h sleep with readiness at {average(model.readiness.slice(-7)).toFixed(0)}.
          </div>
        </div>
        <div style={{ paddingLeft: 40, borderLeft: "1px solid var(--line-strong)" }}>
          <div className="label" style={{ marginBottom: 14 }}>
            The Ledger
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 12, paddingBottom: 6, marginBottom: 4 }}>
            <div />
            <div className="mono" style={{ color: "var(--ink-3)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "right" }}>
              Prior week
            </div>
            <div className="mono" style={{ color: "var(--ink-3)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "right" }}>
              This week
            </div>
            <div className="mono" style={{ color: "var(--ink-3)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "right" }}>
              Change
            </div>
          </div>
          {rows.map((row, index) => {
            const delta = row.current - row.prior;
            const betterWhenLower = row.betterWhenLower === true;
            const good = betterWhenLower ? delta <= 0 : delta >= 0;
            return (
              <div key={row.label} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 12, padding: "10px 0", borderTop: index === 0 ? "1px solid var(--line-strong)" : "1px dotted var(--line)", alignItems: "baseline" }}>
                <div style={{ fontFamily: "var(--serif)", fontSize: 16, color: "var(--ink-1)", fontStyle: "italic" }}>{row.label}</div>
                <div className="mono" style={{ color: "var(--ink-3)", fontSize: 11, minWidth: 50, textAlign: "right" }}>
                  {formatLedgerValue(row.prior, row.unit)}
                </div>
                <div style={{ fontFamily: "var(--serif)", fontSize: 22, color: "var(--ink-0)", minWidth: 70, textAlign: "right" }}>{formatLedgerValue(row.current, row.unit)}</div>
                <div className="mono" style={{ fontSize: 10, color: good ? "oklch(75% 0.14 150)" : "oklch(70% 0.16 22)", minWidth: 60, textAlign: "right" }}>
                  {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}
                  {row.unit ? ` ${row.unit}` : ""}
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 }}>
            Higher is better for sleep and HRV. Lower is better for resting heart rate.
          </div>
        </div>
      </div>

      <div className="grid g-12" style={{ marginBottom: 16 }}>
        <div className="card col-6 pad-lg">
          <div className="card-header">
            <h3>Sleep this week vs prior</h3>
            <span className="label">Hover bars for exact values</span>
          </div>
          <CompareBars items={sleepCompare} width={520} height={200} color="var(--sleep)" aLabel="Prior week" bLabel="This week" valueFormatter={(value) => `${value.toFixed(1)} h`} />
        </div>
        <div className="card col-6 pad-lg">
          <div className="card-header">
            <h3>Readiness this week vs prior</h3>
            <span className="label">Hover bars for exact values</span>
          </div>
          <CompareBars items={readinessCompare} width={520} height={200} color="var(--recov)" aLabel="Prior week" bLabel="This week" valueFormatter={(value) => `${value.toFixed(0)}`} />
        </div>
      </div>

      <div className="grid g-12" style={{ marginBottom: 16 }}>
        <div className="card col-6 pad-lg">
          <div className="card-header">
            <h3>Recovery trend · last 14 days</h3>
            <span className="label">HRV vs baseline</span>
          </div>
          <LineChart
            data={model.hrv.slice(-14)}
            baseline={model.hrvBaseline.slice(-14)}
            dates={weekDates}
            width={520}
            height={190}
            stroke="var(--heart)"
            tooltipLabel="HRV"
            tooltipValueFormatter={(value) => `${value.toFixed(1)} ms`}
            baselineLabel="14D mean"
            baselineValueFormatter={(value) => `${value.toFixed(1)} ms`}
          />
        </div>
        <div className="card col-6 pad-lg">
          <div className="card-header">
            <h3>Sleep trend · last 14 days</h3>
            <span className="label">nightly duration</span>
          </div>
          <LineChart
            data={model.sleep.slice(-14)}
            baseline={model.sleepBaseline.slice(-14)}
            dates={weekDates}
            width={520}
            height={190}
            stroke="var(--sleep)"
            tooltipLabel="Sleep"
            tooltipValueFormatter={(value) => `${value.toFixed(1)} h`}
            baselineLabel="14D mean"
            baselineValueFormatter={(value) => `${value.toFixed(1)} h`}
          />
        </div>
      </div>

      <div className="grid g-12">
        <div className="card col-7 pad-lg">
          <div className="card-header">
            <h3>Sessions that shaped the week</h3>
            <span className="label">{thisWeekWorkouts.length} workouts</span>
          </div>
          {thisWeekWorkouts.length > 0 ? (
            <div className="annotation-editor-list">
              {thisWeekWorkouts.map((workout) => (
                <div key={workout.id} className="annotation-row">
                  <div>
                    <div style={annotationDateStyle}>{formatModelDate(workout.dateValue, "full")} · {workout.type}</div>
                    <div style={{ marginTop: 4, color: "var(--ink-1)" }}>
                      {(workout.distance_km ?? 0).toFixed(1)} km · {formatPace(workout.pace)}/km · {workout.avgHR?.toFixed(0) ?? "—"} bpm
                    </div>
                  </div>
                  <ZoneBar zones={workout.zones} height={6} />
                </div>
              ))}
            </div>
          ) : (
            <div className="tiny">No workouts recorded in the current week window.</div>
          )}
        </div>
        <div className="card col-5 pad-lg">
          <div className="card-header">
            <h3>Context from annotations</h3>
            <span className="label">last 14 days</span>
          </div>
          {model.annotations.slice(-6).reverse().map((annotation) => (
            <div key={annotation.id} className="annot">
              <span className="d">{annotation.date}</span>
              <span style={{ color: "var(--ink-2)" }}>{annotation.dot}</span>
              <span style={{ color: "var(--ink-1)" }}>{annotation.label}</span>
            </div>
          ))}
          {model.annotations.length === 0 ? <div className="tiny">No annotations yet.</div> : null}
        </div>
      </div>
    </>
  );
}

export function EditorialSettings({ model, saving, onImported, onCreateAnnotation, onUpdateAnnotation, onDeleteAnnotation }: SettingsProps) {
  const [draft, setDraft] = useState({ date: formatModelDate(model.dates.at(-1) ?? new Date(), "ymd"), kind: "stress", label: "" });
  const [editingId, setEditingId] = useState<number | null>(null);

  const submit = async () => {
    if (!draft.label.trim()) {
      return;
    }

    if (editingId) {
      await onUpdateAnnotation(editingId, draft);
      setEditingId(null);
    } else {
      await onCreateAnnotation(draft);
    }
    setDraft((current) => ({ ...current, label: "" }));
  };

  return (
    <>
      <div className="pagehead">
        <div>
          <div className="eyebrow">Settings</div>
          <h1>
            Annotations & <em>preferences</em>
          </h1>
          <p className="sub">Upload fresh Apple Health exports and log the events you want reflected in the correlation explorer.</p>
        </div>
      </div>

      <div className="card pad-lg" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3>Apple Health import</h3>
          <span className="label">export.zip ingest</span>
        </div>
        <AppleImportPanel onImported={onImported} />
      </div>

      <div className="grid g-12">
        <div className="card col-5 pad-lg">
          <h3 style={{ marginBottom: 8 }}>Add annotation</h3>
          <p className="hint">Events added here feed the correlation explorer immediately after save.</p>
          <div className="form-grid" style={{ marginTop: 18 }}>
            <label className="field">
              <span>Date</span>
              <input type="date" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} />
            </label>
            <label className="field">
              <span>Kind</span>
              <select value={draft.kind} onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value }))}>
                {annotationOptions().map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="field field-wide">
              <span>Label</span>
              <input type="text" value={draft.label} onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))} placeholder="e.g. two drinks with dinner" />
            </label>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button type="button" className="btn primary" onClick={() => void submit()} disabled={saving}>
              {editingId ? "Update" : "Add"}
            </button>
            {editingId ? (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setEditingId(null);
                  setDraft({ date: formatModelDate(model.dates.at(-1) ?? new Date(), "ymd"), kind: "stress", label: "" });
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>

        <div className="card col-7 pad-lg">
          <div className="card-header">
            <h3>Existing annotations</h3>
            <span className="label">{model.annotations.length} total</span>
          </div>
          <div className="annotation-editor-list">
            {model.annotations.length > 0 ? (
              model.annotations.map((annotation) => (
                <div key={annotation.id} className="annotation-row">
                  <div>
                    <div style={annotationDateStyle}>
                      {annotation.date} · {annotation.kind}
                    </div>
                    <div style={{ marginTop: 4, color: "var(--ink-1)" }}>{annotation.label}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        setEditingId(annotation.id);
                        setDraft({ date: annotation.date, kind: annotation.kind, label: annotation.label });
                      }}
                    >
                      Edit
                    </button>
                    <button type="button" className="btn" onClick={() => void onDeleteAnnotation(annotation.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="tiny">No annotations yet. Add one here to feed the correlation explorer and dashboard markers.</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export function InstrumentDashboard({ model, range }: PageProps) {
  const today = model.today;
  const hrvZ = (today.hrv - today.hrvBase) / 6;
  const rhrZ = (today.rhrBase - today.rhr) / 4;
  const sleepZ = (today.sleep - (model.sleepBaseline.at(-1) ?? today.sleep)) / 1.2;
  const annotationPreview = model.annotations.slice(0, 6);

  return (
    <>
      <div style={statusBarStyle}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", color: "var(--ink-1)" }}>
          <span className="dot" style={{ background: "var(--recov)" }} />
          <span style={{ letterSpacing: "0.08em" }}>SYS · NOMINAL</span>
        </div>
        <div style={{ color: "var(--ink-3)", letterSpacing: "0.08em" }}>RANGE {range} · {model.dates.length} DAILY POINTS · {model.syncLabel.toUpperCase()}</div>
        <div style={{ color: "var(--ink-2)", letterSpacing: "0.08em" }}>READY · {today.readiness}</div>
        <div style={{ color: "var(--ink-2)", letterSpacing: "0.08em" }}>HRV · {today.hrv.toFixed(1)}</div>
      </div>

      <div className="in-panel in-grid-bg" style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "220px minmax(420px, 1.3fr) minmax(280px, 0.9fr)", gap: 28, alignItems: "center" }}>
          <Ring value={today.readiness} size={180} thickness={5} color="var(--recov)" sub="Readiness" />
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 18, marginBottom: 14 }}>
              <InGauge label="HRV" value={today.hrv.toFixed(1)} unit="ms" z={hrvZ} base={today.hrvBase.toFixed(1)} color="var(--heart)" />
              <InGauge label="RHR" value={today.rhr.toFixed(0)} unit="bpm" z={rhrZ} base={today.rhrBase.toFixed(1)} color="var(--heart-2)" />
              <InGauge label="SLEEP" value={today.sleep.toFixed(1)} unit="h" z={sleepZ} base={(model.sleepBaseline.at(-1) ?? today.sleep).toFixed(1)} color="var(--sleep)" />
              <InGauge label="VO₂" value={today.vo2.toFixed(1)} unit="ml/kg" z={0.3} base={(average(model.vo2.slice(-14)) ?? today.vo2).toFixed(1)} color="var(--info)" />
            </div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-2)", paddingTop: 14, borderTop: "1px solid var(--line)", letterSpacing: "0.03em" }}>
              <span style={{ color: "var(--ink-3)" }}>vs yesterday</span> {today.readiness - today.readinessYest >= 0 ? "+" : ""}
              {today.readiness - today.readinessYest}
            </div>
          </div>
          <div style={{ borderLeft: "1px solid var(--line)", paddingLeft: 24, minWidth: 220 }}>
            <div className="label" style={{ marginBottom: 8 }}>
              Composite formula
            </div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)", lineHeight: 1.7, letterSpacing: "0.02em" }}>
              <div>
                ready = 70
                <br />+ hrv_z · 7
                <br />+ rhr_z · 5
                <br />+ sleep_z · 6
              </div>
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: "var(--ink-2)", lineHeight: 1.6 }}>
              `Z` means how far today sits above or below your 14-day average. Annotations do not change this formula directly; they act as context markers and power the before/after comparisons on the correlate page.
            </div>
          </div>
        </div>
      </div>

      <div className="grid g-6" style={{ marginBottom: 16 }}>
        {[
          ["HRV", model.hrv, "ms", today.hrv.toFixed(1), "var(--heart)"],
          ["RHR", model.rhr, "bpm", today.rhr.toFixed(0), "var(--heart-2)"],
          ["Sleep", model.sleep, "h", today.sleep.toFixed(1), "var(--sleep)"],
          ["VO₂", model.vo2, "", today.vo2.toFixed(1), "var(--info)"],
          ["Steps", model.steps, "", `${(today.steps / 1000).toFixed(1)}k`, "var(--train)"],
          ["Ready", model.readiness, "", `${today.readiness}`, "var(--recov)"]
        ].map(([label, series, unit, value, color]) => (
          <div key={String(label)} className="in-panel" style={{ padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span className="label" style={{ color: String(color), fontSize: 9 }}>
                {label}
              </span>
              <span className="mono" style={{ fontSize: 9, color: "var(--ink-3)" }}>
                {unit}
              </span>
            </div>
            <div className="in-big" style={{ fontSize: 22, marginBottom: 6 }}>
              {value}
            </div>
            <Sparkline data={series.slice(-30) as number[]} stroke={String(color)} height={28} fill showDot />
          </div>
        ))}
      </div>

      <div className="grid g-12" style={{ marginBottom: 16 }}>
        <div className="in-panel col-8" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
            <span className="label">Readiness composite · 30d</span>
          </div>
          <LineChart data={model.readiness.slice(-30)} dates={model.dates.slice(-30)} width={720} height={220} stroke="oklch(72% 0.12 150)" area annotations={model.annotations.map((annotation) => ({ ...annotation, dayIdx: annotation.dayIdx - (model.dates.length - 30) })).filter((annotation) => annotation.dayIdx >= 0)} />
        </div>
        <div className="in-panel col-4" style={{ padding: 18 }}>
          <div className="label" style={{ marginBottom: 10 }}>
            Annotated events
          </div>
          {annotationPreview.length > 0 ? (
            annotationPreview.map((annotation) => (
              <div key={annotation.id} className="annot">
                <span className="d">{formatModelDate(model.dates[annotation.dayIdx])}</span>
                <span style={{ color: "var(--ink-2)", marginRight: 6 }}>{annotation.dot}</span>
                <span style={{ color: "var(--ink-1)", fontSize: 12 }}>{annotation.label}</span>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.7, maxWidth: 280 }}>
              No annotations yet. Use Settings to log travel, alcohol, stress, or illness so the readiness chart gains real event markers.
            </div>
          )}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px dotted var(--line)", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.6 }}>
            Logged events do not rewrite readiness themselves. They mark the date on charts and let the correlate view compare mornings after those events against your rolling baseline.
          </div>
        </div>
      </div>
    </>
  );
}

export function InstrumentSleep(props: PageProps) {
  const { model, range, onRangeChange } = props;
  const days = rangeDays(range);
  const stages = model.sleepStages.slice(-days);
  const dates = model.dates.slice(-days);
  const offset = model.dates.length - days;
  const [selectedSleepIndex, setSelectedSleepIndex] = useState<number | null>(null);
  const normalizedBedtimes = stages.map((stage) => normalizeSleepWindowHour(stage.bedtime));
  const bedtimeDrift = Math.sqrt(average(normalizedBedtimes.map((bedtime) => (bedtime - average(normalizedBedtimes)) ** 2)));
  const avgSleep = average(stages.map((stage) => stage.total));
  const avgDeep = average(stages.map((stage) => stage.deep));
  const avgRem = average(stages.map((stage) => stage.rem));
  const deepShare = percentNumber(avgDeep, avgSleep);
  const remShare = percentNumber(avgRem, avgSleep);

  return (
    <>
      <InstrumentPageHead code="SLEEP" title="Night structure and consistency" detail={`Window ${days}d · click any night for full detail`} range={range} onRangeChange={onRangeChange} accent="var(--sleep)" />

      <div style={instrumentMetricGridStyle}>
        <InstrumentMetricPanel label="Avg sleep" value={avgSleep.toFixed(1)} unit="h" detail={`14D mean ${model.sleepBaseline.at(-1)?.toFixed(1) ?? "—"}h`} color="var(--sleep)" />
        <InstrumentMetricPanel label="Deep share" value={deepShare.toFixed(1)} unit="%" detail={`${(avgDeep * 60).toFixed(0)} min`} color="var(--sleep)" />
        <InstrumentMetricPanel label="REM share" value={remShare.toFixed(1)} unit="%" detail={`${(avgRem * 60).toFixed(0)} min`} color="var(--sleep)" />
        <InstrumentMetricPanel label="Bed drift" value={bedtimeDrift.toFixed(1)} unit="h sd" detail="sleep onset variability" color="var(--sleep)" />
      </div>

      <div className="grid g-12" style={{ marginBottom: 16 }}>
        <div className="in-panel col-8" style={{ padding: 18 }}>
          <div className="card-header">
            <h3>Stage composition</h3>
            <span className="label">click a night for full detail</span>
          </div>
          <SleepStages stages={stages} dates={dates} width={720} height={320} selectedIndex={selectedSleepIndex} onSelect={setSelectedSleepIndex} />
        </div>
        <div className="in-panel col-4" style={{ padding: 18 }}>
          <div className="card-header">
            <h3>Sleep window</h3>
            <span className="label">last 14 nights</span>
          </div>
          <SleepWindowChart
            stages={stages.slice(-14)}
            dates={dates.slice(-14)}
            width={420}
            onSelect={(index) => setSelectedSleepIndex(Math.max(0, stages.length - 14 + index))}
            selectedIndex={selectedSleepIndex !== null && selectedSleepIndex >= Math.max(0, stages.length - 14) ? selectedSleepIndex - Math.max(0, stages.length - 14) : null}
          />
        </div>
      </div>

      <div className="grid g-12">
        <div className="in-panel col-5" style={{ padding: 18 }}>
          <div className="card-header">
            <h3>Stage shares</h3>
            <span className="label">average composition</span>
          </div>
          {[
            ["Deep", avgDeep, avgSleep, "oklch(45% 0.12 265)"],
            ["Core", average(stages.map((stage) => stage.core)), avgSleep, "oklch(62% 0.12 265)"],
            ["REM", avgRem, avgSleep, "oklch(70% 0.13 310)"],
            ["Awake", average(stages.map((stage) => stage.awake)), avgSleep, "oklch(68% 0.12 55)"]
          ].map(([label, value, total, color]) => (
            <div key={String(label)} style={{ display: "grid", gridTemplateColumns: "72px 1fr auto", gap: 10, alignItems: "center", padding: "8px 0", borderTop: "1px dotted var(--line)" }}>
              <span className="label" style={{ color: "var(--ink-2)" }}>{label}</span>
              <div style={{ height: 6, background: "var(--bg-3)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${((Number(value) / Math.max(0.1, Number(total))) * 100).toFixed(0)}%`, height: "100%", background: String(color) }} />
              </div>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-1)" }}>{((Number(value) / Math.max(0.1, Number(total))) * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
        <div className="in-panel col-7" style={{ padding: 18 }}>
          <div className="card-header">
            <h3>Nightly log</h3>
            <span className="label">latest 10 nights</span>
          </div>
          <div className="sleep-log-list sleep-log-list--instrument">
          {stages.slice(-10).map((stage, index) => {
            const baseIndex = Math.max(0, dates.length - 10);
            const date = dates[baseIndex + index];
            return (
              <button key={`${stage.total}-${index}`} type="button" onClick={() => setSelectedSleepIndex(baseIndex + index)} className="sleep-log-row sleep-log-row--instrument">
                <span className="sleep-log-date">{formatModelDate(date, "full")}</span>
                <span className="sleep-log-total">{stage.total.toFixed(1)}<span style={{ fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--mono)" }}>h</span></span>
                <div className="sleep-log-stages">
                  <SegPct value={percentNumber(stage.deep, stage.total)} color="oklch(45% 0.12 265)" />
                  <SegPct value={percentNumber(stage.rem, stage.total)} color="oklch(70% 0.13 310)" />
                  <SegPct value={percentNumber(stage.core, stage.total)} color="oklch(62% 0.12 265)" />
                </div>
                <span className="sleep-log-time" data-label="Bed">{formatClock(stage.bedtime)}</span>
                <span className="sleep-log-time" data-label="Wake">{formatClock(stage.waketime)}</span>
              </button>
            );
          })}
          </div>
      </div>
      </div>

      <div className="in-panel" style={{ padding: 18, marginTop: 16 }}>
        <div className="card-header">
          <h3>Interpretation</h3>
          <span className="label">what low deep sleep usually points to</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <div style={{ fontSize: 13, color: "var(--ink-1)", lineHeight: 1.6 }}>
            Deep sleep is the slow-wave stage associated with physical restoration. At {deepShare.toFixed(1)}% across the selected window, you are {deepShare < 15 ? "running below" : deepShare > 20 ? "running above" : "sitting inside"} the 15-20% reference band used on this page.
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-1)", lineHeight: 1.6 }}>
            The usual practical drags are alcohol near bedtime, inconsistent timing, and short sleep opportunity. Deep sleep also tends to be front-loaded, so cutting the night short often hits it first.
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-1)", lineHeight: 1.6 }}>
            Best first levers: steadier bedtime, less alcohol close to bed, and a cooler, darker, quieter room. If sleep still feels unrefreshing, log annotations so you can match rough nights to context.
          </div>
        </div>
      </div>
      <SleepDetailModal model={model} localIndex={selectedSleepIndex} offset={offset} dates={dates} stages={stages} onClose={() => setSelectedSleepIndex(null)} />
    </>
  );
}

export function InstrumentWorkouts(props: PageProps) {
  const { model, range, onRangeChange } = props;
  const days = rangeDays(range);
  const [selected, setSelected] = useState<WorkoutView | null>(model.workouts[0] ?? null);
  const [selectedTrainingDateKey, setSelectedTrainingDateKey] = useState<string | null>(null);
  const recent = workoutsInRange(model, days);
  const current = recent.find((workout) => workout.id === selected?.id) ?? recent[0] ?? null;
  const loadDates = model.dates.slice(-days);
  const heatDates = model.dates.slice(-56);
  const grouped = groupWorkoutsByDay(model.workouts);
  const dailyMinutes = loadDates.map((date) => grouped.get(formatModelDate(date, "ymd"))?.reduce((sum, workout) => sum + (workout.duration_min ?? 0), 0) ?? 0);
  const heatValues = heatDates.map((date) => grouped.get(formatModelDate(date, "ymd"))?.reduce((sum, workout) => sum + (workout.duration_min ?? 0), 0) ?? 0);
  const totalDistance = recent.reduce((sum, workout) => sum + (workout.distance_km ?? 0), 0);
  const totalMinutes = recent.reduce((sum, workout) => sum + (workout.duration_min ?? 0), 0);
  const zone2Minutes = recent.reduce((sum, workout) => sum + (workout.zones[1] ?? 0), 0);
  const selectedTrainingDate = selectedTrainingDateKey ? model.dates.find((date) => formatModelDate(date, "ymd") === selectedTrainingDateKey) ?? null : null;
  const selectedDayWorkouts = selectedTrainingDateKey ? grouped.get(selectedTrainingDateKey) ?? [] : [];
  const selectedLoadIndex = selectedTrainingDateKey ? loadDates.findIndex((date) => formatModelDate(date, "ymd") === selectedTrainingDateKey) : -1;
  const selectedHeatIndex = selectedTrainingDateKey ? heatDates.findIndex((date) => formatModelDate(date, "ymd") === selectedTrainingDateKey) : -1;

  if (recent.length === 0) {
    return (
      <>
        <InstrumentPageHead code="TRAIN" title="Load, splits, and recent sessions" detail={`Window ${days}d · compact calendar + hover details`} range={range} onRangeChange={onRangeChange} accent="var(--train)" />

        <div style={instrumentMetricGridStyle}>
          <InstrumentMetricPanel label="Sessions" value="0" unit="" detail={`${days}d window`} color="var(--train)" />
          <InstrumentMetricPanel label="Distance" value="0.0" unit="km" detail="avg 0.0 km" color="var(--train)" />
          <InstrumentMetricPanel label="Zone 2" value="0" unit="%" detail="share of minutes" color="var(--train)" />
          <InstrumentMetricPanel label="Load" value="0" unit="min" detail="training time" color="var(--train)" />
        </div>

        <div className="grid g-12">
          <div className="in-panel col-7" style={{ padding: 18 }}>
            <div className="card-header">
              <h3>Workout ingest status</h3>
              <span className="label">{model.workouts.length > 0 ? "range empty" : "no sessions"}</span>
            </div>
            <div className="tiny" style={{ marginBottom: 10 }}>
              {model.workouts.length > 0 ? `No workouts in the selected ${days}d window.` : "No workouts in the current dataset."}
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.6, maxWidth: 620 }}>
              {model.workouts.length > 0
                ? "Switch to a wider range to inspect older sessions, or wait for fresh workouts to arrive from the next Apple Health import."
                : "Import a fresh Apple Health `export.zip` in `Settings` to populate daily load, zone distribution, splits, and recent session drilldowns."}
            </div>
          </div>
          <div className="in-panel col-5" style={{ padding: 18 }}>
            <div className="card-header">
              <h3>Panel map</h3>
              <span className="label">what appears next</span>
            </div>
            <div className="annot">
              <span className="d">LOAD</span>
              <span style={{ color: "var(--ink-1)" }}>Daily minutes and density across the current window.</span>
            </div>
            <div className="annot">
              <span className="d">FOCUS</span>
              <span style={{ color: "var(--ink-1)" }}>Selected workout pace, heart rate, splits, and zone mix.</span>
            </div>
            <div className="annot">
              <span className="d">CAL</span>
              <span style={{ color: "var(--ink-1)" }}>Eight-week calendar for training frequency and load rhythm.</span>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <InstrumentPageHead code="TRAIN" title="Load, splits, and recent sessions" detail={`Window ${days}d · click chart points and loaded days for detail`} range={range} onRangeChange={onRangeChange} accent="var(--train)" />

      <div style={instrumentMetricGridStyle}>
        <InstrumentMetricPanel label="Sessions" value={String(recent.length)} unit="" detail={`${days}d window`} color="var(--train)" />
        <InstrumentMetricPanel label="Distance" value={totalDistance.toFixed(1)} unit="km" detail={`avg ${(totalDistance / Math.max(1, recent.length)).toFixed(1)} km`} color="var(--train)" />
        <InstrumentMetricPanel label="Zone 2" value={(totalMinutes > 0 ? (zone2Minutes / totalMinutes) * 100 : 0).toFixed(0)} unit="%" detail="share of minutes" color="var(--train)" />
        <InstrumentMetricPanel label="Load" value={totalMinutes.toFixed(0)} unit="min" detail="training time" color="var(--train)" />
      </div>

      <div className="grid g-12" style={{ marginBottom: 16 }}>
        <div className="in-panel col-7" style={{ padding: 18 }}>
          <div className="card-header">
            <h3>Daily load</h3>
            <span className="label">click any non-zero day to inspect</span>
          </div>
          <LineChart
            data={dailyMinutes}
            dates={loadDates}
            width={620}
            height={210}
            stroke="var(--train)"
            area
            tooltipLabel="Training"
            tooltipValueFormatter={(value) => `${value.toFixed(0)} min`}
            onSelect={(index) => {
              if ((dailyMinutes[index] ?? 0) <= 0) {
                return;
              }
              const date = loadDates[index];
              const key = formatModelDate(date, "ymd");
              const workouts = grouped.get(key) ?? [];
              setSelectedTrainingDateKey(key);
              if (workouts[0]) {
                setSelected(workouts[0]);
              }
            }}
            selectedIndex={selectedLoadIndex >= 0 ? selectedLoadIndex : null}
          />
        </div>
        <div className="in-panel col-5" style={{ padding: 18 }}>
          <div className="card-header">
            <h3>Session focus</h3>
            <span className="label">{current ? formatModelDate(current.dateValue, "full") : "no sessions"}</span>
          </div>
          {current ? (
            <>
              <div className="session-focus-metrics">
                <MiniStat label="Distance" value={current.distance_km?.toFixed(1) ?? "—"} unit="km" />
                <MiniStat label="Pace" value={formatPace(current.pace)} unit="/km" />
                <MiniStat label="Avg HR" value={current.avgHR?.toFixed(0) ?? "—"} unit="bpm" />
              </div>
              <div className="label" style={{ marginBottom: 8 }}>Zone distribution</div>
              <ZoneBar zones={current.zones} height={14} />
              <div style={sectionBlockStyle}>
                <div className="label" style={{ marginBottom: 8 }}>Splits</div>
                <PaceSplits splits={current.splits.slice(0, 6)} color="var(--train)" />
              </div>
            </>
          ) : (
            <div className="tiny">No workouts in the current data window.</div>
          )}
        </div>
      </div>

      <div className="grid g-12">
        <div className="in-panel col-4" style={{ padding: 18 }}>
          <div className="card-header">
            <h3>8 week calendar</h3>
            <span className="label">click a loaded day for session detail</span>
          </div>
          <HeatCalendar
            values={heatValues}
            dates={heatDates}
            width={360}
            color="var(--train)"
            valueFormatter={(value) => `${value.toFixed(0)} min`}
            selectedIndex={selectedHeatIndex >= 0 ? selectedHeatIndex : null}
            onSelect={(index) => {
              if ((heatValues[index] ?? 0) <= 0) {
                return;
              }
              const date = heatDates[index];
              const key = formatModelDate(date, "ymd");
              const workouts = grouped.get(key) ?? [];
              setSelectedTrainingDateKey(key);
              if (workouts[0]) {
                setSelected(workouts[0]);
              }
            }}
          />
        </div>
        <div className="in-panel col-8" style={{ padding: 18 }}>
          <div className="card-header">
            <h3>Recent sessions</h3>
            <span className="label">select a row to inspect</span>
          </div>
          {recent.map((workout) => (
            <button key={workout.id} type="button" onClick={() => setSelected(workout)} style={{ ...workoutRowStyle, background: current?.id === workout.id ? "var(--bg-2)" : "transparent", borderLeft: current?.id === workout.id ? "2px solid var(--train)" : "2px solid transparent" }} className="session-list-row">
              <div className="session-list-grid">
                <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{formatModelDate(workout.dateValue, "full")}</span>
                <span style={{ color: "var(--ink-1)" }}>{workout.type}</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-1)" }}>{(workout.distance_km ?? 0).toFixed(1)} km</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-2)" }}>{formatPace(workout.pace)}/km</span>
              </div>
            </button>
          ))}
        </div>
      </div>
      <TrainingDayModal date={selectedTrainingDate} workouts={selectedDayWorkouts} onClose={() => setSelectedTrainingDateKey(null)} />
    </>
  );
}

export function InstrumentHeart(props: PageProps) {
  const { model, range, onRangeChange } = props;
  const days = rangeDays(range);
  const dates = model.dates.slice(-days);
  const hrvDelta = model.today.hrv - model.today.hrvBase;
  const rhrDelta = model.today.rhr - model.today.rhrBase;
  const recentVo2 = average(model.vo2.slice(-7));
  const priorVo2 = average(model.vo2.slice(-14, -7));
  const vo2Delta = recentVo2 - priorVo2;
  const qualifyingSessions = workoutsInRange(model, days).filter((workout) => /walk|run|hike/i.test(workout.type));

  return (
    <>
      <InstrumentPageHead code="HEART" title="Recovery signals and baselines" detail={`Window ${days}d · hover any point`} range={range} onRangeChange={onRangeChange} accent="var(--heart)" />

      <div style={instrumentMetricGridStyle}>
        <InstrumentMetricPanel label="Readiness" value={model.today.readiness.toFixed(0)} unit="" detail={`yesterday ${model.today.readinessYest.toFixed(0)}`} color="var(--recov)" />
        <InstrumentMetricPanel label="HRV" value={model.today.hrv.toFixed(1)} unit="ms" detail={`14D ${model.today.hrvBase.toFixed(1)} ms`} color="var(--heart)" />
        <InstrumentMetricPanel label="RHR" value={model.today.rhr.toFixed(0)} unit="bpm" detail={`14D ${model.today.rhrBase.toFixed(1)} bpm`} color="var(--heart-2)" />
        <InstrumentMetricPanel label="VO₂" value={model.today.vo2.toFixed(1)} unit="ml/kg" detail="current estimate" color="var(--info)" />
      </div>

      <div className="grid g-12" style={{ marginBottom: 16 }}>
        <div className="in-panel col-8" style={{ padding: 18 }}>
          <div className="card-header">
            <h3>HRV vs baseline</h3>
            <span className="label">14D rolling mean</span>
          </div>
          <LineChart data={model.hrv.slice(-days)} baseline={model.hrvBaseline.slice(-days)} dates={dates} width={720} height={220} stroke="var(--heart)" tooltipLabel="HRV" tooltipValueFormatter={(value) => `${value.toFixed(1)} ms`} baselineLabel="14D mean" baselineValueFormatter={(value) => `${value.toFixed(1)} ms`} annotations={model.annotations.map((annotation) => ({ ...annotation, dayIdx: annotation.dayIdx - (model.dates.length - days) })).filter((annotation) => annotation.dayIdx >= 0)} />
        </div>
        <div className="in-panel col-4" style={{ padding: 18 }}>
          <div className="card-header">
            <h3>Signal snapshot</h3>
            <span className="label">why today reads this way</span>
          </div>
          <div className="annot">
            <span className="d">READY</span>
            <span style={{ color: "var(--ink-1)" }}>Readiness is already shown above, so this panel is now about interpretation rather than repeating the same number.</span>
          </div>
          <div className="annot">
            <span className="d">HRV</span>
            <span style={{ color: "var(--ink-1)" }}>{hrvDelta >= 0 ? "Above" : "Below"} baseline by {Math.abs(hrvDelta).toFixed(1)} ms.</span>
          </div>
          <div className="annot">
            <span className="d">RHR</span>
            <span style={{ color: "var(--ink-1)" }}>{rhrDelta >= 0 ? "Above" : "Below"} baseline by {Math.abs(rhrDelta).toFixed(1)} bpm.</span>
          </div>
          <div className="annot">
            <span className="d">VO2</span>
            <span style={{ color: "var(--ink-1)" }}>{vo2Delta <= -0.2 ? "Recent cardio-fitness estimate is slipping." : vo2Delta >= 0.2 ? "Recent cardio-fitness estimate is improving." : "Recent cardio-fitness estimate is mostly flat."}</span>
          </div>
        </div>
      </div>

      <div className="grid g-12">
        <div className="in-panel col-6" style={{ padding: 18 }}>
          <div className="card-header">
            <h3>Resting heart rate</h3>
          </div>
          <LineChart data={model.rhr.slice(-days)} baseline={model.rhrBaseline.slice(-days)} dates={dates} width={520} height={200} stroke="var(--heart-2)" tooltipLabel="RHR" tooltipValueFormatter={(value) => `${value.toFixed(0)} bpm`} baselineLabel="14D mean" baselineValueFormatter={(value) => `${value.toFixed(1)} bpm`} />
        </div>
        <div className="in-panel col-6" style={{ padding: 18 }}>
          <div className="card-header">
            <h3>VO₂ max estimate</h3>
          </div>
          <LineChart data={model.vo2.slice(-days)} dates={dates} width={520} height={200} stroke="var(--info)" tooltipLabel="VO₂ max" tooltipValueFormatter={(value) => `${value.toFixed(1)} ml/kg`} />
        </div>
      </div>

      <div className="in-panel" style={{ padding: 18, marginTop: 16 }}>
        <div className="card-header">
          <h3>Plain-language readout</h3>
          <span className="label">how to interpret the panel</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <div>
            <div className="label" style={{ color: "var(--heart)", marginBottom: 8 }}>Recovery</div>
            <div style={{ fontSize: 13, color: "var(--ink-1)", lineHeight: 1.6 }}>
              {hrvDelta >= 0 && rhrDelta <= 0
                ? "HRV is above baseline and resting heart rate is contained, which usually points to a friendlier recovery state."
                : hrvDelta < 0 && rhrDelta > 0
                  ? "HRV is below baseline while resting heart rate is running hot, which usually reads as accumulated strain."
                  : "One signal improved while the other lagged, so treat today's heart panel as mixed rather than all-good or all-bad."}
            </div>
          </div>
          <div>
            <div className="label" style={{ color: "var(--info)", marginBottom: 8 }}>VO₂ estimate</div>
            <div style={{ fontSize: 13, color: "var(--ink-1)", lineHeight: 1.6 }}>
              {qualifyingSessions.length < 2
                ? "This window has very few qualifying outdoor walk, run, or hike sessions, so the estimate can drift on sparse input."
                : vo2Delta <= -0.2
                  ? "The recent VO₂ average is drifting down. That can reflect easier qualifying sessions, fewer of them, or real fitness loss."
                  : vo2Delta >= 0.2
                    ? "The recent VO₂ average is ticking up, which usually means the qualifying aerobic work is trending in a better direction."
                    : "The recent VO₂ line is mostly stable. Small moves are normal when session mix changes."}
            </div>
          </div>
          <div>
            <div className="label" style={{ color: "var(--recov)", marginBottom: 8 }}>Today</div>
            <div style={{ fontSize: 13, color: "var(--ink-1)", lineHeight: 1.6 }}>
              HRV {model.today.hrv.toFixed(1)} ms vs {model.today.hrvBase.toFixed(1)} ms baseline, RHR {model.today.rhr.toFixed(0)} bpm vs {model.today.rhrBase.toFixed(1)} bpm baseline, VO₂ {model.today.vo2.toFixed(1)} ml/kg.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function InstrumentCorrelate(props: PageProps) {
  const { model, range, onRangeChange } = props;
  const days = rangeDays(range);
  const start = Math.max(0, model.dates.length - days);
  const sleepWindow = model.sleep.slice(start);
  const hrvWindow = model.hrv.slice(start);
  const readinessWindow = model.readiness.slice(start);
  const rhrWindow = model.rhr.slice(start);
  const deepWindow = model.sleepStages.slice(start).map((entry) => entry.deep);
  const remWindow = model.sleepStages.slice(start).map((entry) => entry.rem);
  const dateWindow = model.dates.slice(start);
  const windowAnnotations = model.annotations.filter((annotation) => annotation.dayIdx >= start);
  const pairEntries = clip(sleepWindow, 1).map((value, index) => ({
    sleep: value,
    hrv: hrvWindow[index + 1],
    date: dateWindow[index + 1]
  }));
  const pairs = pairEntries.map((entry) => [entry.sleep, entry.hrv] as [number, number]);
  const windowCorrelations = {
    sleepToHRV: corr(clip(sleepWindow, 1), shift(hrvWindow, 1)),
    sleepToRHR: corr(clip(sleepWindow, 1), shift(rhrWindow, 1)),
    deepToHRV: corr(clip(deepWindow, 1), shift(hrvWindow, 1)),
    remToReady: corr(clip(remWindow, 1), shift(readinessWindow, 1))
  };
  const matrix = [
    [1, corr(sleepWindow, hrvWindow), corr(sleepWindow, readinessWindow), corr(sleepWindow, rhrWindow)],
    [corr(hrvWindow, sleepWindow), 1, corr(hrvWindow, readinessWindow), corr(hrvWindow, rhrWindow)],
    [corr(readinessWindow, sleepWindow), corr(readinessWindow, hrvWindow), 1, corr(readinessWindow, rhrWindow)],
    [corr(rhrWindow, sleepWindow), corr(rhrWindow, hrvWindow), corr(rhrWindow, readinessWindow), 1]
  ];
  const alcoholDays = windowAnnotations.filter((annotation) => annotation.kind === "alcohol").map((annotation) => annotation.dayIdx);
  const nextDayHrv = alcoholDays.map((index) => model.hrv[index + 1] ?? null).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const alcoholBaseline = average(model.hrvBaseline.slice(start));
  const alcoholAfter = nextDayHrv.length > 0 ? average(nextDayHrv) : alcoholBaseline;

  return (
    <>
      <InstrumentPageHead code="CORR" title="Relationships and life context" detail={`Window ${days}d · change the range to recalculate the relationships`} range={range} onRangeChange={onRangeChange} accent="var(--info)" />

      <div style={instrumentMetricGridStyle}>
        <InstrumentMetricPanel label="Sleep → HRV" value={windowCorrelations.sleepToHRV.toFixed(2)} unit="r" detail="next-day effect" color="var(--sleep)" />
        <InstrumentMetricPanel label="Sleep → RHR" value={windowCorrelations.sleepToRHR.toFixed(2)} unit="r" detail="inverse is better" color="var(--heart)" />
        <InstrumentMetricPanel label="Deep → HRV" value={windowCorrelations.deepToHRV.toFixed(2)} unit="r" detail="sleep quality link" color="var(--sleep)" />
        <InstrumentMetricPanel label="REM → Ready" value={windowCorrelations.remToReady.toFixed(2)} unit="r" detail="readiness link" color="var(--recov)" />
      </div>

      <div className="grid g-12" style={{ marginBottom: 16 }}>
        <div className="in-panel" style={{ padding: 18, gridColumn: "1 / -1" }}>
          <div className="card-header">
            <h3>How this page works</h3>
            <span className="label">plain-language guide</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <div style={{ fontSize: 13, color: "var(--ink-1)", lineHeight: 1.65 }}>
              Correlations here run from `-1` to `+1`. Values near zero mean the relationship is weak in your data. Positive means two things usually rise together. Negative means one tends to fall as the other rises.
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-1)", lineHeight: 1.65 }}>
              Annotations do not directly change readiness, HRV, or sleep. They tag a date so the dashboard can mark that night on charts and compare the following morning against your rolling baseline.
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-1)", lineHeight: 1.65 }}>
              For alcohol specifically, the “impact” card collects the mornings after logged drinking nights and compares those HRV values with your usual rolling baseline. Right now that sample size is {nextDayHrv.length}.
            </div>
          </div>
        </div>
      </div>

      <div className="grid g-12" style={{ marginBottom: 16 }}>
        <div className="in-panel col-7" style={{ padding: 18 }}>
          <div className="card-header">
            <h3>Sleep duration vs next-day HRV</h3>
            <span className="label">{pairs.length} observations</span>
          </div>
          <Scatter pairs={pairs} width={620} height={280} color="var(--sleep)" xLabel="Sleep" yLabel="Next-day HRV" xFormatter={(value) => `${value.toFixed(1)} h`} yFormatter={(value) => `${value.toFixed(1)} ms`} pointLabels={pairEntries.map((entry) => formatModelDate(entry.date, "full"))} />
        </div>
        <div className="in-panel col-5" style={{ padding: 18 }}>
          <div className="card-header">
            <h3>Alcohol impact</h3>
            <span className="label">{nextDayHrv.length} annotations</span>
          </div>
          <div style={legendRowStyle}>
            <LegendItem color="var(--ink-3)" label="rolling baseline" />
            <LegendItem color="var(--heart)" label="morning after alcohol" />
          </div>
          <CompareBars
            items={[{ label: "BASE", a: alcoholBaseline, b: alcoholBaseline }, { label: "D+1", a: alcoholBaseline, b: alcoholAfter }]}
            width={360}
            height={190}
            color="var(--heart)"
            aLabel="Rolling baseline"
            bLabel="Morning after"
            valueFormatter={(value) => `${value.toFixed(1)} ms`}
          />
          <div style={{ marginTop: 14, fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 }}>
            Next-morning HRV moved by {(alcoholAfter - alcoholBaseline).toFixed(1)} ms relative to the rolling baseline.
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 }}>
            If you log “4 cans of 500cc beer” on a given night, the system does not subtract points from readiness directly. Instead, it tags that night, then checks what the next morning looked like versus your usual baseline.
          </div>
        </div>
      </div>

      <div className="grid g-12">
        <div className="in-panel col-7" style={{ padding: 18 }}>
          <div className="card-header">
            <h3>Correlation matrix</h3>
            <span className="label">{days} day window</span>
          </div>
          <CorrMatrix labels={["Sleep", "HRV", "Ready", "RHR"]} matrix={matrix} size={58} />
        </div>
        <div className="in-panel col-5" style={{ padding: 18 }}>
          <div className="card-header">
            <h3>Recent annotations</h3>
            <span className="label">context layer</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.6, marginBottom: 12 }}>
            Positive `r` means the two measures usually rise together. Negative `r` means one tends to fall when the other rises. Annotations are context only: they help explain outliers and power the before/after comparisons above.
          </div>
          {windowAnnotations.length > 0 ? windowAnnotations.slice(-8).reverse().map((annotation) => (
            <div key={annotation.id} className="annot">
              <span className="d">{annotation.date}</span>
              <span style={{ color: "var(--ink-2)" }}>{annotation.dot}</span>
              <span style={{ color: "var(--ink-1)" }}>{annotation.label}</span>
            </div>
          )) : <div className="tiny">No annotations yet in this window. Add them in Settings.</div>}
        </div>
      </div>
    </>
  );
}

export function InstrumentWeekly(props: PageProps) {
  const { model } = props;
  const thisWeekSleep = model.sleep.slice(-7);
  const lastWeekSleep = model.sleep.slice(-14, -7);
  const thisWeekHrv = model.hrv.slice(-7);
  const lastWeekHrv = model.hrv.slice(-14, -7);
  const thisWeekRhr = model.rhr.slice(-7);
  const lastWeekRhr = model.rhr.slice(-14, -7);
  const sleepCompare = buildWeekCompareItems(model.sleep.slice(-14), model.sleep.slice(-7), model.dates.slice(-7));
  const readinessCompare = buildWeekCompareItems(model.readiness.slice(-14), model.readiness.slice(-7), model.dates.slice(-7));
  const thisWeekWorkouts = model.workouts.filter((workout) => workout.date >= formatModelDate(model.dates.at(-7) ?? new Date(), "ymd"));
  const lastWeekDistance = sum(model.workouts.filter((workout) => workout.date >= formatModelDate(model.dates.at(-14) ?? new Date(), "ymd") && workout.date < formatModelDate(model.dates.at(-7) ?? new Date(), "ymd")).map((workout) => workout.distance_km ?? 0));
  const lastWeekSessions = model.workouts.filter((workout) => workout.date >= formatModelDate(model.dates.at(-14) ?? new Date(), "ymd") && workout.date < formatModelDate(model.dates.at(-7) ?? new Date(), "ymd")).length;
  const rows = [
    { label: "Sleep", current: average(thisWeekSleep), prior: average(lastWeekSleep), unit: "h", color: "var(--sleep)" },
    { label: "HRV", current: average(thisWeekHrv), prior: average(lastWeekHrv), unit: "ms", color: "var(--heart)" },
    { label: "RHR", current: average(thisWeekRhr), prior: average(lastWeekRhr), unit: "bpm", color: "var(--heart-2)" },
    { label: "Distance", current: sum(thisWeekWorkouts.map((workout) => workout.distance_km ?? 0)), prior: lastWeekDistance, unit: "km", color: "var(--train)" },
    { label: "Sessions", current: thisWeekWorkouts.length, prior: lastWeekSessions, unit: "", color: "var(--info)" }
  ];

  return (
    <>
      <InstrumentPageHead
        code="WEEK"
        title="Week over week review"
        detail="Operational summary of sleep, recovery, and training"
        accent="var(--recov)"
        controls={
          <div style={legendCardStyle}>
            <LegendItem color="var(--ink-3)" label="prior week" />
            <LegendItem color="var(--sleep)" label="this week sleep" />
            <LegendItem color="var(--recov)" label="this week readiness" />
          </div>
        }
      />

      <div style={instrumentMetricGridStyle}>
        {rows.map((row) => (
          <InstrumentMetricPanel key={row.label} label={row.label} value={Number(row.current).toFixed(row.unit === "" ? 0 : 1)} unit={row.unit} detail={`prior ${formatLedgerValue(row.prior, row.unit)}`} color={row.color} />
        ))}
      </div>

      <div className="grid g-12" style={{ marginBottom: 16 }}>
        <div className="in-panel col-6" style={{ padding: 18 }}>
          <div className="card-header">
            <h3>Sleep week vs prior</h3>
            <span className="label">grey = prior, violet = this week</span>
          </div>
          <CompareBars items={sleepCompare} width={520} height={190} color="var(--sleep)" aLabel="Prior week" bLabel="This week" valueFormatter={(value) => `${value.toFixed(1)} h`} />
        </div>
        <div className="in-panel col-6" style={{ padding: 18 }}>
          <div className="card-header">
            <h3>Readiness week vs prior</h3>
            <span className="label">grey = prior, green = this week</span>
          </div>
          <CompareBars items={readinessCompare} width={520} height={190} color="var(--recov)" aLabel="Prior week" bLabel="This week" valueFormatter={(value) => `${value.toFixed(0)}`} />
        </div>
      </div>

      <div className="grid g-12">
        <div className="in-panel col-7" style={{ padding: 18 }}>
          <div className="card-header">
            <h3>Sessions this week</h3>
            <span className="label">{thisWeekWorkouts.length} workouts</span>
          </div>
          {thisWeekWorkouts.length > 0 ? thisWeekWorkouts.map((workout) => (
            <div key={workout.id} className="annot">
              <span className="d">{formatModelDate(workout.dateValue, "full")}</span>
              <span style={{ color: "var(--ink-1)" }}>{workout.type}</span>
              <span className="mono" style={{ color: "var(--ink-2)" }}>{(workout.distance_km ?? 0).toFixed(1)} km · {formatPace(workout.pace)}/km</span>
            </div>
          )) : <div className="tiny">No workouts recorded this week.</div>}
        </div>
        <div className="in-panel col-5" style={{ padding: 18 }}>
          <div className="card-header">
            <h3>Annotations</h3>
            <span className="label">last 14 days</span>
          </div>
          {model.annotations.length > 0 ? model.annotations.slice(-8).reverse().map((annotation) => (
            <div key={annotation.id} className="annot">
              <span className="d">{annotation.date}</span>
              <span style={{ color: "var(--ink-2)" }}>{annotation.dot}</span>
              <span style={{ color: "var(--ink-1)" }}>{annotation.label}</span>
            </div>
          )) : <div className="tiny">No annotations yet.</div>}
        </div>
      </div>
    </>
  );
}

export function InstrumentSettings(props: SettingsProps) {
  const { model, range, onRangeChange, saving, onImported, onCreateAnnotation, onUpdateAnnotation, onDeleteAnnotation } = props;
  const [draft, setDraft] = useState({ date: formatModelDate(model.dates.at(-1) ?? new Date(), "ymd"), kind: "stress", label: "" });
  const [editingId, setEditingId] = useState<number | null>(null);

  const submit = async () => {
    if (!draft.label.trim()) {
      return;
    }
    if (editingId) {
      await onUpdateAnnotation(editingId, draft);
      setEditingId(null);
    } else {
      await onCreateAnnotation(draft);
    }
    setDraft((current) => ({ ...current, label: "" }));
  };

  return (
    <>
      <InstrumentPageHead code="SET" title="Imports and annotations" detail="Operational inputs for the correlation explorer" range={range} onRangeChange={onRangeChange} accent="var(--info)" />
      <div className="in-panel" style={{ padding: 18, marginBottom: 16 }}>
        <div className="card-header">
          <h3>Apple Health import</h3>
          <span className="label">export.zip ingest</span>
        </div>
        <AppleImportPanel onImported={onImported} />
      </div>
      <div className="grid g-12">
        <div className="in-panel col-5" style={{ padding: 18 }}>
          <div className="card-header">
            <h3>{editingId ? "Edit annotation" : "Add annotation"}</h3>
            <span className="label">feeds correlate tab</span>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Date</span>
              <input type="date" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} />
            </label>
            <label className="field">
              <span>Kind</span>
              <select value={draft.kind} onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value }))}>
                {annotationOptions().map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="field field-wide">
              <span>Label</span>
              <input type="text" value={draft.label} onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))} placeholder="e.g. travel day + poor sleep" />
            </label>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button type="button" className="btn primary" onClick={() => void submit()} disabled={saving}>{editingId ? "Update" : "Add"}</button>
            {editingId ? <button type="button" className="btn" onClick={() => { setEditingId(null); setDraft({ date: formatModelDate(model.dates.at(-1) ?? new Date(), "ymd"), kind: "stress", label: "" }); }}>Cancel</button> : null}
          </div>
        </div>
        <div className="in-panel col-7" style={{ padding: 18 }}>
          <div className="card-header">
            <h3>Existing annotations</h3>
            <span className="label">{model.annotations.length} total</span>
          </div>
          {model.annotations.length > 0 ? (
            model.annotations.map((annotation) => (
              <div key={annotation.id} className="annotation-row">
                <div>
                  <div style={annotationDateStyle}>{annotation.date} · {annotation.kind}</div>
                  <div style={{ marginTop: 4, color: "var(--ink-1)" }}>{annotation.label}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="btn" onClick={() => { setEditingId(annotation.id); setDraft({ date: annotation.date, kind: annotation.kind, label: annotation.label }); }}>Edit</button>
                  <button type="button" className="btn" onClick={() => void onDeleteAnnotation(annotation.id)}>Delete</button>
                </div>
              </div>
            ))
          ) : (
            <div className="tiny">No annotations yet. Add one here to feed the correlate tab immediately.</div>
          )}
        </div>
      </div>
    </>
  );
}

function PageHead({
  eyebrow,
  title,
  subtitle,
  accent,
  range,
  onRangeChange
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  accent: string;
  range: UiRange;
  onRangeChange: (range: UiRange) => void;
}) {
  return (
    <div className="pagehead">
      <div>
        <div className="eyebrow" style={{ color: accent }}>
          {eyebrow}
        </div>
        <h1>{title}</h1>
        <p className="sub">{subtitle}</p>
      </div>
      <RangePills value={range} onChange={onRangeChange} />
    </div>
  );
}

function InstrumentPageHead({
  code,
  title,
  detail,
  range,
  onRangeChange,
  accent,
  controls
}: {
  code: string;
  title: string;
  detail: string;
  range?: UiRange;
  onRangeChange?: (range: UiRange) => void;
  accent: string;
  controls?: React.ReactNode;
}) {
  return (
    <div className="pagehead">
      <div>
        <div className="label" style={{ color: accent, marginBottom: 8 }}>{code}</div>
        <h1 style={{ fontFamily: "var(--mono)", fontSize: "clamp(26px, 3vw, 38px)", letterSpacing: "-0.03em" }}>{title}</h1>
        <p className="sub">{detail}</p>
      </div>
      {controls ?? (range && onRangeChange ? <RangePills value={range} onChange={onRangeChange} /> : null)}
    </div>
  );
}

function InstrumentMetricPanel({
  label,
  value,
  unit,
  detail,
  color
}: {
  label: string;
  value: string;
  unit: string;
  detail: string;
  color: string;
}) {
  return (
    <div className="in-panel" style={{ padding: 14 }}>
      <div className="label" style={{ color, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span className="mono" style={{ fontSize: 30, color: "var(--ink-0)", letterSpacing: "-0.02em" }}>{value}</span>
        {unit ? <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{unit}</span> : null}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: "var(--ink-3)" }}>{detail}</div>
    </div>
  );
}

function SleepWindowChart({
  stages,
  dates,
  compact = false,
  width,
  selectedIndex,
  onSelect
}: {
  stages: WorkbenchModel["sleepStages"];
  dates: Date[];
  compact?: boolean;
  width?: number;
  selectedIndex?: number | null;
  onSelect?: (index: number) => void;
}) {
  const chartWidth = width ?? (compact ? 320 : 360);
  const rowHeight = compact ? 12 : 16;
  const labelWidth = compact ? 52 : 62;
  const timelineLeft = labelWidth + 10;
  const timelineWidth = chartWidth - timelineLeft - 10;
  const height = stages.length * rowHeight + 46;

  return (
    <svg viewBox={`0 0 ${chartWidth} ${height}`} width="100%" height={height} style={{ display: "block", maxWidth: "100%", height: "auto" }}>
      {[20, 24, 28, 32, 36].map((hour) => {
        const x = timelineLeft + ((hour - 20) / 16) * timelineWidth;
        return (
          <g key={hour}>
            <line x1={x} x2={x} y1={10} y2={height - 18} stroke="var(--line)" strokeDasharray="2 4" />
            <text x={x} y={height - 4} textAnchor="middle" fontSize="9" fill="var(--ink-3)">
              {String(hour % 24).padStart(2, "0")}:00
            </text>
          </g>
        );
      })}
      {stages.map((stage, index) => {
        const bed = normalizeSleepWindowHour(stage.bedtime);
        let wake = normalizeSleepWindowHour(stage.waketime);
        if (wake <= bed) {
          wake += 24;
        }
        const x = timelineLeft + ((bed - 20) / 16) * timelineWidth;
        const barWidth = ((wake - bed) / 16) * timelineWidth;
        const y = 12 + index * rowHeight;
        return (
          <g key={`${stage.total}-${index}`}>
            <text x={0} y={y + 8} fontSize="9" fill="var(--ink-3)" fontFamily="var(--mono)">
              {formatModelDate(dates[index], compact ? "md" : "short")}
            </text>
            <rect x={timelineLeft} y={y} width={timelineWidth} height={compact ? 8 : 10} rx="4" fill="var(--bg-2)" />
            <rect x={clamp(x, timelineLeft, timelineLeft + timelineWidth)} y={y} width={Math.max(2, Math.min(barWidth, timelineWidth))} height={compact ? 8 : 10} rx="4" fill="oklch(70% 0.12 285)" opacity="0.8" />
            <rect
              x={timelineLeft}
              y={y - 1}
              width={timelineWidth}
              height={(compact ? 8 : 10) + 2}
              rx="4"
              fill="transparent"
              stroke={selectedIndex === index ? "var(--ink-1)" : "transparent"}
              strokeWidth={selectedIndex === index ? "1" : "0"}
            />
            <rect
              x={timelineLeft}
              y={y - 2}
              width={timelineWidth}
              height={(compact ? 8 : 10) + 4}
              fill="transparent"
              tabIndex={0}
              aria-label={`Sleep window for ${dates[index].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
              onClick={() => onSelect?.(index)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect?.(index);
                }
              }}
            />
          </g>
        );
      })}
    </svg>
  );
}

function BigStat({ label, value, unit, sub, color }: { label: string; value: string | number; unit: string; sub: string; color: string }) {
  return (
    <div className="card pad-lg">
      <div className="label" style={{ color, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--serif)", fontSize: "clamp(30px, 3vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.02em", color: "var(--ink-0)", whiteSpace: "nowrap" }}>{value}</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{unit}</span>
      </div>
      <div className="tiny" style={{ marginTop: 8, color: "var(--ink-3)", textTransform: "none", letterSpacing: "0.02em", fontFamily: "var(--sans)", fontSize: 12 }}>
        {sub}
      </div>
    </div>
  );
}

function NarrativeStat({
  label,
  value,
  unit,
  delta,
  good,
  sub,
  reverse
}: {
  label: string;
  value: string | number;
  unit: string;
  delta: number;
  good: boolean;
  sub?: string;
  reverse?: boolean;
}) {
  const isGood = reverse ? !good : good;
  return (
    <div>
      <div className="label" style={{ marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontFamily: "var(--serif)", fontSize: 34, color: "var(--ink-0)", lineHeight: 1, letterSpacing: "-0.01em" }}>{value}</span>
        {unit ? <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.05em" }}>{unit}</span> : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: isGood ? "oklch(75% 0.14 150)" : "oklch(70% 0.16 22)" }}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}
        </span>
        {sub ? <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.06em" }}>{sub}</span> : null}
      </div>
    </div>
  );
}

function MiniStat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 4, fontSize: 9 }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 24, color: "var(--ink-0)", lineHeight: 1 }}>
        {value}
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", marginLeft: 4 }}>{unit}</span>
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 10, height: 10, borderRadius: 999, background: color, display: "inline-block", boxShadow: color === "var(--ink-3)" ? "inset 0 0 0 1px var(--line-bright)" : "none" }} />
      <span className="mono" style={{ fontSize: 10, color: "var(--ink-2)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
    </div>
  );
}

function InGauge({
  label,
  value,
  unit,
  z,
  base,
  color
}: {
  label: string;
  value: string;
  unit: string;
  z: number;
  base: string;
  color: string;
}) {
  return (
    <div>
      <div className="label" style={{ color, marginBottom: 4, fontSize: 9 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span className="mono" style={{ fontSize: 28, color: "var(--ink-0)", fontWeight: 500, letterSpacing: "-0.01em" }}>
          {value}
        </span>
        <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>
          {unit}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, fontFamily: "var(--mono)", fontSize: 10 }}>
        <span style={{ color: z >= 0 ? "oklch(75% 0.14 150)" : "oklch(70% 0.16 22)" }}>
          Z{z >= 0 ? "+" : ""}
          {z.toFixed(1)}
        </span>
        <span style={{ color: "var(--ink-3)" }}>14D {base}</span>
      </div>
    </div>
  );
}

function SegPct({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: `${Math.min(60, value * 0.6)}px`, height: 3, background: color, borderRadius: 1 }} />
      <span className="mono" style={{ fontSize: 11, color: "var(--ink-1)" }}>
        {value.toFixed(0)}%
      </span>
    </div>
  );
}

function DetailModalShell({
  title,
  subtitle,
  onClose,
  children
}: React.PropsWithChildren<{ title: string; subtitle: string; onClose: () => void }>) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "rgba(8, 8, 10, 0.74)",
        backdropFilter: "blur(6px)"
      }}
      onClick={onClose}
    >
      <div
        className="card pad-lg"
        style={{ width: "min(920px, calc(100vw - 48px))", maxHeight: "min(88vh, 900px)", overflow: "auto", boxShadow: "0 24px 80px rgba(0, 0, 0, 0.45)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="card-header" style={{ alignItems: "flex-start" }}>
          <div>
            <h3 style={{ fontSize: 18, marginBottom: 6 }}>{title}</h3>
            <div style={{ fontSize: 13, color: "var(--ink-2)", maxWidth: 640, lineHeight: 1.6 }}>{subtitle}</div>
          </div>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SleepDetailModal({
  model,
  localIndex,
  offset,
  dates,
  stages,
  onClose
}: {
  model: WorkbenchModel;
  localIndex: number | null;
  offset: number;
  dates: Date[];
  stages: WorkbenchModel["sleepStages"];
  onClose: () => void;
}) {
  if (localIndex === null || !stages[localIndex] || !dates[localIndex]) {
    return null;
  }

  const stage = stages[localIndex];
  const date = dates[localIndex];
  const globalIndex = offset + localIndex;
  const nextDayIndex = globalIndex + 1;
  const matchingAnnotations = model.annotations.filter((annotation) => annotation.dayIdx === globalIndex);
  const stageBreakdown = [
    { label: "Deep", value: stage.deep, color: "oklch(45% 0.12 265)" },
    { label: "Core", value: stage.core, color: "oklch(62% 0.12 265)" },
    { label: "REM", value: stage.rem, color: "oklch(70% 0.13 310)" },
    { label: "Awake", value: stage.awake, color: "oklch(68% 0.12 55)" }
  ];

  return (
    <DetailModalShell
      title={`Sleep detail · ${formatModelDate(date, "full")}`}
      subtitle="This view combines the selected night’s stage mix, timing, next-morning recovery, and any annotations logged on that date."
      onClose={onClose}
    >
      <div style={instrumentMetricGridStyle}>
        <InstrumentMetricPanel label="Total" value={stage.total.toFixed(1)} unit="h" detail="time asleep" color="var(--sleep)" />
        <InstrumentMetricPanel label="Bedtime" value={formatClock(stage.bedtime)} unit="" detail="sleep onset" color="var(--sleep)" />
        <InstrumentMetricPanel label="Wake" value={formatClock(stage.waketime)} unit="" detail="final wake" color="var(--sleep)" />
        <InstrumentMetricPanel label="Efficiency" value={(((stage.total - stage.awake) / Math.max(0.1, stage.total)) * 100).toFixed(0)} unit="%" detail="asleep vs awake" color="var(--sleep)" />
      </div>

      <div className="grid g-12" style={{ marginBottom: 16 }}>
        <div className="col-7" style={{ minWidth: 0 }}>
          <div className="label" style={{ marginBottom: 10 }}>Stage breakdown</div>
          {stageBreakdown.map((item) => (
            <div key={item.label} style={{ display: "grid", gridTemplateColumns: "80px 1fr auto auto", gap: 12, alignItems: "center", padding: "8px 0", borderTop: "1px dotted var(--line)" }}>
              <span className="label" style={{ color: "var(--ink-2)" }}>{item.label}</span>
              <div style={{ height: 8, borderRadius: 999, overflow: "hidden", background: "var(--bg-2)" }}>
                <div style={{ width: `${percentNumber(item.value, stage.total).toFixed(0)}%`, height: "100%", background: item.color }} />
              </div>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-1)" }}>{item.value.toFixed(1)}h</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{percentNumber(item.value, stage.total).toFixed(0)}%</span>
            </div>
          ))}
        </div>
        <div className="col-5" style={{ minWidth: 0 }}>
          <div className="label" style={{ marginBottom: 10 }}>Next morning</div>
          <div className="annot">
            <span className="d">HRV</span>
            <span style={{ color: "var(--ink-1)" }}>{model.hrv[nextDayIndex] ? `${model.hrv[nextDayIndex].toFixed(1)} ms` : "No next-morning HRV sample in range."}</span>
          </div>
          <div className="annot">
            <span className="d">RHR</span>
            <span style={{ color: "var(--ink-1)" }}>{model.rhr[nextDayIndex] ? `${model.rhr[nextDayIndex].toFixed(0)} bpm` : "No next-morning resting heart rate sample in range."}</span>
          </div>
          <div className="annot">
            <span className="d">READY</span>
            <span style={{ color: "var(--ink-1)" }}>{model.readiness[nextDayIndex] ? `${model.readiness[nextDayIndex].toFixed(0)} readiness` : "No next-morning readiness score in range."}</span>
          </div>
        </div>
      </div>

      <div className="grid g-12">
        <div className="col-6" style={{ minWidth: 0 }}>
          <div className="label" style={{ marginBottom: 10 }}>Interpretation</div>
          <div style={{ fontSize: 13, color: "var(--ink-1)", lineHeight: 1.65 }}>
            Deep sleep was {percentNumber(stage.deep, stage.total).toFixed(1)}% and REM was {percentNumber(stage.rem, stage.total).toFixed(1)}% of this night. Because deep sleep tends to cluster earlier in the night, shortened or fragmented nights often show up here first.
          </div>
        </div>
        <div className="col-6" style={{ minWidth: 0 }}>
          <div className="label" style={{ marginBottom: 10 }}>Matching annotations</div>
          {matchingAnnotations.length > 0 ? matchingAnnotations.map((annotation) => (
            <div key={annotation.id} className="annot">
              <span className="d">{annotation.kind}</span>
              <span style={{ color: "var(--ink-2)", marginRight: 6 }}>{annotation.dot}</span>
              <span style={{ color: "var(--ink-1)" }}>{annotation.label}</span>
            </div>
          )) : <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.65 }}>No annotations were logged on this date.</div>}
        </div>
      </div>
    </DetailModalShell>
  );
}

function TrainingDayModal({
  date,
  workouts,
  onClose
}: {
  date: Date | null;
  workouts: WorkoutView[];
  onClose: () => void;
}) {
  if (!date || workouts.length === 0) {
    return null;
  }

  const totalDistance = sum(workouts.map((workout) => workout.distance_km ?? 0));
  const totalMinutes = sum(workouts.map((workout) => workout.duration_min ?? 0));
  const zone2Minutes = sum(workouts.map((workout) => workout.zones[1] ?? 0));

  return (
    <DetailModalShell
      title={`Training day · ${formatModelDate(date, "full")}`}
      subtitle="The calendar acts as a day selector. Clicking a loaded day opens the sessions logged on that date and syncs the focus panel to the first workout."
      onClose={onClose}
    >
      <div style={instrumentMetricGridStyle}>
        <InstrumentMetricPanel label="Sessions" value={String(workouts.length)} unit="" detail="workouts on this date" color="var(--train)" />
        <InstrumentMetricPanel label="Distance" value={totalDistance.toFixed(1)} unit="km" detail="combined distance" color="var(--train)" />
        <InstrumentMetricPanel label="Minutes" value={totalMinutes.toFixed(0)} unit="min" detail="combined duration" color="var(--train)" />
        <InstrumentMetricPanel label="Zone 2" value={totalMinutes > 0 ? ((zone2Minutes / totalMinutes) * 100).toFixed(0) : "0"} unit="%" detail="share of minutes" color="var(--train)" />
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {workouts.map((workout) => (
          <div key={workout.id} className="card" style={{ background: "var(--bg-2)", padding: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr repeat(4, auto)", gap: 16, alignItems: "baseline" }}>
              <div>
                <div className="label" style={{ marginBottom: 6 }}>{workout.type}</div>
                <div style={{ fontSize: 13, color: "var(--ink-2)" }}>{workout.start.slice(11, 16)} start · {workout.end.slice(11, 16)} finish</div>
              </div>
              <span className="mono" style={{ fontSize: 12, color: "var(--ink-1)" }}>{(workout.distance_km ?? 0).toFixed(1)} km</span>
              <span className="mono" style={{ fontSize: 12, color: "var(--ink-1)" }}>{formatPace(workout.pace)}/km</span>
              <span className="mono" style={{ fontSize: 12, color: "var(--ink-1)" }}>{workout.avgHR?.toFixed(0) ?? "—"} bpm</span>
              <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>{workout.duration_min?.toFixed(0) ?? "—"} min</span>
            </div>
            <div style={{ marginTop: 12 }}>
              <ZoneBar zones={workout.zones} height={10} />
            </div>
          </div>
        ))}
      </div>
    </DetailModalShell>
  );
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function percent(value: number, total: number) {
  return `${((value / Math.max(1, total)) * 100).toFixed(0)}%`;
}

function percentNumber(value: number, total: number) {
  return (value / Math.max(1, total)) * 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeSleepWindowHour(hour: number) {
  return hour < 12 ? hour + 24 : hour;
}

function buildWeekCompareItems(previous: number[], current: number[], dates: Date[]) {
  return current.map((value, index) => ({
    label: formatModelDate(dates[index] ?? new Date(), "dow").replace(/\.$/, ""),
    a: previous[index] ?? 0,
    b: value
  }));
}

function workoutsInRange(model: WorkbenchModel, days: number) {
  const start = model.dates.at(-days) ?? model.dates[0] ?? new Date();
  const startKey = formatModelDate(start, "ymd");
  return model.workouts.filter((workout) => workout.date >= startKey);
}

function formatLedgerValue(value: number, unit: string) {
  if (!Number.isFinite(value)) {
    return unit ? `0 ${unit}` : "0";
  }
  const digits = unit === "" ? 0 : 1;
  return unit ? `${value.toFixed(digits)} ${unit}` : value.toFixed(digits);
}

function describeCorrelation(value: number) {
  const abs = Math.abs(value);
  return {
    strength: abs < 0.15 ? "little" : abs < 0.35 ? "weak" : abs < 0.55 ? "moderate" : "strong",
    direction: value > 0.05 ? "positive" : value < -0.05 ? "negative" : "flat"
  };
}

const mastheadStyle = {
  borderTop: "2px solid var(--ink-1)",
  borderBottom: "1px solid var(--line-strong)",
  padding: "8px 0",
  marginBottom: 28,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap"
} as const;

const heroSplitStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 48,
  marginBottom: 36,
  alignItems: "start"
} as const;

const forecastRowStyle = {
  display: "grid",
  gridTemplateColumns: "70px 40px 1fr 36px",
  alignItems: "center",
  padding: "7px 0",
  borderTop: "1px dotted var(--line)",
  fontSize: 13,
  gap: 12
} as const;

const forecastDayStyle = {
  fontFamily: "var(--mono)",
  fontSize: 11,
  color: "var(--ink-3)",
  letterSpacing: "0.1em",
  textTransform: "uppercase"
} as const;

const threeColumnStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 36,
  marginBottom: 40,
  alignItems: "start"
} as const;

const annotationStripStyle = {
  borderTop: "1px solid var(--line-strong)",
  borderBottom: "1px solid var(--line-strong)",
  padding: "18px 0",
  marginBottom: 36,
  display: "grid",
  gridTemplateColumns: "minmax(140px, 160px) minmax(0, 1fr)",
  gap: 28,
  alignItems: "start"
} as const;

const sectionHeadlineStyle = {
  fontFamily: "var(--serif)",
  fontWeight: 400,
  fontSize: 28,
  lineHeight: 1.05,
  margin: "0 0 10px",
  letterSpacing: "-0.01em"
} as const;

const annotationDateStyle = {
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.08em",
  color: "var(--ink-3)",
  textTransform: "uppercase"
} as const;

const benchmarkRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  padding: "6px 0",
  borderTop: "1px dotted var(--line)",
  fontSize: 12
} as const;

const miniMetricGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
  gap: 12,
  marginTop: 18,
  paddingTop: 18,
  borderTop: "1px solid var(--line)"
} as const;

const sectionBlockStyle = {
  marginTop: 20,
  paddingTop: 18,
  borderTop: "1px solid var(--line)"
} as const;

const instrumentMetricGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 14,
  marginBottom: 16
} as const;

const workoutRowStyle = {
  width: "100%",
  padding: "12px 18px",
  cursor: "pointer",
  borderTop: "1px dotted var(--line)",
  borderInline: "none",
  borderBottom: "none",
  background: "transparent",
  textAlign: "left"
} as const;

const legendRowStyle = {
  display: "flex",
  gap: 14,
  alignItems: "center",
  flexWrap: "wrap",
  marginBottom: 10
} as const;

const legendCardStyle = {
  display: "flex",
  gap: 14,
  alignItems: "center",
  flexWrap: "wrap",
  padding: "10px 14px",
  border: "1px solid var(--line)",
  borderRadius: 999,
  background: "var(--bg-card)"
} as const;

const statusBarStyle = {
  display: "grid",
  gridTemplateColumns: "auto 1fr auto auto",
  gap: 24,
  alignItems: "center",
  padding: "10px 14px",
  background: "var(--bg-card)",
  border: "1px solid var(--line)",
  borderRadius: 4,
  marginBottom: 18,
  fontFamily: "var(--mono)",
  fontSize: 11
} as const;

function statGridStyle(columns: number) {
  return {
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gap: 16,
    marginBottom: 20
  } as const;
}
