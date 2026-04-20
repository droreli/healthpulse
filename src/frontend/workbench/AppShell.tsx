import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import type { WorkbenchPayload } from "../../api/workbench";
import { useHealthData } from "../hooks/useHealthData";
import WorkbenchSidebar from "./Sidebar";
import { buildWorkbenchModel, type Edition, type ThemeMode, type UiRange, type WorkbenchPage } from "./model";
import {
  EditorialCorrelate,
  EditorialDashboard,
  EditorialHeart,
  EditorialSettings,
  EditorialSleep,
  EditorialWeekly,
  EditorialWorkouts,
  InstrumentCorrelate,
  InstrumentDashboard,
  InstrumentHeart,
  InstrumentSettings,
  InstrumentSleep,
  InstrumentWeekly,
  InstrumentWorkouts
} from "./Pages";

const PAGE_ORDER: WorkbenchPage[] = ["dashboard", "sleep", "workouts", "heart", "correlate", "weekly", "settings"];

export default function WorkbenchApp({
  username,
  onLogout
}: {
  username: string;
  onLogout: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data, loading, error, refresh } = useHealthData<WorkbenchPayload>("/api/workbench");
  const [variant, setVariant] = useState<Edition>(() => readStorage("hp_variant", "instrument"));
  const [theme, setTheme] = useState<ThemeMode>(() => readStorage("hp_theme", "light"));
  const [range, setRange] = useState<UiRange>(() => readStorage("hp_range", "30D"));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    localStorage.setItem("hp_variant", variant);
  }, [variant]);

  useEffect(() => {
    localStorage.setItem("hp_theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("hp_range", range);
  }, [range]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey) {
        return;
      }

      const pageNumber = Number(event.key);
      if (pageNumber >= 1 && pageNumber <= PAGE_ORDER.length) {
        event.preventDefault();
        navigate(`/${PAGE_ORDER[pageNumber - 1]}`);
        return;
      }

      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        setVariant((current) => (current === "editorial" ? "instrument" : "editorial"));
        return;
      }

      if (event.key.toLowerCase() === "l") {
        event.preventDefault();
        setTheme((current) => (current === "dark" ? "light" : "dark"));
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [navigate]);

  if (loading) {
    return <div className="workbench-loading">Loading workbench…</div>;
  }

  if (error || !data) {
    return <div className="workbench-loading">Failed to load workbench: {error}</div>;
  }

  const page = normalizePage(location.pathname);
  const model = buildWorkbenchModel(data);

  const mutateAnnotation = async (path: string, init: RequestInit) => {
    setSaving(true);
    try {
      const response = await fetch(path, {
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        ...init
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Request failed: ${response.status}`);
      }
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const pageProps = {
    model,
    range,
    onRangeChange: setRange
  };

  const settingsProps = {
    ...pageProps,
    saving,
    onImported: refresh,
    onCreateAnnotation: (input: { date: string; kind: string; label: string }) => mutateAnnotation("/api/annotations", { method: "POST", body: JSON.stringify(input) }),
    onUpdateAnnotation: (id: number, input: { date: string; kind: string; label: string }) => mutateAnnotation(`/api/annotations/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onDeleteAnnotation: (id: number) => mutateAnnotation(`/api/annotations/${id}`, { method: "DELETE" })
  };

  const settingsElement = variant === "editorial" ? <EditorialSettings {...settingsProps} /> : <InstrumentSettings {...settingsProps} />;

  return (
    <div className="app" data-screen-label={`${variant} / ${page}`}>
      <WorkbenchSidebar
        page={page}
        onNavigate={(nextPage) => navigate(`/${nextPage}`)}
        variant={variant}
        onVariantChange={setVariant}
        theme={theme}
        onThemeChange={setTheme}
        username={username}
        syncLabel={model.syncLabel}
        syncDetail={model.syncDetail}
        onLogout={onLogout}
      />
      <main className="main">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/weekly-review" element={<Navigate to="/weekly" replace />} />
          <Route path="/onboarding" element={settingsElement} />
          <Route path="/dashboard" element={variant === "editorial" ? <EditorialDashboard {...pageProps} /> : <InstrumentDashboard {...pageProps} />} />
          <Route path="/sleep" element={variant === "editorial" ? <EditorialSleep {...pageProps} /> : <InstrumentSleep {...pageProps} />} />
          <Route path="/workouts" element={variant === "editorial" ? <EditorialWorkouts {...pageProps} /> : <InstrumentWorkouts {...pageProps} />} />
          <Route path="/heart" element={variant === "editorial" ? <EditorialHeart {...pageProps} /> : <InstrumentHeart {...pageProps} />} />
          <Route path="/correlate" element={variant === "editorial" ? <EditorialCorrelate {...pageProps} /> : <InstrumentCorrelate {...pageProps} />} />
          <Route path="/weekly" element={variant === "editorial" ? <EditorialWeekly {...pageProps} /> : <InstrumentWeekly {...pageProps} />} />
          <Route path="/settings" element={settingsElement} />
        </Routes>
      </main>
    </div>
  );
}

function readStorage<T extends string>(key: string, fallback: T): T {
  const value = localStorage.getItem(key);
  return typeof value === "string" && value.length > 0 ? (value as T) : fallback;
}

function normalizePage(pathname: string): WorkbenchPage {
  if (pathname.startsWith("/sleep")) {
    return "sleep";
  }
  if (pathname.startsWith("/workouts")) {
    return "workouts";
  }
  if (pathname.startsWith("/heart")) {
    return "heart";
  }
  if (pathname.startsWith("/correlate")) {
    return "correlate";
  }
  if (pathname.startsWith("/weekly")) {
    return "weekly";
  }
  if (pathname.startsWith("/settings") || pathname.startsWith("/onboarding")) {
    return "settings";
  }
  return "dashboard";
}
