import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  db,
  getStorageStatus,
  memoryBackend,
  probeStorage,
  toStoredForecast,
  type StorageStatus,
  type StoredForecast,
} from "@/lib/storage/db";
import { createId } from "@/lib/utils";
import type { Currency, Forecast, Horizon } from "@/types/forecast";

// Re-exported so UI code can name the persisted shape without importing db.ts.
export type { StorageStatus, StoredForecast };

/**
 * The single source of truth for stored forecasts.
 *
 * Rather than let `useLiveQuery` and a memory fallback diverge, this module owns
 * a small observable cache that both backends feed. Components subscribe with
 * `useForecasts()` and always see the same shape, whether or not IndexedDB is
 * available.
 */

const EMPTY: readonly StoredForecast[] = Object.freeze([]);

let cache: readonly StoredForecast[] = EMPTY;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** Stable snapshot for `useSyncExternalStore`: a new array only when data changed. */
function getSnapshot(): readonly StoredForecast[] {
  return cache;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  for (const listener of listeners) listener();
}

async function readAll(): Promise<StoredForecast[]> {
  if (!getStorageStatus().available) return memoryBackend.all();
  return db.forecasts.toArray();
}

async function reload(): Promise<void> {
  cache = (await readAll()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  emit();
}

/** Loads forecasts once per session; safe to call from every mount. */
export async function ensureLoaded(): Promise<void> {
  await probeStorage();
  if (loadPromise === null) loadPromise = reload();
  await loadPromise;
}

/** Forces a fresh read, e.g. after an import. */
export async function refreshForecasts(): Promise<void> {
  await probeStorage();
  await reload();
}

export function useForecasts(): {
  forecasts: readonly StoredForecast[];
  status: StorageStatus;
  loading: boolean;
} {
  const forecasts = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const status = getStorageStatus();

  useEffect(() => {
    void ensureLoaded();
  }, []);

  return { forecasts, status, loading: forecasts === EMPTY };
}

/** All forecasts including archived ones, newest first. */
export function listForecasts(): readonly StoredForecast[] {
  return cache;
}

export function findForecast(id: string): StoredForecast | undefined {
  return cache.find((forecast) => forecast.id === id);
}

/** Scenarios that were duplicated from the given base forecast. */
export function findScenarios(baseForecastId: string): StoredForecast[] {
  return cache.filter((forecast) => forecast.baseForecastId === baseForecastId);
}

/* ------------------------------------------------------------------ writes */

/** Upsert, then refresh the cache so every subscriber re-renders. */
export async function saveForecast(forecast: Forecast): Promise<StoredForecast> {
  await probeStorage();
  const stored = toStoredForecast({ ...forecast, updatedAt: new Date().toISOString() });

  if (getStorageStatus().available) {
    await db.forecasts.put(stored);
  } else {
    memoryBackend.put(stored);
  }

  await reload();
  return stored;
}

export async function saveForecasts(forecasts: Forecast[]): Promise<void> {
  await probeStorage();
  const stored = forecasts.map(toStoredForecast);

  if (getStorageStatus().available) {
    await db.forecasts.bulkPut(stored);
  } else {
    memoryBackend.bulkPut(stored);
  }
  await reload();
}

export interface CreateForecastInput {
  name: string;
  currency?: Currency;
  startingBalanceCents?: number;
  startDate: string;
  horizon?: Horizon;
  notes?: string;
  baseForecastId?: string;
  scenarioLabel?: string;
}

/** Builds a well-formed forecast from partial input. Used by the form and seeder. */
export function buildForecast(input: CreateForecastInput): Forecast {
  const now = new Date().toISOString();
  return {
    id: createId(),
    name: input.name.trim(),
    currency: input.currency ?? "EUR",
    startingBalanceCents: input.startingBalanceCents ?? 0,
    startDate: input.startDate,
    horizon: input.horizon ?? "THIRTEEN_WEEKS",
    notes: input.notes,
    recurringItems: [],
    oneOffItems: [],
    invoices: [],
    createdAt: now,
    updatedAt: now,
    baseForecastId: input.baseForecastId,
    scenarioLabel: input.scenarioLabel,
    archived: false,
  };
}

export async function createForecast(input: CreateForecastInput): Promise<StoredForecast> {
  return saveForecast(buildForecast(input));
}

/** Deep-copies a forecast under new ids, optionally recording the base and a label. */
export function cloneForecast(
  source: Forecast,
  options: { name?: string; scenarioLabel?: string; linkToBase?: boolean } = {},
): Forecast {
  const now = new Date().toISOString();
  const linkToBase = options.linkToBase ?? false;

  return {
    ...source,
    id: createId(),
    name: options.name ?? `${source.name} (copy)`,
    createdAt: now,
    updatedAt: now,
    baseForecastId: linkToBase ? source.id : source.baseForecastId,
    scenarioLabel: options.scenarioLabel ?? source.scenarioLabel,
    recurringItems: source.recurringItems.map((item) => ({ ...item, id: createId() })),
    oneOffItems: source.oneOffItems.map((item) => ({ ...item, id: createId() })),
    invoices: source.invoices.map((invoice) => ({ ...invoice, id: createId() })),
  };
}

export async function duplicateForecast(id: string): Promise<StoredForecast | null> {
  const source = findForecast(id);
  if (source === undefined) return null;
  return saveForecast(cloneForecast(source, { name: `${source.name} (copy)` }));
}

/** Creates a scenario variant that stays linked to its base forecast. */
export async function createScenario(id: string, label: string): Promise<StoredForecast | null> {
  const source = findForecast(id);
  if (source === undefined) return null;
  return saveForecast(
    cloneForecast(source, { name: label, scenarioLabel: label, linkToBase: true }),
  );
}

export async function renameForecast(id: string, name: string): Promise<void> {
  const forecast = findForecast(id);
  if (forecast === undefined) return;
  await saveForecast({ ...forecast, name: name.trim() });
}

export async function setArchived(id: string, archived: boolean): Promise<void> {
  const forecast = findForecast(id);
  if (forecast === undefined) return;
  await saveForecast({ ...forecast, archived });
}

export async function deleteForecast(id: string): Promise<void> {
  await probeStorage();
  if (getStorageStatus().available) {
    await db.forecasts.delete(id);
  } else {
    memoryBackend.delete(id);
  }
  await reload();
}

export async function clearAllForecasts(): Promise<void> {
  await probeStorage();
  if (getStorageStatus().available) {
    await db.forecasts.clear();
  } else {
    memoryBackend.clear();
  }
  await reload();
}

/** Replaces the entire store. Backs the "replace" import mode. */
export async function replaceAllForecasts(forecasts: Forecast[]): Promise<void> {
  await clearAllForecasts();
  await saveForecasts(forecasts);
}

/* -------------------------------------------------------------------- hook */

export interface AutosaveState {
  status: "idle" | "pending" | "saved" | "error";
  savedAt: string | null;
  error: string | null;
}

/**
 * Debounced autosave for the editor.
 *
 * `schedule` is called on every validated change; the write lands after a short
 * quiet period so dragging a slider does not hammer IndexedDB.
 */
export function useAutosave(delayMs = 600): {
  state: AutosaveState;
  schedule: (forecast: Forecast) => void;
  flush: () => Promise<void>;
} {
  const [state, setState] = useState<AutosaveState>({ status: "idle", savedAt: null, error: null });
  const pendingRef = useRef<Forecast | null>(null);
  const timerRef = useRef<number | null>(null);

  const flush = useCallback(async () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    if (pending === null) return;
    pendingRef.current = null;
    try {
      await saveForecast(pending);
      setState({ status: "saved", savedAt: new Date().toISOString(), error: null });
    } catch (error) {
      setState({
        status: "error",
        savedAt: null,
        error: error instanceof Error ? error.message : "Could not save to local storage.",
      });
    }
  }, []);

  const schedule = useCallback(
    (forecast: Forecast) => {
      pendingRef.current = forecast;
      setState({ status: "pending", savedAt: null, error: null });
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        void flush();
      }, delayMs);
    },
    [delayMs, flush],
  );

  // Never lose the last change to a closed tab.
  useEffect(() => {
    const handleBeforeUnload = (): void => {
      if (pendingRef.current !== null) void flush();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [flush]);

  return { state, schedule, flush };
}
