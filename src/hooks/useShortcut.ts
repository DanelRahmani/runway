import { useEffect } from "react";

import { resolveShortcut, type ShortcutAction } from "@/lib/shortcuts";

/** True when the focused element would swallow a printable key. */
function isEditable(element: Element | null): boolean {
  if (element === null) return false;

  // A `<select>` claims letter keys for jumping between options, so it counts.
  const tag = element.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;

  return element instanceof HTMLElement && element.isContentEditable;
}

/**
 * Runs `handler` when `action`'s shortcut is pressed.
 *
 * Radix only mounts dialog content while it is open — nothing here is
 * `forceMount`ed — so the presence of a `role="dialog"` in the document is a
 * truthful "a dialog is up".
 *
 * ponytail: that test is by role, so it also catches the non-modal balance
 * drawer, which deliberately does not take the keyboard. Shortcuts are therefore
 * inert while the drawer is open. Over-blocking is the safe direction — the
 * alternative is acting on a page the user cannot see — and the upgrade path is
 * to test for modality (Radix marks modal content, the drawer is `modal={false}`)
 * if this ever chafes.
 *
 * The listener is rebuilt when the handler changes. That costs one add/remove per
 * render, which is nothing next to a keydown, and it means the listener can never
 * run a stale closure.
 */
export function useShortcut(action: ShortcutAction, handler: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const resolved = resolveShortcut({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        repeat: event.repeat,
        editable: isEditable(document.activeElement),
        dialogOpen: document.querySelector('[role="dialog"]') !== null,
      });

      if (resolved !== action) return;

      event.preventDefault();
      handler();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [action, handler]);
}
