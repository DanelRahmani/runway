import Dexie, { type Table } from "dexie";

import type { Forecast } from "@/types/forecast";

/**
 * IndexedDB access, with a graceful in-memory fallback.
 *
 * Forecasts are the user's data, so the rule here is: never pretend a write
 * succeeded. If IndexedDB is missing (private mode, hardened browser, blocked
 * storage) `getStorageStatus()` reports it and the UI shows a banner telling the
 * user their work will not survive a reload.
 */

/** Persisted shape. `archived` is normalised to a boolean so it is always indexable. */
export interface StoredForecast extends Forecast {
  archived: boolean;
}

/**
 * One saved version of a forecast.
 *
 * Kept apart from the forecast itself so a version survives the forecast being
 * deleted — which is the accident this exists for. The only way to erase them is
 * "clear all local data", which takes them with it.
 */
export interface ForecastSnapshot {
  id: string;
  forecastId: string;
  /** When it was taken, as an ISO instant. */
  createdAt: string;
  /** Why it was kept, so the list reads as a history rather than a pile. */
  reason: string;
  forecast: StoredForecast;
}

const DATABASE_NAME = "runway";

class RunwayDatabase extends Dexie {
  forecasts!: Table<StoredForecast, string>;
  snapshots!: Table<ForecastSnapshot, string>;

  constructor() {
    super(DATABASE_NAME);
    this.version(1).stores({
      // Only indexed columns are listed; the rest of the object is stored as-is.
      forecasts: "id, name, updatedAt, archived",
    });
    /*
     * Version 2 adds the snapshot table. Dexie migrates in place, so an existing
     * database keeps every forecast and simply gains the new table — an upgrade,
     * not a reset. Both stores are redeclared because a version's declaration is
     * the whole schema for the stores it names.
     */
    this.version(2).stores({
      forecasts: "id, name, updatedAt, archived",
      snapshots: "id, forecastId, createdAt",
    });
  }
}

/** Exposed for tests and for the "clear all data" action. */
export const db = new RunwayDatabase();

export interface StorageStatus {
  available: boolean;
  reason: string | null;
}

let status: StorageStatus = { available: true, reason: null };

/** Probes IndexedDB once and caches the verdict. */
export async function probeStorage(): Promise<StorageStatus> {
  if (!status.available) return status;

  if (typeof indexedDB === "undefined") {
    status = { available: false, reason: "This browser does not allow IndexedDB storage." };
    return status;
  }

  try {
    await db.open();
    status = { available: true, reason: null };
  } catch (error) {
    status = {
      available: false,
      reason:
        error instanceof Error
          ? `Local storage is unavailable (${error.name}).`
          : "Local storage is unavailable.",
    };
  }
  return status;
}

export function getStorageStatus(): StorageStatus {
  return status;
}

/** Normalises a forecast for persistence. */
export function toStoredForecast(forecast: Forecast): StoredForecast {
  return { ...forecast, archived: forecast.archived ?? false };
}

/* ------------------------------------------------------- in-memory fallback */

/**
 * `ponytail:` when IndexedDB is unavailable the app keeps working against a
 * Map for the lifetime of the tab, so the user can still explore and export.
 * The upgrade path is a sessionStorage mirror if anyone needs reload survival.
 */
const memoryStore = new Map<string, StoredForecast>();
const memorySnapshots = new Map<string, ForecastSnapshot>();

export const memoryBackend = {
  all(): StoredForecast[] {
    return [...memoryStore.values()];
  },
  put(forecast: StoredForecast): void {
    memoryStore.set(forecast.id, forecast);
  },
  bulkPut(forecasts: StoredForecast[]): void {
    for (const forecast of forecasts) memoryStore.set(forecast.id, forecast);
  },
  delete(id: string): void {
    memoryStore.delete(id);
  },
  clear(): void {
    memoryStore.clear();
  },
  snapshots(): ForecastSnapshot[] {
    return [...memorySnapshots.values()];
  },
  putSnapshot(snapshot: ForecastSnapshot): void {
    memorySnapshots.set(snapshot.id, snapshot);
  },
  getSnapshot(id: string): ForecastSnapshot | undefined {
    return memorySnapshots.get(id);
  },
  deleteSnapshot(id: string): void {
    memorySnapshots.delete(id);
  },
  clearSnapshots(): void {
    memorySnapshots.clear();
  },
};
