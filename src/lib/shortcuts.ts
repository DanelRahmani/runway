/**
 * Keyboard shortcuts, resolved as a pure function.
 *
 * The mapping is separated from the listener so the rules — what counts as
 * typing, what counts as a chord — can be tested without a browser. The hook in
 * `@/hooks/useShortcut` only supplies the ambient facts.
 */

export type ShortcutAction = "new-item" | "help";

export interface ShortcutInput {
  /** `KeyboardEvent.key`, so case and shifted symbols arrive already resolved. */
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  /** True when the key is being held rather than pressed. */
  repeat: boolean;
  /** True when focus is in a text field or any other editable surface. */
  editable: boolean;
  /** True when a modal-dialog is already mounted. */
  dialogOpen: boolean;
}

/**
 * The action a key press asks for, or `null` when the app should keep out of the
 * way.
 *
 * Deliberately conservative. Every "no" below is a case where guessing would take
 * a keystroke away from the user: a modifier belongs to the browser, a focused
 * field owns every printable character, and an open dialog owns the keyboard.
 */
export function resolveShortcut(input: ShortcutInput): ShortcutAction | null {
  if (input.ctrlKey || input.metaKey || input.altKey) return null;
  if (input.repeat) return null;

  /*
   * While typing, nothing here applies — including `?`. A question mark is a
   * character someone may well be typing, and a `n` in the middle of a client
   * name is just an `n`. There is no shortcut worth stealing from a text field.
   */
  if (input.editable) return null;

  // A dialog already has the keyboard; firing behind it would act on a page the
  // user cannot see.
  if (input.dialogOpen) return null;

  if (input.key === "n" || input.key === "N") return "new-item";
  if (input.key === "?") return "help";

  return null;
}
