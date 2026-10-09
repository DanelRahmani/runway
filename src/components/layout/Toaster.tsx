import { XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { dismissToast, useToasts, type VisibleToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/**
 * Renders queued toasts.
 *
 * Each toast owns its own dismiss timer so that pausing one does not affect the
 * others. The timers stop while the toast is hovered or holds focus, because an
 * undo button you cannot reach in time is worse than no undo button.
 */
export function Toaster() {
  const toasts = useToasts();

  if (toasts.length === 0) return null;

  return (
    <div
      // A live region so the message is announced, but "polite" so it does not
      // interrupt whatever the user is doing.
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: VisibleToast }) {
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(toast.durationMs);
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (paused) return;

    startedAtRef.current = Date.now();
    const timer = window.setTimeout(() => {
      dismissToast(toast.id);
    }, remainingRef.current);

    return () => {
      window.clearTimeout(timer);
      // Bank the time already served so pausing and resuming is fair.
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAtRef.current));
    };
  }, [paused, toast.id]);

  return (
    <div
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className={cn(
        "bg-popover text-popover-foreground pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-lg border px-3 py-2 shadow-lg",
        toast.tone === "positive" && "border-positive/40",
      )}
    >
      <p className="flex-1 text-xs leading-relaxed">{toast.message}</p>

      {toast.actionLabel !== undefined && toast.onAction !== undefined ? (
        <Button
          variant="link"
          size="sm"
          className="h-auto shrink-0 px-0 text-xs font-semibold"
          onClick={() => {
            toast.onAction?.();
            dismissToast(toast.id);
          }}
        >
          {toast.actionLabel}
        </Button>
      ) : null}

      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground size-6 shrink-0"
        aria-label="Dismiss notification"
        onClick={() => dismissToast(toast.id)}
      >
        <XIcon className="size-3.5" />
      </Button>
    </div>
  );
}
