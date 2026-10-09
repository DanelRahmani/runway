import { useCallback, useEffect, useRef, useState } from "react";

import { useAutosave, useForecasts, type AutosaveState } from "@/lib/storage/forecasts";
import { validateForecast } from "@/lib/validation";
import type { Forecast } from "@/types/forecast";

export interface ForecastEditor {
  forecast: Forecast | null;
  loading: boolean;
  notFound: boolean;
  saveState: AutosaveState;
  /** Applies a validated change and queues an autosave. */
  update: (updater: (current: Forecast) => Forecast) => void;
  replace: (next: Forecast) => void;
  flush: () => Promise<void>;
  /** Set when a change was rejected before it could reach storage. */
  lastError: string | null;
}

/**
 * Loads one forecast into editable local state and autosaves changes.
 *
 * The draft is kept in a ref as well as state so `update` can read the latest
 * value synchronously without making the caller depend on React's batching.
 *
 * Every write is validated first: an invalid forecast is never persisted, so a
 * corrupted record can never make the dashboard unopenable.
 */
export function useForecastEditor(id: string | undefined): ForecastEditor {
  const { forecasts, loading: listLoading } = useForecasts();
  const stored = id === undefined ? undefined : forecasts.find((item) => item.id === id);

  const [draft, setDraft] = useState<Forecast | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const draftRef = useRef<Forecast | null>(null);
  const loadedIdRef = useRef<string | null>(null);
  const { state: saveState, schedule, flush } = useAutosave();

  useEffect(() => {
    if (stored === undefined) return;
    if (loadedIdRef.current === stored.id) return;
    loadedIdRef.current = stored.id;
    // Strip the storage-only default so the draft matches the domain type.
    const next: Forecast = { ...stored, archived: stored.archived };
    draftRef.current = next;
    setDraft(next);
    setLastError(null);
  }, [stored]);

  const replace = useCallback(
    (next: Forecast) => {
      const result = validateForecast(next);
      if (!result.ok) {
        setLastError("That change was not valid and was not saved.");
        return;
      }
      draftRef.current = result.forecast;
      setDraft(result.forecast);
      setLastError(null);
      schedule(result.forecast);
    },
    [schedule],
  );

  const update = useCallback(
    (updater: (current: Forecast) => Forecast) => {
      const current = draftRef.current;
      if (current === null) return;
      replace(updater(current));
    },
    [replace],
  );

  return {
    forecast: draft,
    loading: listLoading && draft === null,
    notFound: !listLoading && stored === undefined,
    saveState,
    update,
    replace,
    flush,
    lastError,
  };
}
