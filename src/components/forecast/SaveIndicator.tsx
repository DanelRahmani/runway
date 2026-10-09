import { CalendarClockIcon, CheckCircle2Icon, Loader2Icon, TriangleAlertIcon } from "lucide-react";

import type { AutosaveState } from "@/lib/storage/forecasts";

/**
 * The "Saved" indicator.
 *
 * It reports what actually happened: a pending write, a confirmed save, or a
 * failure. There is no state where the UI claims success without one.
 */
export function SaveIndicator({ state }: { state: AutosaveState }) {
  if (state.status === "error") {
    return (
      <span className="text-negative inline-flex items-center gap-1.5 text-xs" role="status">
        <TriangleAlertIcon className="size-3.5" />
        {state.error ?? "Could not save"}
      </span>
    );
  }

  if (state.status === "pending") {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs" role="status">
        <Loader2Icon className="size-3.5 animate-spin" />
        Saving…
      </span>
    );
  }

  if (state.status === "saved") {
    return (
      <span className="text-positive inline-flex items-center gap-1.5 text-xs" role="status">
        <CheckCircle2Icon className="size-3.5" />
        Saved
      </span>
    );
  }

  return (
    <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs" role="status">
      <CalendarClockIcon className="size-3.5" />
      Autosave on
    </span>
  );
}
