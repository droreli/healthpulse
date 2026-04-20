import { useDeferredValue, useEffect, useState } from "react";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useHealthData<T>(path: string, refreshMs?: number): FetchState<T> {
  const deferredPath = useDeferredValue(path);
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: true,
    error: null,
    refresh: async () => {}
  });

  useEffect(() => {
    let active = true;
    let intervalId: number | undefined;

    const load = async () => {
      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const response = await fetch(deferredPath, { credentials: "same-origin" });
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const json = (await response.json()) as T;
        if (active) {
          setState((current) => ({
            ...current,
            data: json,
            loading: false,
            error: null
          }));
        }
      } catch (error) {
        if (active) {
          setState((current) => ({
            ...current,
            data: null,
            loading: false,
            error: error instanceof Error ? error.message : "Unknown error"
          }));
        }
      }
    };

    const refresh = async () => {
      await load();
    };
    setState((current) => ({ ...current, refresh }));
    void load();

    if (refreshMs) {
      intervalId = window.setInterval(() => void load(), refreshMs);
    }

    return () => {
      active = false;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [deferredPath, refreshMs]);

  return state;
}
