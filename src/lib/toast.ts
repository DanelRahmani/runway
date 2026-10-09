import { useSyncExternalStore } from "react";

import { createId } from "@/lib/utils";

/**
 * Toasts, with an optional action.
 *
 * A module-level store rather than context: the only consumer is the single
 * `<Toaster />` mounted in the app shell, and a store means any module can raise
 * a toast without being wired through props. Same observable pattern the
 * forecast cache uses.
 *
 * The point of this is undo. Deletes in Runway are permanent, so a delete now
 * hands the user a way back for as long as the toast is on screen.
 */

export interface Toast {
  id: string;
  message: string;
  /** Rendered as a button. The toast dismisses itself once it is used. */
  actionLabel?: string;
  onAction?: () => void;
  tone: "default" | "positive";
}

export interface ToastOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: Toast["tone"];
  /** Milliseconds before auto-dismiss. Actionable toasts default to longer. */
  durationMs?: number;
}

interface VisibleToast extends Toast {
  durationMs: number;
}

export type { VisibleToast };

const MAX_VISIBLE = 3;
const DEFAULT_DURATION = 4000;
/**
 * Actionable toasts stay up long enough to be read, understood and clicked, and
 * they pause while hovered or focused. WCAG asks for enough time to act on
 * time-limited content, and a two-second undo window would fail that.
 */
const ACTION_DURATION = 9000;

let toasts: readonly VisibleToast[] = Object.freeze([]);
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): readonly VisibleToast[] {
  return toasts;
}

export function showToast(options: ToastOptions): string {
  const id = createId();
  const hasAction = options.actionLabel !== undefined && options.onAction !== undefined;

  const toast: VisibleToast = {
    id,
    message: options.message,
    tone: options.tone ?? "default",
    durationMs: options.durationMs ?? (hasAction ? ACTION_DURATION : DEFAULT_DURATION),
    ...(hasAction
      ? { actionLabel: options.actionLabel, onAction: options.onAction }
      : {}),
  };

  // Newest first, capped so a burst of deletes cannot bury the screen.
  toasts = Object.freeze([toast, ...toasts].slice(0, MAX_VISIBLE));
  emit();
  return id;
}

export function dismissToast(id: string): void {
  const next = toasts.filter((toast) => toast.id !== id);
  if (next.length === toasts.length) return;
  toasts = Object.freeze(next);
  emit();
}

/** Used by the Toaster's timers, and by tests. */
export function clearToasts(): void {
  toasts = Object.freeze([]);
  emit();
}

export function useToasts(): readonly VisibleToast[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Convenience wrapper: raise an undoable toast for a deletion.
 *
 * `restore` re-inserts the deleted thing; `message` should name it so the user
 * knows what they just removed.
 */
export function showUndoToast(message: string, restore: () => void): void {
  showToast({ message, actionLabel: "Undo", onAction: restore });
}
