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

const DATABASE_NAME = "runway";

class RunwayDatabase extends Dexie {
  forecasts!: Table<StoredForecast, string>;

  constructor() {
    super(DATABASE_NAME);
    this.version(1).stores({
      // Only indexed columns are listed; the rest of the object is stored as-is.
      forecasts: "id, name, updatedAt, archived",
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
};
