import { downloadFile, periodsToCsv } from "@/lib/csv";
import { todayIso } from "@/lib/dates";
import { createId, slugify } from "@/lib/utils";
import { BACKUP_SCHEMA_VERSION, backupFileSchema, type BackupFile } from "@/lib/validation";
import type { Forecast, Granularity, ProjectionPeriod } from "@/types/forecast";

/**
 * JSON backup and restore.
 *
 * A file is validated in full before anything is written, so an import either
 * applies completely or is refused with the reason. Within a valid file, id or
 * name collisions are resolved by assigning a new id or suffix and reporting it,
 * never by overwriting the user's existing forecasts.
 */

export { BACKUP_SCHEMA_VERSION };
export type { BackupFile };

export function buildBackup(forecasts: readonly Forecast[]): BackupFile {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: "runway",
    forecasts: forecasts.map((forecast) => structuredClone(forecast)),
  };
}

export function serializeBackup(backup: BackupFile): string {
  // Validate on the way out too: a corrupt export is worse than a failed one.
  return JSON.stringify(backupFileSchema.parse(backup), null, 2);
}

export function forecastFilename(name: string, date = todayIso()): string {
  return `runway-forecast-${slugify(name)}-${date}.json`;
}

export function allForecastsFilename(date = todayIso()): string {
  return `runway-all-forecasts-${date}.json`;
}

export function csvFilename(name: string, granularity: Granularity, date = todayIso()): string {
  return `runway-${slugify(name)}-${granularity}-${date}.csv`;
}

export function exportForecastToFile(forecast: Forecast): void {
  const backup = buildBackup([forecast]);
  downloadFile(forecastFilename(forecast.name), "application/json", serializeBackup(backup));
}

export function exportAllToFile(forecasts: readonly Forecast[]): void {
  const backup = buildBackup(forecasts);
  downloadFile(allForecastsFilename(), "application/json", serializeBackup(backup));
}

export function exportProjectionToCsv(
  name: string,
  currency: Forecast["currency"],
  periods: readonly ProjectionPeriod[],
  granularity: Granularity,
  locale?: string,
): void {
  downloadFile(csvFilename(name, granularity), "text/csv", periodsToCsv(periods, currency, locale));
}

/* ------------------------------------------------------------------- import */

export type ImportOutcome = "created" | "renamed";

export interface ImportedForecast {
  name: string;
  outcome: ImportOutcome;
  reason?: string;
}

export interface ImportReport {
  importedCount: number;
  results: ImportedForecast[];
}

export interface ParsedBackupCounts {
  forecasts: number;
  recurringItems: number;
  oneOffItems: number;
  invoices: number;
  scenarios: number;
}

export type ParseResult =
  | { ok: true; backup: BackupFile; counts: ParsedBackupCounts }
  | { ok: false; error: string };

export function countBackup(backup: BackupFile): ParsedBackupCounts {
  let recurringItems = 0;
  let oneOffItems = 0;
  let invoices = 0;
  let scenarios = 0;

  for (const forecast of backup.forecasts) {
    recurringItems += forecast.recurringItems.length;
    oneOffItems += forecast.oneOffItems.length;
    invoices += forecast.invoices.length;
    if (forecast.baseForecastId !== undefined) scenarios += 1;
  }

  return { forecasts: backup.forecasts.length, recurringItems, oneOffItems, invoices, scenarios };
}

/**
 * Parses and validates a backup file.
 *
 * Accepts both the wrapped backup format and a bare single forecast object, so a
 * file hand-edited down to one forecast still imports.
 */
export function parseBackup(rawText: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }

  const result = backupFileSchema.safeParse(parsed);
  if (result.success) {
    return { ok: true, backup: result.data, counts: countBackup(result.data) };
  }

  const message =
    result.error.issues.length > 0
      ? `${result.error.issues[0]?.path.join(".") ?? "file"}: ${result.error.issues[0]?.message ?? "invalid"}`
      : "The file does not match the Runway backup format.";

  return { ok: false, error: `Import failed — ${message}` };
}

export interface ApplyImportOptions {
  /** `merge` keeps existing forecasts; `replace` wipes the store first. */
  mode: "merge" | "replace";
  /** Ids already present, so clashes can be detected. */
  existingIds: ReadonlySet<string>;
  existingNames: readonly string[];
}

export interface ApplyImportResult {
  forecasts: Forecast[];
  /** Ids to remove from the store first, when in replace mode. */
  clearFirst: boolean;
  report: ImportReport;
}

/**
 * Resolves an import against existing data.
 *
 * Returns the forecasts to write plus a per-forecast report. An id clash gets a
 * fresh id rather than overwriting, because silently replacing a forecast the
 * user spent an hour on is the worst possible import behaviour.
 */
export function resolveImport(
  backup: BackupFile,
  options: ApplyImportOptions,
): ApplyImportResult {
  const takenIds = new Set(options.existingIds);
  const takenNames = new Set(options.mode === "replace" ? [] : options.existingNames);

  const forecasts: Forecast[] = [];
  const results: ImportedForecast[] = [];

  for (const candidate of backup.forecasts) {
    const forecast: Forecast = structuredClone(candidate);
    let outcome: ImportOutcome = "created";
    let reason: string | undefined;

    if (options.mode === "merge" && takenIds.has(forecast.id)) {
      forecast.id = createId();
      outcome = "renamed";
      reason = "An existing forecast used the same id; a new id was assigned.";
    }

    if (takenNames.has(forecast.name)) {
      // Keep both: disambiguate rather than discard the user's data.
      let suffix = 2;
      let candidateName = `${forecast.name} (${suffix})`;
      while (takenNames.has(candidateName)) {
        suffix += 1;
        candidateName = `${forecast.name} (${suffix})`;
      }
      forecast.name = candidateName;
      outcome = "renamed";
      reason = reason ?? "A forecast with that name already existed; it was renamed.";
    }

    takenIds.add(forecast.id);
    takenNames.add(forecast.name);
    forecasts.push(forecast);
    results.push(
      reason === undefined ? { name: forecast.name, outcome } : { name: forecast.name, outcome, reason },
    );
  }

  return {
    forecasts,
    clearFirst: options.mode === "replace",
    report: { importedCount: forecasts.length, results },
  };
}

