import { HistoryIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatIsoDate } from "@/lib/dates";
import {
  forgetSnapshot,
  listAllSnapshots,
  listSnapshots,
  recordSnapshot,
  restoreSnapshot,
  type ForecastSnapshot,
} from "@/lib/storage/forecasts";
import { formatCents } from "@/lib/money";
import type { Forecast } from "@/types/forecast";

/**
 * The version history.
 *
 * Kept deliberately coarse: a version is written before something irreversible —
 * a delete, an import that replaces everything, a restore — not on every autosave.
 * A history that grows while you type is noise, and what is worth recovering from is
 * a decision, not a keystroke.
 *
 * Without a forecast in scope this lists every version, which is how a deleted
 * forecast is found again: deleting keeps the copy rather than taking it with it.
 */
export function VersionHistory({ forecast }: { forecast?: Forecast }) {
  const [snapshots, setSnapshots] = useState<readonly ForecastSnapshot[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(
    () => (forecast === undefined ? listAllSnapshots() : listSnapshots(forecast.id)),
    [forecast],
  );

  /*
   * Written as a `.then` rather than a state-setting call from the effect body: a
   * synchronous setState there causes a cascading render, which the hooks lint
   * refuses — correctly. `active` stops a slow read landing after the forecast has
   * already changed.
   */
  useEffect(() => {
    let active = true;

    reload()
      .then((next) => {
        if (active) setSnapshots(next);
      })
      .catch(() => {
        // A failed read leaves the list empty rather than taking the tab down.
      });

    return () => {
      active = false;
    };
  }, [reload]);

  const refresh = async (): Promise<void> => {
    setSnapshots(await reload());
  };

  const saveNow = async (): Promise<void> => {
    if (forecast === undefined) return;
    setBusy(true);
    await recordSnapshot(forecast, "Saved by hand");
    await refresh();
    setBusy(false);
  };

  const restore = async (id: string): Promise<void> => {
    setBusy(true);
    await restoreSnapshot(id);
    await refresh();
    setBusy(false);
  };

  const forget = async (id: string): Promise<void> => {
    setBusy(true);
    await forgetSnapshot(id);
    await refresh();
    setBusy(false);
  };

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2">
            <HistoryIcon className="size-3.5" />
            Version history
          </CardTitle>
          <CardDescription>
            {forecast === undefined
              ? "Every version Runway is holding, including forecasts that were deleted. Restoring one brings it back."
              : "A version is kept automatically before a delete, an import that replaces everything, or a restore — not while you type."}
          </CardDescription>
        </div>
        {forecast !== undefined ? (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void saveNow()}>
            Save a version
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {snapshots.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-xs leading-relaxed">
            Nothing kept yet. Versions appear here once something irreversible happens — or when you
            save one yourself.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {snapshots.map((snapshot) => (
              <li
                key={snapshot.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2"
              >
                <span className="text-sm font-medium">
                  {formatIsoDate(snapshot.createdAt.slice(0, 10))}
                </span>
                <span className="text-muted-foreground text-xs">
                  {snapshot.createdAt.slice(11, 16)} · {snapshot.reason}
                </span>
                {forecast === undefined ? (
                  <span className="text-muted-foreground text-xs">
                    {snapshot.forecast.name} ·{" "}
                    {formatCents(
                      snapshot.forecast.startingBalanceCents,
                      snapshot.forecast.currency,
                    )}{" "}
                    to start
                  </span>
                ) : null}
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => void restore(snapshot.id)}
                  >
                    <RotateCcwIcon />
                    Restore
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Discard the version from ${formatIsoDate(snapshot.createdAt.slice(0, 10))}`}
                    disabled={busy}
                    onClick={() => void forget(snapshot.id)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
