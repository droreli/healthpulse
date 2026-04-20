import { useId, useState } from "react";
import { formatModelDate, formatPace, type WorkoutView } from "./model";

type AnnotationMarker = { dayIdx: number; dot: string };

export function LineChart({
  data,
  baseline,
  dates,
  width = 600,
  height = 180,
  stroke = "currentColor",
  baselineStroke = "rgba(255,255,255,0.3)",
  showAxis = true,
  yTicks = 4,
  pad = { t: 12, r: 12, b: 20, l: 32 },
  annotations = [],
  highlightLast = true,
  area = false,
  showGrid = true,
  tooltipLabel = "Value",
  tooltipValueFormatter = formatChartNumber,
  baselineLabel = "Baseline",
  baselineValueFormatter = tooltipValueFormatter,
  selectedIndex,
  onSelect
}: {
  data: number[];
  baseline?: number[] | null;
  dates: Date[];
  width?: number;
  height?: number;
  stroke?: string;
  baselineStroke?: string;
  showAxis?: boolean;
  yTicks?: number;
  pad?: { t: number; r: number; b: number; l: number };
  annotations?: AnnotationMarker[];
  highlightLast?: boolean;
  area?: boolean;
  showGrid?: boolean;
  tooltipLabel?: string;
  tooltipValueFormatter?: (value: number) => string;
  baselineLabel?: string;
  baselineValueFormatter?: (value: number) => string;
  selectedIndex?: number | null;
  onSelect?: (index: number) => void;
}) {
  const gradientId = useId().replace(/:/g, "");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const w = width;
  const h = height;
  const innerWidth = w - pad.l - pad.r;
  const innerHeight = h - pad.t - pad.b;
  const min = Math.min(...data, ...(baseline ?? []));
  const max = Math.max(...data, ...(baseline ?? []));
  const span = max - min || 1;
  const yPad = span * 0.12;
  const yMin = min - yPad;
  const yMax = max + yPad;
  const yRange = yMax - yMin;
  const step = data.length > 1 ? innerWidth / (data.length - 1) : innerWidth;
  const x = (index: number) => pad.l + index * step;
  const y = (value: number) => pad.t + innerHeight - ((value - yMin) / yRange) * innerHeight;
  const linePath = pathFromSeries(data, x, y);
  const areaPath = `${linePath} L ${x(data.length - 1)} ${pad.t + innerHeight} L ${x(0)} ${pad.t + innerHeight} Z`;
  const baselinePath = baseline ? pathFromSeries(baseline, x, y) : null;
  const ticks = Array.from({ length: yTicks }, (_, index) => yMin + (yRange * index) / Math.max(1, yTicks - 1));
  const labelIndexes = buildLabelIndexes(data.length);
  const hoveredValue = hoveredIndex === null ? null : data[hoveredIndex];
  const hoveredDate = hoveredIndex === null ? null : dates[hoveredIndex];
  const hoveredBaseline = hoveredIndex === null || !baseline ? null : baseline[hoveredIndex];
  const hoveredX = hoveredIndex === null ? null : x(hoveredIndex);
  const tooltipWidth = baseline ? 164 : 146;
  const tooltipHeight = baseline ? 70 : 54;

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      style={{ display: "block", maxWidth: "100%", height: "auto", overflow: "visible" }}
      onMouseLeave={() => setHoveredIndex(null)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {showGrid ? (
        <g className="grid">
          {ticks.map((tick) => (
            <line key={tick} x1={pad.l} x2={w - pad.r} y1={y(tick)} y2={y(tick)} />
          ))}
        </g>
      ) : null}
      {showAxis ? (
        <g>
          {ticks.map((tick) => (
            <text key={tick} x={pad.l - 6} y={y(tick) + 3} textAnchor="end">
              {Number.isInteger(tick) ? tick : tick.toFixed(1)}
            </text>
          ))}
          {labelIndexes.map((index) => (
            <text key={index} x={x(index)} y={h - 6} textAnchor="middle">
              {formatModelDate(dates[index])}
            </text>
          ))}
        </g>
      ) : null}
      {area ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}
      {baselinePath ? (
        <path d={baselinePath} fill="none" stroke={baselineStroke} strokeWidth="1" strokeDasharray="3 3" />
      ) : null}
      <path d={linePath} fill="none" stroke={stroke} strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((_, index) => {
        const leftEdge = index === 0 ? pad.l : x(index) - step / 2;
        const rightEdge = index === data.length - 1 ? w - pad.r : x(index) + step / 2;
        return (
          <rect
            key={`hit-${index}`}
            x={leftEdge}
            y={pad.t}
            width={Math.max(1, rightEdge - leftEdge)}
            height={innerHeight}
            fill="transparent"
            tabIndex={0}
            aria-label={`${tooltipLabel} for ${dates[index].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
            onMouseEnter={() => setHoveredIndex(index)}
            onFocus={() => setHoveredIndex(index)}
            onClick={() => onSelect?.(index)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect?.(index);
              }
            }}
          />
        );
      })}
      {selectedIndex !== null && selectedIndex !== undefined && data[selectedIndex] !== undefined ? (
        <g pointerEvents="none">
          <line x1={x(selectedIndex)} x2={x(selectedIndex)} y1={pad.t} y2={h - pad.b} stroke="var(--line-bright)" strokeDasharray="2 3" />
          <circle cx={x(selectedIndex)} cy={y(data[selectedIndex])} r="3.5" fill={stroke} />
          <circle cx={x(selectedIndex)} cy={y(data[selectedIndex])} r="7" fill="none" stroke={stroke} strokeOpacity="0.35" />
        </g>
      ) : null}
      {highlightLast ? (
        <g>
          <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r="3" fill={stroke} />
          <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r="6" fill="none" stroke={stroke} strokeOpacity="0.3" />
        </g>
      ) : null}
      {hoveredIndex !== null && hoveredValue !== null && hoveredDate ? (
        <g pointerEvents="none">
          <line x1={hoveredX ?? pad.l} x2={hoveredX ?? pad.l} y1={pad.t} y2={h - pad.b} stroke="var(--line-bright)" strokeDasharray="2 3" />
          <circle cx={hoveredX ?? pad.l} cy={y(hoveredValue)} r="3" fill={stroke} />
          <TooltipCard
            x={clamp((hoveredX ?? pad.l) - tooltipWidth / 2, pad.l, w - pad.r - tooltipWidth)}
            y={Math.max(12, y(hoveredValue) - tooltipHeight - 10)}
            width={tooltipWidth}
            height={tooltipHeight}
            lines={[
              hoveredDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
              `${tooltipLabel} ${tooltipValueFormatter(hoveredValue)}`,
              ...(hoveredBaseline !== null ? [`${baselineLabel} ${baselineValueFormatter(hoveredBaseline)}`] : [])
            ]}
          />
        </g>
      ) : null}
      {annotations.map((annotation) => {
        if (annotation.dayIdx < 0 || annotation.dayIdx >= data.length) {
          return null;
        }

        return (
          <g key={`${annotation.dayIdx}-${annotation.dot}`}>
            <line
              x1={x(annotation.dayIdx)}
              x2={x(annotation.dayIdx)}
              y1={pad.t}
              y2={h - pad.b}
              stroke="rgba(255,255,255,0.12)"
              strokeDasharray="2 3"
            />
            <text x={x(annotation.dayIdx)} y={pad.t - 2} textAnchor="middle" fill="var(--ink-2)" fontSize="10">
              {annotation.dot}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function Sparkline({
  data,
  stroke = "currentColor",
  height = 32,
  fill = false,
  showDot = true
}: {
  data: number[];
  stroke?: string;
  height?: number;
  fill?: boolean;
  showDot?: boolean;
}) {
  const width = 200;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const x = (index: number) => (width / Math.max(1, data.length - 1)) * index;
  const y = (value: number) => height - 2 - ((value - min) / span) * (height - 4);
  const linePath = pathFromSeries(data, x, y);
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" style={{ display: "block", maxWidth: "100%" }}>
      {fill ? <path d={areaPath} fill={stroke} opacity="0.12" /> : null}
      <path d={linePath} fill="none" stroke={stroke} strokeWidth="1.2" />
      {showDot ? <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r="2" fill={stroke} /> : null}
    </svg>
  );
}

export function SleepStages({
  stages,
  dates,
  width = 640,
  height = 200,
  selectedIndex,
  onSelect
}: {
  stages: Array<{ total: number; rem: number; deep: number; core: number; awake: number }>;
  dates: Date[];
  width?: number;
  height?: number;
  selectedIndex?: number | null;
  onSelect?: (index: number) => void;
}) {
  const pad = { t: 14, r: 8, b: 22, l: 28 };
  const innerWidth = width - pad.l - pad.r;
  const innerHeight = height - pad.t - pad.b;
  const stageCeiling = Math.max(...stages.map((stage) => stage.deep + stage.core + stage.rem + stage.awake), 1);
  const roundedMax = Math.max(6, Math.ceil((stageCeiling * 1.08) / 3) * 3);
  const barWidth = (innerWidth / stages.length) * 0.68;
  const step = innerWidth / stages.length;
  const y = (value: number) => pad.t + innerHeight - (value / roundedMax) * innerHeight;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const hoveredStage = hoveredIndex === null ? null : stages[hoveredIndex];
  const hoveredDate = hoveredIndex === null ? null : dates[hoveredIndex];
  const hoveredCenterX = hoveredIndex === null ? null : pad.l + hoveredIndex * step + step / 2;
  const tooltipWidth = 156;
  const tooltipHeight = 88;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      style={{ display: "block", maxWidth: "100%", height: "auto", overflow: "visible" }}
      onMouseLeave={() => setHoveredIndex(null)}
    >
      {Array.from({ length: 4 }, (_, index) => (roundedMax / 3) * index).map((tick) => (
        <g key={tick}>
          <line x1={pad.l} x2={width - pad.r} y1={y(tick)} y2={y(tick)} stroke="var(--line)" strokeDasharray="2 4" />
          <text x={pad.l - 6} y={y(tick) + 3} textAnchor="end" className="in-tick" fill="var(--ink-3)" fontSize="9">
            {tick}h
          </text>
        </g>
      ))}
      {stages.map((stage, index) => {
        const centerX = pad.l + index * step + step / 2;
        const x0 = centerX - barWidth / 2;
        let currentY = pad.t + innerHeight;
        const isHovered = hoveredIndex === index || selectedIndex === index;
        const segments = [
          { key: "deep", value: stage.deep, color: "oklch(45% 0.12 265)" },
          { key: "core", value: stage.core, color: "oklch(62% 0.12 265)" },
          { key: "rem", value: stage.rem, color: "oklch(70% 0.13 310)" },
          { key: "awake", value: stage.awake, color: "oklch(68% 0.12 55)" }
        ];
        return (
          <g key={`${stage.total}-${index}`}>
            {segments.map((segment) => {
              const segmentHeight = (segment.value / roundedMax) * innerHeight;
              currentY -= segmentHeight;
              return (
                <rect
                  key={`${segment.key}-${index}`}
                  x={x0}
                  y={currentY}
                  width={barWidth}
                  height={Math.max(0.5, segmentHeight)}
                  fill={segment.color}
                  opacity={isHovered ? 1 : 0.92}
                />
              );
            })}
            <rect
              x={centerX - step / 2}
              y={pad.t}
              width={step}
              height={innerHeight}
              fill="transparent"
              className="sleep-stage-hit"
              tabIndex={0}
              role="button"
              aria-label={`Sleep details for ${dates[index].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
              onMouseEnter={() => setHoveredIndex(index)}
              onFocus={() => setHoveredIndex(index)}
              onClick={() => {
                setHoveredIndex(index);
                onSelect?.(index);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setHoveredIndex(index);
                  onSelect?.(index);
                }
              }}
            />
          </g>
        );
      })}
      {hoveredStage && hoveredDate ? (
        <g pointerEvents="none">
          <line
            x1={hoveredCenterX ?? pad.l}
            x2={hoveredCenterX ?? pad.l}
            y1={pad.t}
            y2={pad.t + innerHeight}
            stroke="var(--line-bright)"
            strokeDasharray="2 3"
          />
          <TooltipCard
            x={clamp((hoveredCenterX ?? pad.l) - tooltipWidth / 2, pad.l, width - pad.r - tooltipWidth)}
            y={Math.max(12, y(hoveredStage.total) - tooltipHeight - 8)}
            width={tooltipWidth}
            height={tooltipHeight}
            lines={[
              hoveredDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
              `Total ${hoveredStage.total.toFixed(1)}h`,
              `Deep ${hoveredStage.deep.toFixed(1)}h · REM ${hoveredStage.rem.toFixed(1)}h`,
              `Core ${hoveredStage.core.toFixed(1)}h · Awake ${hoveredStage.awake.toFixed(1)}h`
            ]}
          />
        </g>
      ) : null}
      {stages.map((_, index) => {
        if (index % Math.ceil(stages.length / 8) !== 0 && index !== stages.length - 1) {
          return null;
        }
        const centerX = pad.l + index * step + step / 2;
        return (
          <text key={index} x={centerX} y={height - 6} textAnchor="middle" fontSize="9" fill="var(--ink-3)">
            {formatModelDate(dates[index])}
          </text>
        );
      })}
    </svg>
  );
}

export function ZoneBar({ zones, height = 22 }: { zones: number[]; height?: number }) {
  return (
    <div style={{ display: "flex", height, borderRadius: 3, overflow: "hidden" }}>
      {zones.map((zone, index) =>
        zone > 0 ? <div key={`${zone}-${index}`} className={`zone-${index + 1}`} style={{ flex: zone, minWidth: 1 }} /> : null
      )}
    </div>
  );
}

export function Ring({
  value,
  max = 100,
  size = 120,
  thickness = 6,
  color = "var(--recov)",
  label,
  sub
}: {
  value: number;
  max?: number;
  size?: number;
  thickness?: number;
  color?: string;
  label?: string | number;
  sub?: string;
}) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / max) * circumference;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--bg-3)" strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div>
          <div style={{ fontFamily: "var(--serif)", fontSize: size * 0.34, lineHeight: 1, color: "var(--ink-0)" }}>{label ?? value}</div>
          {sub ? (
            <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.12em", color: "var(--ink-3)", textTransform: "uppercase", marginTop: 4 }}>
              {sub}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function Scatter({
  pairs,
  width = 360,
  height = 240,
  color = "var(--sleep)",
  xLabel = "x",
  yLabel = "y",
  pointLabels,
  xFormatter = formatChartNumber,
  yFormatter = formatChartNumber
}: {
  pairs: Array<[number, number]>;
  width?: number;
  height?: number;
  color?: string;
  xLabel?: string;
  yLabel?: string;
  pointLabels?: string[];
  xFormatter?: (value: number) => string;
  yFormatter?: (value: number) => string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  if (pairs.length === 0) {
    return <div className="tiny">Not enough data to draw a relationship yet.</div>;
  }

  const pad = { t: 12, r: 12, b: 28, l: 36 };
  const innerWidth = width - pad.l - pad.r;
  const innerHeight = height - pad.t - pad.b;
  const xs = pairs.map((pair) => pair[0]);
  const ys = pairs.map((pair) => pair[1]);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xPad = (xMax - xMin) * 0.1 || 1;
  const yPad = (yMax - yMin) * 0.1 || 1;
  const x = (value: number) => pad.l + ((value - xMin + xPad) / (xMax - xMin + 2 * xPad)) * innerWidth;
  const y = (value: number) => pad.t + innerHeight - ((value - yMin + yPad) / (yMax - yMin + 2 * yPad)) * innerHeight;

  const meanX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < xs.length; index += 1) {
    numerator += (xs[index] - meanX) * (ys[index] - meanY);
    denominator += (xs[index] - meanX) ** 2;
  }
  const slope = denominator ? numerator / denominator : 0;
  const intercept = meanY - slope * meanX;
  const hoveredPair = hoveredIndex === null ? null : pairs[hoveredIndex];
  const hoveredX = hoveredPair ? x(hoveredPair[0]) : null;
  const hoveredY = hoveredPair ? y(hoveredPair[1]) : null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      style={{ display: "block", maxWidth: "100%", height: "auto", overflow: "visible" }}
      onMouseLeave={() => setHoveredIndex(null)}
    >
      <line x1={pad.l} y1={pad.t + innerHeight} x2={width - pad.r} y2={pad.t + innerHeight} stroke="var(--line)" />
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + innerHeight} stroke="var(--line)" />
      <line
        x1={x(xMin - xPad)}
        y1={y(slope * (xMin - xPad) + intercept)}
        x2={x(xMax + xPad)}
        y2={y(slope * (xMax + xPad) + intercept)}
        stroke={color}
        strokeOpacity="0.5"
        strokeDasharray="3 3"
      />
      {pairs.map((pair, index) => (
        <g key={`${pair[0]}-${pair[1]}-${index}`}>
          <circle cx={x(pair[0])} cy={y(pair[1])} r="2.5" fill={color} fillOpacity={hoveredIndex === index ? "0.95" : "0.55"} />
          <circle
            cx={x(pair[0])}
            cy={y(pair[1])}
            r="10"
            fill="transparent"
            tabIndex={0}
            aria-label={pointLabels?.[index] ?? `Point ${index + 1}`}
            onMouseEnter={() => setHoveredIndex(index)}
            onFocus={() => setHoveredIndex(index)}
          />
        </g>
      ))}
      {hoveredPair && hoveredX !== null && hoveredY !== null ? (
        <g pointerEvents="none">
          <circle cx={hoveredX} cy={hoveredY} r="4" fill={color} />
          <TooltipCard
            x={clamp(hoveredX + 10, pad.l, width - pad.r - 150)}
            y={clamp(hoveredY - 54, pad.t, height - pad.b - 54)}
            width={150}
            height={54}
            lines={[
              pointLabels?.[hoveredIndex ?? 0] ?? `Observation ${String((hoveredIndex ?? 0) + 1).padStart(2, "0")}`,
              `${xLabel} ${xFormatter(hoveredPair[0])}`,
              `${yLabel} ${yFormatter(hoveredPair[1])}`
            ]}
          />
        </g>
      ) : null}
      <text x={width - pad.r} y={pad.t + innerHeight + 18} textAnchor="end" fill="var(--ink-3)" fontSize="9">
        {xLabel}
      </text>
      <text x={pad.l} y={pad.t - 4} textAnchor="start" fill="var(--ink-3)" fontSize="9">
        {yLabel}
      </text>
    </svg>
  );
}

export function HeatCalendar({
  values,
  width = 560,
  color = "var(--train)",
  dates,
  valueFormatter = (value) => `${value.toFixed(0)} min`,
  selectedIndex,
  onSelect
}: {
  values: number[];
  width?: number;
  color?: string;
  dates?: Date[];
  valueFormatter?: (value: number) => string;
  selectedIndex?: number | null;
  onSelect?: (index: number) => void;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const weeks = Math.ceil(values.length / 7);
  const cell = Math.max(10, Math.floor((width - 40) / weeks));
  const max = Math.max(...values) || 1;
  const tooltipWidth = 126;
  const tooltipHeight = 38;

  return (
    <svg
      viewBox={`0 0 ${width} ${cell * 7 + 20}`}
      width="100%"
      height={cell * 7 + 20}
      style={{ display: "block", maxWidth: "100%", height: "auto", overflow: "visible" }}
      onMouseLeave={() => setHoveredIndex(null)}
    >
      {values.map((value, index) => {
        const column = Math.floor(index / 7);
        const row = index % 7;
        const intensity = value / max;
        return (
          <g key={`${value}-${index}`}>
            <rect
              x={30 + column * cell}
              y={row * cell}
              width={cell - 2}
              height={cell - 2}
              fill={color}
              fillOpacity={intensity * 0.9 + (value > 0 ? 0.08 : 0.04)}
              rx="1"
              stroke={selectedIndex === index ? "var(--ink-1)" : "transparent"}
              strokeWidth={selectedIndex === index ? "1" : "0"}
            />
            <rect
              x={30 + column * cell}
              y={row * cell}
              width={cell - 2}
              height={cell - 2}
              fill="transparent"
              style={{ cursor: value > 0 ? "pointer" : "default" }}
              tabIndex={0}
              aria-label={dates?.[index]?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) ?? `Cell ${index + 1}`}
              onMouseEnter={() => setHoveredIndex(index)}
              onFocus={() => setHoveredIndex(index)}
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
      {hoveredIndex !== null ? (
        <TooltipCard
          x={clamp(30 + Math.floor(hoveredIndex / 7) * cell + cell + 6, 30, width - tooltipWidth)}
          y={clamp((hoveredIndex % 7) * cell - 4, 0, cell * 7 + 20 - tooltipHeight)}
          width={tooltipWidth}
          height={tooltipHeight}
          lines={[
            dates?.[hoveredIndex]?.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) ?? `Day ${hoveredIndex + 1}`,
            valueFormatter(values[hoveredIndex] ?? 0)
          ]}
        />
      ) : null}
      {["M", "T", "W", "T", "F", "S", "S"].map((label, index) => (
        <text key={label + index} x={22} y={index * cell + cell / 2 + 3} textAnchor="end" fill="var(--ink-3)" fontSize="8">
          {label}
        </text>
      ))}
    </svg>
  );
}

export function CompareBars({
  items,
  width = 340,
  height = 180,
  color = "var(--ink-1)",
  aLabel = "Prior",
  bLabel = "Current",
  valueFormatter = formatChartNumber
}: {
  items: Array<{ label: string; a: number; b: number }>;
  width?: number;
  height?: number;
  color?: string;
  aLabel?: string;
  bLabel?: string;
  valueFormatter?: (value: number) => string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const pad = { t: 10, r: 8, b: 24, l: 8 };
  const innerWidth = width - pad.l - pad.r;
  const innerHeight = height - pad.t - pad.b;
  const max = Math.max(...items.map((item) => Math.max(item.a, item.b)), 1);
  const step = innerWidth / items.length;
  const barWidth = step * 0.32;
  const hovered = hoveredIndex === null ? null : items[hoveredIndex];
  const tooltipWidth = 148;
  const tooltipHeight = 54;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      style={{ display: "block", maxWidth: "100%", height: "auto", overflow: "visible" }}
      onMouseLeave={() => setHoveredIndex(null)}
    >
      {items.map((item, index) => {
        const centerX = pad.l + index * step + step / 2;
        const heightA = (item.a / max) * innerHeight;
        const heightB = (item.b / max) * innerHeight;
        return (
          <g key={item.label}>
            <rect x={centerX - barWidth - 1} y={pad.t + innerHeight - heightA} width={barWidth} height={heightA} fill="var(--ink-3)" opacity="0.5" />
            <rect x={centerX + 1} y={pad.t + innerHeight - heightB} width={barWidth} height={heightB} fill={color} />
            <rect
              x={centerX - step / 2}
              y={pad.t}
              width={step}
              height={innerHeight}
              fill="transparent"
              tabIndex={0}
              aria-label={`${item.label} comparison`}
              onMouseEnter={() => setHoveredIndex(index)}
              onFocus={() => setHoveredIndex(index)}
            />
            <text x={centerX} y={height - 10} textAnchor="middle" fontSize="9" fill="var(--ink-3)">
              {item.label}
            </text>
          </g>
        );
      })}
      {hovered && hoveredIndex !== null ? (
        <TooltipCard
          x={clamp(pad.l + hoveredIndex * step + step / 2 - tooltipWidth / 2, pad.l, width - pad.r - tooltipWidth)}
          y={pad.t + 8}
          width={tooltipWidth}
          height={tooltipHeight}
          lines={[
            hovered.label,
            `${aLabel} ${valueFormatter(hovered.a)}`,
            `${bLabel} ${valueFormatter(hovered.b)}`
          ]}
        />
      ) : null}
    </svg>
  );
}

export function CorrMatrix({
  labels,
  matrix,
  size = 44
}: {
  labels: string[];
  matrix: number[][];
  size?: number;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `80px repeat(${labels.length}, ${size}px)`, gap: 2, fontFamily: "var(--mono)", fontSize: 10 }}>
      <div />
      {labels.map((label) => (
        <div key={label} style={{ textAlign: "center", color: "var(--ink-3)", padding: "4px 0", letterSpacing: "0.04em" }}>
          {label}
        </div>
      ))}
      {matrix.map((row, rowIndex) => (
        <FragmentRow key={`${labels[rowIndex]}-row`}>
          <div style={{ color: "var(--ink-2)", padding: "4px 6px", textAlign: "right", alignSelf: "center" }}>{labels[rowIndex]}</div>
          {row.map((value, columnIndex) => {
            const abs = Math.abs(value);
            const background =
              value > 0 ? `oklch(55% ${abs * 0.15} 150 / ${abs * 0.9})` : `oklch(55% ${abs * 0.15} 22 / ${abs * 0.9})`;
            return (
              <div
                key={`${labels[rowIndex]}-${labels[columnIndex]}`}
                style={{
                  background: rowIndex === columnIndex ? "var(--bg-3)" : background,
                  width: size,
                  height: size,
                  display: "grid",
                  placeItems: "center",
                  color: abs > 0.4 ? "var(--ink-0)" : "var(--ink-2)",
                  borderRadius: 2
                }}
              >
                {rowIndex === columnIndex ? "—" : value.toFixed(2)}
              </div>
            );
          })}
        </FragmentRow>
      ))}
    </div>
  );
}

export function RouteMap({ seed = 1, color = "var(--train)", width = 520, height = 200 }: { seed?: number; color?: string; width?: number; height?: number }) {
  const points: Array<[number, number]> = [];
  let x = 30;
  let y = height / 2;
  const random = seeded(seed);
  for (let index = 0; index < 40; index += 1) {
    x += (width - 60) / 40;
    y += (random() - 0.5) * 20;
    y = Math.max(30, Math.min(height - 30, y));
    points.push([x, y]);
  }
  const routePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point[0].toFixed(1)} ${point[1].toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: "block" }}>
      <rect x="0" y="0" width={width} height={height} fill="var(--bg-2)" />
      {Array.from({ length: 10 }, (_, index) => (
        <line key={`v-${index}`} x1={(index * width) / 10} x2={(index * width) / 10} y1="0" y2={height} stroke="rgba(255,255,255,0.03)" />
      ))}
      {Array.from({ length: 6 }, (_, index) => (
        <line key={`h-${index}`} x1="0" x2={width} y1={(index * height) / 6} y2={(index * height) / 6} stroke="rgba(255,255,255,0.03)" />
      ))}
      <path d={routePath} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx={points[0][0]} cy={points[0][1]} r="4" fill="var(--ink-1)" />
      <circle cx={points.at(-1)?.[0] ?? 0} cy={points.at(-1)?.[1] ?? 0} r="4" fill={color} />
    </svg>
  );
}

export function WorkoutSessionChart({
  workout,
  width = 720,
  height = 200,
  color = "var(--train)"
}: {
  workout: WorkoutView;
  width?: number;
  height?: number;
  color?: string;
}) {
  const heartPoints = workout.heartRateData
    .map((point) => {
      const value = point.Avg ?? point.Max ?? point.Min;
      const timestamp = new Date(point.date);
      return Number.isFinite(value) && !Number.isNaN(timestamp.getTime()) ? { time: timestamp, value: Number(value) } : null;
    })
    .filter((point): point is { time: Date; value: number } => point !== null)
    .sort((left, right) => left.time.getTime() - right.time.getTime());

  if (heartPoints.length >= 2) {
    return (
      <SessionLineChart
        width={width}
        height={height}
        color={color}
        xLabel="Elapsed min"
        yLabel="Heart rate (bpm)"
        points={heartPoints.map((point) => ({
          x: (point.time.getTime() - heartPoints[0].time.getTime()) / 60000,
          y: point.value
        }))}
        xTickFormatter={(value) => `${Math.round(value)}`}
        yTickFormatter={(value) => `${Math.round(value)}`}
        xTooltipFormatter={(value) => `${value.toFixed(1)} min`}
        yTooltipFormatter={(value) => `${Math.round(value)} bpm`}
      />
    );
  }

  if (workout.splits.length >= 1) {
    return (
      <SessionLineChart
        width={width}
        height={height}
        color={color}
        xLabel="Kilometre split"
        yLabel="Pace (/km)"
        points={workout.splits.map((split) => ({ x: split.index, y: split.pace }))}
        xTickFormatter={(value) => `KM ${Math.round(value)}`}
        yTickFormatter={(value) => formatPace(value)}
        xTooltipFormatter={(value) => `KM ${Math.round(value)}`}
        yTooltipFormatter={(value) => `${formatPace(value)}/km`}
      />
    );
  }

  return (
    <div style={{ minHeight: height, display: "grid", placeItems: "center", color: "var(--ink-2)", fontSize: 13 }}>
      No recorded time-series samples for this workout.
    </div>
  );
}

export function PaceSplits({
  splits,
  color = "var(--train)"
}: {
  splits: Array<{ index: number; pace: number; hr: number | null }>;
  color?: string;
}) {
  if (splits.length === 0) {
    return <div className="tiny">No per-km split data available.</div>;
  }

  const max = Math.max(...splits.map((split) => split.pace));
  const min = Math.min(...splits.map((split) => split.pace));
  return (
    <div>
      {splits.map((split) => {
        const width = ((max - split.pace) / (max - min || 1)) * 70 + 20;
        return (
          <div
            key={split.index}
            style={{
              display: "grid",
              gridTemplateColumns: "28px 1fr 60px 48px",
              alignItems: "center",
              gap: 12,
              padding: "6px 0",
              borderBottom: split.index === splits.length ? "none" : "1px solid var(--line)"
            }}
          >
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)" }}>KM {split.index}</span>
            <div style={{ background: color, opacity: 0.3, height: 8, borderRadius: 2, width: `${width}%` }} />
            <span className="mono num" style={{ fontSize: 12, color: "var(--ink-1)" }}>
              {formatPace(split.pace)}/km
            </span>
            <span className="mono num" style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "right" }}>
              {split.hr ?? "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function pathFromSeries(data: number[], x: (index: number) => number, y: (value: number) => number) {
  return data.map((value, index) => `${index === 0 ? "M" : "L"} ${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join(" ");
}

function SessionLineChart({
  points,
  width,
  height,
  color,
  xLabel,
  yLabel,
  xTickFormatter,
  yTickFormatter,
  xTooltipFormatter = xTickFormatter,
  yTooltipFormatter = yTickFormatter
}: {
  points: Array<{ x: number; y: number }>;
  width: number;
  height: number;
  color: string;
  xLabel: string;
  yLabel: string;
  xTickFormatter: (value: number) => string;
  yTickFormatter: (value: number) => string;
  xTooltipFormatter?: (value: number) => string;
  yTooltipFormatter?: (value: number) => string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const pad = { t: 16, r: 18, b: 34, l: 54 };
  const innerWidth = width - pad.l - pad.r;
  const innerHeight = height - pad.t - pad.b;
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const yPad = spanY * 0.12 || 1;
  const x = (value: number) => pad.l + ((value - minX) / spanX) * innerWidth;
  const y = (value: number) => pad.t + innerHeight - ((value - (minY - yPad)) / (spanY + yPad * 2)) * innerHeight;
  const yTicks = Array.from({ length: 4 }, (_, index) => minY - yPad + ((spanY + yPad * 2) * index) / 3);
  const xTicks = Array.from({ length: Math.min(5, points.length) }, (_, index) => minX + (spanX * index) / Math.max(1, Math.min(5, points.length) - 1));
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.x).toFixed(1)} ${y(point.y).toFixed(1)}`).join(" ");
  const tooltipWidth = 156;
  const tooltipHeight = 54;
  const hoveredPoint = hoveredIndex === null ? null : points[hoveredIndex];
  const hoveredX = hoveredPoint ? x(hoveredPoint.x) : null;
  const hoveredY = hoveredPoint ? y(hoveredPoint.y) : null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      style={{ display: "block", maxWidth: "100%", height: "auto", overflow: "visible" }}
      onMouseLeave={() => setHoveredIndex(null)}
    >
      <g>
        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line x1={pad.l} x2={width - pad.r} y1={y(tick)} y2={y(tick)} stroke="var(--line)" strokeDasharray="2 4" />
            <text x={pad.l - 8} y={y(tick) + 3} textAnchor="end" fill="var(--ink-3)" fontFamily="var(--mono)" fontSize="9">
              {yTickFormatter(tick)}
            </text>
          </g>
        ))}
        {xTicks.map((tick) => (
          <g key={`x-${tick}`}>
            <line x1={x(tick)} x2={x(tick)} y1={pad.t} y2={pad.t + innerHeight} stroke="rgba(255,255,255,0.03)" />
            <text x={x(tick)} y={height - 8} textAnchor="middle" fill="var(--ink-3)" fontFamily="var(--mono)" fontSize="9">
              {xTickFormatter(tick)}
            </text>
          </g>
        ))}
      </g>
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point, index) => {
        const currentX = x(point.x);
        const previousX = index === 0 ? pad.l : x(points[index - 1].x);
        const nextX = index === points.length - 1 ? width - pad.r : x(points[index + 1].x);
        const leftEdge = index === 0 ? pad.l : (previousX + currentX) / 2;
        const rightEdge = index === points.length - 1 ? width - pad.r : (currentX + nextX) / 2;
        return (
          <rect
            key={`session-hit-${index}`}
            x={leftEdge}
            y={pad.t}
            width={Math.max(1, rightEdge - leftEdge)}
            height={innerHeight}
            fill="transparent"
            tabIndex={0}
            aria-label={`${xLabel} ${xTooltipFormatter(point.x)}, ${yLabel} ${yTooltipFormatter(point.y)}`}
            onMouseEnter={() => setHoveredIndex(index)}
            onFocus={() => setHoveredIndex(index)}
          />
        );
      })}
      <circle cx={x(points[0].x)} cy={y(points[0].y)} r="4.5" fill="var(--ink-1)" />
      <circle cx={x(points.at(-1)?.x ?? 0)} cy={y(points.at(-1)?.y ?? 0)} r="4.5" fill={color} />
      {hoveredPoint && hoveredX !== null && hoveredY !== null ? (
        <g pointerEvents="none">
          <line x1={hoveredX} x2={hoveredX} y1={pad.t} y2={pad.t + innerHeight} stroke="var(--line-bright)" strokeDasharray="2 3" />
          <circle cx={hoveredX} cy={hoveredY} r="4" fill={color} />
          <TooltipCard
            x={clamp(hoveredX + 10, pad.l, width - pad.r - tooltipWidth)}
            y={clamp(hoveredY - tooltipHeight - 10, pad.t, height - pad.b - tooltipHeight)}
            width={tooltipWidth}
            height={tooltipHeight}
            lines={[
              `${xLabel} ${xTooltipFormatter(hoveredPoint.x)}`,
              `${yLabel} ${yTooltipFormatter(hoveredPoint.y)}`
            ]}
          />
        </g>
      ) : null}
      <text x={width - pad.r} y={18} textAnchor="end" fill="var(--ink-3)" fontFamily="var(--mono)" fontSize="10" letterSpacing="0.08em">
        {xLabel}
      </text>
      <text x={pad.l} y={18} textAnchor="start" fill="var(--ink-3)" fontFamily="var(--mono)" fontSize="10" letterSpacing="0.08em">
        {yLabel}
      </text>
    </svg>
  );
}

function buildLabelIndexes(length: number) {
  const labels: number[] = [];
  const step = Math.max(1, Math.floor(length / 6));
  for (let index = 0; index < length; index += step) {
    labels.push(index);
  }
  if (labels.at(-1) !== length - 1) {
    labels.push(length - 1);
  }
  return labels;
}

function formatChartNumber(value: number) {
  if (!Number.isFinite(value)) {
    return "—";
  }
  if (Math.abs(value) >= 100 || Number.isInteger(value)) {
    return value.toFixed(0);
  }
  return value.toFixed(1);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function TooltipCard({
  x,
  y,
  width,
  height,
  lines
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  lines: string[];
}) {
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx="6" fill="var(--bg-0)" stroke="var(--line-bright)" />
      {lines.map((line, index) => (
        <text
          key={`${line}-${index}`}
          x={x + 10}
          y={y + 16 + index * 16}
          textAnchor="start"
          fill={index === 0 ? "var(--ink-0)" : "var(--ink-2)"}
          fontFamily="var(--mono)"
          fontSize={index === 0 ? "10" : "9"}
          letterSpacing={index === 0 ? "0.06em" : "0.01em"}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

function seeded(seed: number) {
  let state = (seed * 2654435761) % 2 ** 32;
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32;
  };
}

function FragmentRow({ children }: React.PropsWithChildren) {
  return <>{children}</>;
}
