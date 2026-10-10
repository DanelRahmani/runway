import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  db,
  getStorageStatus,
  memoryBackend,
  probeStorage,
  toStoredForecast,
  type ForecastSnapshot,
  type StorageStatus,
  type StoredForecast,
} from "@/lib/storage/db";
import { createId } from "@/lib/utils";
import type { Currency, Forecast, ForecastKind, Horizon } from "@/types/forecast";

// Re-exported so UI code can name the persisted shapes without importing db.ts.
export type { ForecastSnapshot, StorageStatus, StoredForecast };

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
  forecastKind?: ForecastKind;
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
    forecastKind: input.forecastKind,
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

  /*
   * Deleting is the one action with no other way back, and the confirm dialog is a
   * single click, so the copy is kept here rather than resting on that click. The
   * snapshot outlives the forecast on purpose — that is the whole point — which is
   * why the dialog now says the delete can be undone rather than that it is
   * permanent. "Clear all local data" is the action that erases for real, and it
   * takes the snapshots with it.
   */
  const existing = findForecast(id);
  if (existing !== undefined) await recordSnapshot(existing, "Before deleting");

  if (getStorageStatus().available) {
    await db.forecasts.delete(id);
  } else {
    memoryBackend.delete(id);
  }
  await reload();
}

/**
 * Erases everything, snapshots included.
 *
 * The snapshots are not a separate courtesy here: a user who asks for their data to
 * be gone is entitled to have it gone, and leaving restorable copies behind would
 * quietly contradict that.
 */
export async function clearAllForecasts(): Promise<void> {
  await probeStorage();
  if (getStorageStatus().available) {
    await db.forecasts.clear();
    await db.snapshots.clear();
  } else {
    memoryBackend.clear();
    memoryBackend.clearSnapshots();
  }
  await reload();
}

/** Replaces the entire store. Backs the "replace" import mode. */
export async function replaceAllForecasts(forecasts: Forecast[]): Promise<void> {
  await probeStorage();

  // An import in replace mode wipes what is there. The user chose the mode, but not
  // necessarily with the current contents in mind.
  for (const existing of listForecasts()) {
    await recordSnapshot(existing, "Before an import replaced everything");
  }

  await clearAllForecasts();
  await saveForecasts(forecasts);
}

/* --------------------------------------------------------------- snapshots */

/** How many versions of one forecast are kept before the oldest is dropped. */
export const SNAPSHOTS_PER_FORECAST = 20;

/** A long reason stops being a reason and starts being a paragraph. */
const SNAPSHOT_REASON_MAX = 80;

async function readSnapshots(forecastId: string): Promise<ForecastSnapshot[]> {
  if (!getStorageStatus().available) {
    return memoryBackend.snapshots().filter((snapshot) => snapshot.forecastId === forecastId);
  }
  return db.snapshots.where("forecastId").equals(forecastId).toArray();
}

/**
 * Keeps a copy of a forecast as it stands.
 *
 * Deliberately not called on every autosave. A history that grows while you type is
 * noise, and what is worth recovering from is a decision rather than a keystroke —
 * so this runs before anything irreversible, and when the user asks for it.
 */
export async function recordSnapshot(forecast: Forecast, reason: string): Promise<void> {
  await probeStorage();

  const snapshot: ForecastSnapshot = {
    id: createId(),
    forecastId: forecast.id,
    createdAt: new Date().toISOString(),
    reason: reason.slice(0, SNAPSHOT_REASON_MAX),
    forecast: toStoredForecast(forecast),
  };

  if (getStorageStatus().available) await db.snapshots.put(snapshot);
  else memoryBackend.putSnapshot(snapshot);

  await pruneSnapshots(forecast.id);
}

/** Newest first. */
export async function listSnapshots(forecastId: string): Promise<ForecastSnapshot[]> {
  await probeStorage();
  const snapshots = await readSnapshots(forecastId);
  return snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Every snapshot, newest first — how a deleted forecast is found again. */
export async function listAllSnapshots(): Promise<ForecastSnapshot[]> {
  await probeStorage();
  const snapshots = getStorageStatus().available
    ? await db.snapshots.toArray()
    : memoryBackend.snapshots();
  return snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Puts a snapshot back.
 *
 * Restoring is itself reversible: the state being replaced is snapshotted first, so
 * a mis-clicked restore does not become the mistake it was meant to undo.
 */
export async function restoreSnapshot(snapshotId: string): Promise<StoredForecast | null> {
  await probeStorage();

  const snapshot = getStorageStatus().available
    ? await db.snapshots.get(snapshotId)
    : memoryBackend.getSnapshot(snapshotId);
  if (snapshot === undefined) return null;

  const current = findForecast(snapshot.forecastId);
  if (current !== undefined) {
    await recordSnapshot(current, "Before restoring an earlier version");
  }

  // The id is the snapshot's own forecast id, so restoring a deleted forecast
  // brings it back under the id its scenarios still point at.
  return saveForecast({ ...snapshot.forecast, id: snapshot.forecastId });
}

export async function forgetSnapshot(snapshotId: string): Promise<void> {
  await probeStorage();
  if (getStorageStatus().available) await db.snapshots.delete(snapshotId);
  else memoryBackend.deleteSnapshot(snapshotId);
}

/** Keeps the newest few versions and drops the rest. */
async function pruneSnapshots(forecastId: string): Promise<void> {
  const existing = (await readSnapshots(forecastId)).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const excess = existing.slice(SNAPSHOTS_PER_FORECAST);
  if (excess.length === 0) return;

  if (getStorageStatus().available) {
    await db.snapshots.bulkDelete(excess.map((snapshot) => snapshot.id));
  } else {
    for (const snapshot of excess) memoryBackend.deleteSnapshot(snapshot.id);
  }
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
