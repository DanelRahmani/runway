import { AlertCircleIcon, CheckCircle2Icon, DownloadIcon, UploadIcon } from "lucide-react";
import { useRef, useState } from "react";

import { ConfirmDialog } from "@/components/forms/ConfirmDialog";
import { Alert, AlertDescription, AlertIcon, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { aggregate } from "@/lib/forecast/aggregate";
import {
  allForecastsFilename,
  exportAllToFile,
  exportForecastToFile,
  exportProjectionToCsv,
  forecastFilename,
  parseBackup,
  resolveImport,
  type ImportReport,
  type ParsedBackupCounts,
  type ParseResult,
} from "@/lib/storage/backup";
import {
  clearAllForecasts,
  listForecasts,
  replaceAllForecasts,
  saveForecasts,
} from "@/lib/storage/forecasts";
import { cn } from "@/lib/utils";
import type { Forecast, Granularity, Projection } from "@/types/forecast";

const GRANULARITIES: ReadonlyArray<{ value: Granularity; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

interface DataTabProps {
  /** Omitted on the standalone Data page, where no single forecast is in scope. */
  forecast?: Forecast;
  projection?: Projection;
}

export function DataTab({ forecast, projection }: DataTabProps) {
  const [granularity, setGranularity] = useState<Granularity>("weekly");
  const [pending, setPending] = useState<ParseResult | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalForecasts = listForecasts().length;

  const handleFile = async (file: File): Promise<void> => {
    setReport(null);
    const text = await file.text();
    setPending(parseBackup(text));
  };

  const confirmImport = async (): Promise<void> => {
    if (pending === null || !pending.ok) return;

    const existing = listForecasts();
    const resolved = resolveImport(pending.backup, {
      mode,
      existingIds: new Set(existing.map((item) => item.id)),
      existingNames: existing.map((item) => item.name),
    });

    if (resolved.clearFirst) {
      await replaceAllForecasts(resolved.forecasts);
    } else {
      await saveForecasts(resolved.forecasts);
    }

    setReport(resolved.report);
    setPending(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {report !== null ? (
        <Alert variant="positive">
          <AlertIcon>
            <CheckCircle2Icon />
          </AlertIcon>
          <AlertTitle>
            Imported {report.importedCount} forecast{report.importedCount === 1 ? "" : "s"}.
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-1 flex list-disc flex-col gap-1 pl-4">
              {report.results.map((result, index) => (
                <li key={`${result.name}-${index}`}>
                  <span className="font-medium">{result.name}</span>
                  {result.outcome === "renamed" ? (
                    <span className="text-muted-foreground"> — {result.reason}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Export</CardTitle>
          <CardDescription>
            JSON exports contain everything — items, invoices and assumptions — and can be re-imported
            on any device.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {forecast !== undefined ? (
              <Button onClick={() => exportForecastToFile(forecast)}>
                <DownloadIcon />
                Export this forecast
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => exportAllToFile(listForecasts())}>
              <DownloadIcon />
              Export all {totalForecasts} forecast{totalForecasts === 1 ? "" : "s"}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            {forecast !== undefined ? (
              <>
                This forecast downloads as{" "}
                <code className="bg-muted rounded px-1 py-0.5 font-mono">
                  {forecastFilename(forecast.name)}
                </code>
                . All of them download as{" "}
                <code className="bg-muted rounded px-1 py-0.5 font-mono">{allForecastsFilename()}</code>.
              </>
            ) : (
              <>
                Downloads as{" "}
                <code className="bg-muted rounded px-1 py-0.5 font-mono">{allForecastsFilename()}</code>
                .
              </>
            )}
          </p>

          {forecast !== undefined && projection !== undefined ? (
            <>
              <Separator />

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">Projection CSV</p>
                  <p className="text-muted-foreground text-xs">
                    Period-by-period inflow, outflow, net movement and closing balance — ready for a
                    spreadsheet.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <GranularityPicker value={granularity} onChange={setGranularity} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      exportProjectionToCsv(
                        forecast.name,
                        forecast.currency,
                        aggregate(projection.days, granularity),
                        granularity,
                      )
                    }
                  >
                    <DownloadIcon />
                    Download CSV
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import</CardTitle>
          <CardDescription>
            Drop a Runway JSON file here, or choose one. Nothing is written until you confirm.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files[0];
              if (file !== undefined) void handleFile(file);
            }}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center transition-colors",
              dragging ? "border-primary bg-accent" : "border-border",
            )}
          >
            <UploadIcon className="text-muted-foreground size-5" />
            <p className="text-sm">Drag a <code className="font-mono">.json</code> backup here</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              Choose a file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file !== undefined) void handleFile(file);
                event.target.value = "";
              }}
            />
          </div>

          {pending !== null && !pending.ok ? (
            <Alert variant="destructive">
              <AlertIcon>
                <AlertCircleIcon />
              </AlertIcon>
              <AlertTitle>That file could not be imported</AlertTitle>
              <AlertDescription>{pending.error}</AlertDescription>
            </Alert>
          ) : null}

          {pending !== null && pending.ok ? (
            <ImportPreview
              counts={pending.counts}
              names={pending.backup.forecasts.map((item) => item.name)}
              mode={mode}
              onModeChange={setMode}
              onCancel={() => setPending(null)}
              onConfirm={() => void confirmImport()}
              existingCount={totalForecasts}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Clear all local data</CardTitle>
          <CardDescription>
            Deletes every forecast from this browser, including scenarios. There is no undo — export a
            backup first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setConfirmClear(true)}>
            Clear all {totalForecasts} forecast{totalForecasts === 1 ? "" : "s"}
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Delete all forecasts?"
        description={
          <>
            This removes <strong>every forecast and scenario</strong> stored in this browser. If you
            have not exported a JSON backup, the data is gone for good.
          </>
        }
        confirmLabel="Yes, delete everything"
        onConfirm={() => {
          void clearAllForecasts();
          setReport(null);
        }}
      />
    </div>
  );
}

function GranularityPicker({
  value,
  onChange,
}: {
  value: Granularity;
  onChange: (value: Granularity) => void;
}) {
  return (
    <div className="bg-muted inline-flex items-center gap-0.5 rounded-lg p-0.5" role="group" aria-label="CSV granularity">
      {GRANULARITIES.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "focus-visible:ring-ring rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
            value === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ImportPreview({
  counts,
  names,
  mode,
  onModeChange,
  onCancel,
  onConfirm,
  existingCount,
}: {
  counts: ParsedBackupCounts;
  names: readonly string[];
  mode: "merge" | "replace";
  onModeChange: (mode: "merge" | "replace") => void;
  onCancel: () => void;
  onConfirm: () => void;
  existingCount: number;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Ready to import</p>
        <p className="text-muted-foreground text-xs">
          {counts.forecasts} forecast{counts.forecasts === 1 ? "" : "s"} · {counts.recurringItems}{" "}
          recurring · {counts.oneOffItems} one-off · {counts.invoices} invoice
          {counts.invoices === 1 ? "" : "s"}
          {counts.scenarios > 0 ? ` · ${counts.scenarios} scenario${counts.scenarios === 1 ? "" : "s"}` : ""}
        </p>
      </div>

      <ul className="flex flex-wrap gap-1.5">
        {names.map((name, index) => (
          <li key={`${name}-${index}`}>
            <Badge variant="muted">{name}</Badge>
          </li>
        ))}
      </ul>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-medium">How should this be applied?</legend>
        <label className="flex items-start gap-2 text-xs">
          <input
            type="radio"
            name="import-mode"
            checked={mode === "merge"}
            onChange={() => onModeChange("merge")}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Merge</span> — keep the {existingCount} forecast
            {existingCount === 1 ? "" : "s"} already here. Anything with a clashing id or name is
            added under a new one.
          </span>
        </label>
        <label className="flex items-start gap-2 text-xs">
          <input
            type="radio"
            name="import-mode"
            checked={mode === "replace"}
            onChange={() => onModeChange("replace")}
            className="mt-0.5"
          />
          <span>
            <span className="text-destructive font-medium">Replace</span> — permanently delete the{" "}
            {existingCount} forecast{existingCount === 1 ? "" : "s"} already here, then import.
          </span>
        </label>
      </fieldset>

      {mode === "replace" && existingCount > 0 ? (
        <Alert variant="destructive">
          <AlertIcon>
            <AlertCircleIcon />
          </AlertIcon>
          <AlertDescription>
            Replace mode will delete your existing forecasts. Export a backup first if you are not
            sure.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onConfirm} variant={mode === "replace" ? "destructive" : "default"}>
          {mode === "replace" ? "Replace everything and import" : "Import forecasts"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
