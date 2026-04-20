import { startTransition, useEffect, useRef, useState } from "react";
import type { AppleImportJobPayload, AppleImportPayload } from "../lib/contracts";

const IMPORT_STATE_KEY = "healthpulse.appleImport.v2";
const listeners = new Set<() => void>();

type ImportViewState = {
  phase: "idle" | "uploading" | "polling" | "completed" | "failed";
  jobId: string | null;
  job: AppleImportJobPayload | null;
  result: AppleImportPayload | null;
  error: string | null;
};

let importState: ImportViewState = loadImportState();

export default function AppleImportPanel({
  onImported
}: {
  onImported?: () => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<ImportViewState>(() => importState);
  const importing = state.phase === "uploading" || state.phase === "polling";

  useEffect(() => {
    const sync = () => setState(importState);
    listeners.add(sync);
    sync();
    return () => {
      listeners.delete(sync);
    };
  }, []);

  const resetImport = () => {
    setImportState({
      phase: "idle",
      jobId: null,
      job: null,
      result: null,
      error: null
    });
  };

  useEffect(() => {
    if (!state.jobId) {
      return;
    }

    let active = true;
    let intervalId = 0;

    const pollJob = async () => {
      try {
        const response = await fetch(`/api/import/apple-health/jobs/${state.jobId}`, { credentials: "same-origin" });
        if (!response.ok) {
          throw new Error(`Import status failed with status ${response.status}`);
        }

        const json = (await response.json()) as AppleImportJobPayload;
        if (!active) {
          return;
        }

        setImportState({
          phase: json.status === "completed" ? "completed" : json.status === "failed" ? "failed" : "polling",
          jobId: json.status === "completed" || json.status === "failed" ? null : json.jobId,
          job: json,
          result: json.result ?? null,
          error: json.error ?? null
        });
        if (json.status === "completed" && json.result) {
          startTransition(() => {
            setImportState({
              phase: "completed",
              jobId: null,
              job: json,
              result: json.result ?? null,
              error: null
            });
          });
          if (onImported) {
            await onImported();
          }
          return;
        }

        if (json.status === "failed") {
          setImportState({
            phase: "failed",
            jobId: null,
            job: json,
            result: null,
            error: json.error ?? "Import failed"
          });
          return;
        }
      } catch (pollError) {
        if (!active) {
          return;
        }
        setImportState({
          phase: "failed",
          jobId: null,
          job: null,
          result: null,
          error: pollError instanceof Error ? pollError.message : "Import status failed"
        });
      }
    };

    void pollJob();
    intervalId = window.setInterval(() => {
      void pollJob();
    }, 2000);

    return () => {
      active = false;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [state.jobId, onImported]);

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setImportState({
      phase: "uploading",
      jobId: null,
      job: null,
      result: null,
      error: null
    });

    try {
      const response = await fetch("/api/import/apple-health", {
        method: "POST",
        body: formData,
        credentials: "same-origin"
      });
      if (!response.ok) {
        throw new Error(`Import failed with status ${response.status}`);
      }

      const json = (await response.json()) as AppleImportJobPayload;
      setImportState({
        phase: "polling",
        jobId: json.jobId,
        job: json,
        result: null,
        error: null
      });
    } catch (uploadError) {
      setImportState({
        phase: "failed",
        jobId: null,
        job: null,
        result: null,
        error: uploadError instanceof Error ? uploadError.message : "Import failed"
      });
    } finally {
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <section className="import-panel">
      <div className="import-panel-head">
        <div>
          <p className="label" style={{ marginBottom: 10 }}>
            Manual import
          </p>
          <h3 className="import-title">Import Apple Health export.zip</h3>
          <p className="import-copy">
            Upload a fresh Apple Health export.zip whenever you want to refresh the workbench. The importer reconciles
            only newly added or recently changed records on top of the existing data.
          </p>
        </div>
        <div className="import-actions">
          {state.phase !== "idle" ? (
            <button type="button" onClick={resetImport} className="btn">
              Reset import
            </button>
          ) : null}
          <input
            ref={inputRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={(event) => void handleChange(event)}
          />
          <button
            type="button"
            disabled={importing}
            onClick={() => inputRef.current?.click()}
            className="btn primary"
          >
            {importing ? "Importing..." : "Choose export.zip"}
          </button>
        </div>
      </div>

      {state.phase === "uploading" ? (
        <div className="import-status">
          <p className="import-status-title">Uploading export.zip…</p>
          <p className="import-status-copy">You can move around the app and come back. HealthPulse will keep this upload session alive and resume the job view once the server acknowledges it.</p>
        </div>
      ) : null}

      {state.job ? (
        <div className="import-status">
          <p className="import-status-title">{jobHeadline(state.job)}</p>
          <p className="import-status-copy">{jobDescription(state.job)}</p>
          {state.job.status !== "failed" ? (
            <p className="import-status-note">
              If this looks stuck after a long time, click Reset import and upload the zip again.
            </p>
          ) : null}
        </div>
      ) : null}

      {state.result ? (
        <div className="import-stats">
          <ImportStat label="Samples" value={String(state.result.samplesIngested)} />
          <ImportStat label="Workouts" value={String(state.result.workoutsIngested)} />
          <ImportStat label="Sleep nights" value={String(state.result.sleepSessionsUpdated)} />
          <ImportStat label="Cutoff" value={state.result.cutoffDate ? state.result.cutoffDate.slice(0, 10) : "Full history"} />
        </div>
      ) : null}

      {state.error ? <p className="import-error">{state.error}</p> : null}
    </section>
  );
}

function loadImportState(): ImportViewState {
  if (typeof window === "undefined") {
    return {
      phase: "idle",
      jobId: null,
      job: null,
      result: null,
      error: null
    };
  }

  try {
    const raw = window.localStorage.getItem(IMPORT_STATE_KEY);
    if (!raw) {
      return {
        phase: "idle",
        jobId: null,
        job: null,
        result: null,
        error: null
      };
    }

    const saved = JSON.parse(raw) as Partial<ImportViewState>;
    return {
      phase: saved.phase ?? (saved.jobId ? "polling" : saved.result ? "completed" : saved.error ? "failed" : "idle"),
      jobId: saved.jobId ?? null,
      job: saved.job ?? null,
      result: saved.result ?? null,
      error: saved.error ?? null
    };
  } catch {
    window.localStorage.removeItem(IMPORT_STATE_KEY);
    return {
      phase: "idle",
      jobId: null,
      job: null,
      result: null,
      error: null
    };
  }
}

function setImportState(next: ImportViewState) {
  importState = next;
  if (typeof window !== "undefined") {
    if (next.phase === "idle") {
      window.localStorage.removeItem(IMPORT_STATE_KEY);
    } else {
      window.localStorage.setItem(IMPORT_STATE_KEY, JSON.stringify(next));
    }
  }
  listeners.forEach((listener) => listener());
}

function jobHeadline(job: AppleImportJobPayload) {
  if (job.status === "running") {
    return "Importing in the background...";
  }

  if (job.status === "completed") {
    return "Import complete";
  }

  if (job.status === "failed") {
    return "Import failed";
  }

  return "Import queued";
}

function jobDescription(job: AppleImportJobPayload) {
  if (job.status === "failed") {
    return `${job.fileName}. The import stopped before completion. Reset the import and upload the zip again.`;
  }

  if (job.status === "completed") {
    return `${job.fileName}. The import finished and the dashboard data is ready.`;
  }

  return `${job.fileName}. Keep this tab open. HealthPulse will refresh when the import completes.`;
}

function ImportStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="import-stat">
      <p className="label">{label}</p>
      <p className="import-stat-value">{value}</p>
    </div>
  );
}
