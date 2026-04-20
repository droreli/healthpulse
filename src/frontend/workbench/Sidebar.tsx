import type { Edition, ThemeMode, WorkbenchPage } from "./model";

const NAV_ITEMS: Array<{ id: WorkbenchPage; label: string; glyph: string }> = [
  { id: "dashboard", label: "Today", glyph: "◐" },
  { id: "sleep", label: "Sleep", glyph: "☾" },
  { id: "workouts", label: "Training", glyph: "↗" },
  { id: "heart", label: "Heart", glyph: "♡" },
  { id: "correlate", label: "Correlate", glyph: "⋈" },
  { id: "weekly", label: "Weekly", glyph: "▤" },
  { id: "settings", label: "Settings", glyph: "·" }
];

export default function WorkbenchSidebar({
  page,
  onNavigate,
  variant,
  onVariantChange,
  theme,
  onThemeChange,
  username,
  syncLabel,
  syncDetail,
  onLogout
}: {
  page: WorkbenchPage;
  onNavigate: (page: WorkbenchPage) => void;
  variant: Edition;
  onVariantChange: (variant: Edition) => void;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  username: string;
  syncLabel: string;
  syncDetail: string;
  onLogout: () => void;
}) {
  const currentPageLabel = NAV_ITEMS.find((item) => item.id === page)?.label ?? "Today";

  return (
    <aside className="sb">
      <div className="sb-mobile-top">
        <div>
          <div className="sb-brand">HEALTHPULSE · v2</div>
          <div className="sb-mobile-title">{currentPageLabel}</div>
        </div>
        <div className="sb-mobile-status">
          <div className="mono">{syncLabel}</div>
          <div>{syncDetail}</div>
        </div>
      </div>

      <div className="sb-mobile-controls">
        <div className="sb-mobile-control-row">
          <button
            type="button"
            className={`sb-mobile-chip ${variant === "editorial" ? "active" : ""}`}
            onClick={() => onVariantChange("editorial")}
          >
            Editorial
          </button>
          <button
            type="button"
            className={`sb-mobile-chip ${variant === "instrument" ? "active" : ""}`}
            onClick={() => onVariantChange("instrument")}
          >
            Instrument
          </button>
        </div>
        <div className="sb-mobile-control-row">
          <button type="button" className={`sb-mobile-chip ${theme === "dark" ? "active" : ""}`} onClick={() => onThemeChange("dark")}>
            Dark
          </button>
          <button type="button" className={`sb-mobile-chip ${theme === "light" ? "active" : ""}`} onClick={() => onThemeChange("light")}>
            Light
          </button>
        </div>
      </div>

      <div className="sb-desktop">
        <div className="sb-scroll">
          <div className="sb-brand">HEALTHPULSE · v2</div>
          <h1 className="sb-title">
            Personal
            <br />
            Health
            <br />
            <em style={{ fontStyle: "italic", color: "var(--ink-2)" }}>Workbench</em>
          </h1>

          <div className="sb-sec">Navigate</div>
          {NAV_ITEMS.map((item, index) => (
            <button key={item.id} type="button" className={`sb-item ${page === item.id ? "active" : ""}`} onClick={() => onNavigate(item.id)}>
              <span className="glyph">{item.glyph}</span>
              <span>{item.label}</span>
              {page === item.id ? (
                <span style={{ marginLeft: "auto", color: "var(--ink-3)", fontFamily: "var(--mono)", fontSize: 10 }}>⌘{index + 1}</span>
              ) : null}
            </button>
          ))}

          <div className="sb-sec" style={{ marginTop: 24 }}>
            Edition
          </div>
          <div style={{ display: "flex", gap: 4, padding: "0 10px" }}>
            <button
              type="button"
              className={`sb-item ${variant === "editorial" ? "active" : ""}`}
              style={toggleStyle}
              onClick={() => onVariantChange("editorial")}
            >
              Editorial
            </button>
            <button
              type="button"
              className={`sb-item ${variant === "instrument" ? "active" : ""}`}
              style={toggleStyle}
              onClick={() => onVariantChange("instrument")}
            >
              Instrument
            </button>
          </div>

          <div className="sb-sec" style={{ marginTop: 14 }}>
            Theme
          </div>
          <div style={{ display: "flex", gap: 4, padding: "0 10px" }}>
            <button type="button" className={`sb-item ${theme === "dark" ? "active" : ""}`} style={toggleStyle} onClick={() => onThemeChange("dark")}>
              Dark
            </button>
            <button type="button" className={`sb-item ${theme === "light" ? "active" : ""}`} style={toggleStyle} onClick={() => onThemeChange("light")}>
              Light
            </button>
          </div>
        </div>

        <div className="sb-footer">
          <div className="tiny" style={{ marginBottom: 6 }}>
            Signed in as
          </div>
          <div className="who">{username}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <span className="dot" style={{ background: "var(--recov)" }} />
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.08em", color: "var(--ink-3)", textTransform: "uppercase" }}>
              {syncLabel}
            </span>
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: "var(--ink-3)" }}>{syncDetail}</div>
          <div style={{ padding: "0 10px 0 4px", marginTop: 14 }}>
            <button type="button" className="btn" style={{ width: "100%", textAlign: "center" }} onClick={onLogout}>
              Sign out
            </button>
          </div>
        </div>
      </div>

      <nav className="sb-mobile-nav" aria-label="Mobile navigation">
        {NAV_ITEMS.map((item) => (
          <button key={item.id} type="button" className={`sb-mobile-nav-item ${page === item.id ? "active" : ""}`} onClick={() => onNavigate(item.id)}>
            <span className="glyph">{item.glyph}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

export function RangePills({
  value,
  onChange
}: {
  value: "7D" | "14D" | "30D" | "90D";
  onChange: (value: "7D" | "14D" | "30D" | "90D") => void;
}) {
  return (
    <div className="ranges">
      {(["7D", "14D", "30D", "90D"] as const).map((option) => (
        <button key={option} type="button" className={value === option ? "on" : ""} onClick={() => onChange(option)}>
          {option}
        </button>
      ))}
    </div>
  );
}

const toggleStyle = {
  flex: 1,
  justifyContent: "center",
  padding: "6px 4px",
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase"
} as const;
