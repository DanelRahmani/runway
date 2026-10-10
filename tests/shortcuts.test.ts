import { describe, expect, it } from "vitest";

import { resolveShortcut, type ShortcutInput } from "@/lib/shortcuts";

/** A plain, unmodified `n` with nothing in the way. */
function press(overrides: Partial<ShortcutInput> = {}): ShortcutInput {
  return {
    key: "n",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    repeat: false,
    editable: false,
    dialogOpen: false,
    ...overrides,
  };
}

describe("keyboard shortcut resolution", () => {
  it("reads n as 'add an item', in either case", () => {
    expect(resolveShortcut(press())).toBe("new-item");
    expect(resolveShortcut(press({ key: "N" }))).toBe("new-item");
  });

  it("reads ? as 'show the shortcut list'", () => {
    expect(resolveShortcut(press({ key: "?" }))).toBe("help");
  });

  it("keeps out of the way entirely while the user is typing", () => {
    // A question mark is a character someone may well be typing into a client
    // name, and a stray `n` is just an `n`. Neither is worth stealing.
    for (const key of ["n", "N", "?", "x"]) {
      expect(resolveShortcut(press({ key, editable: true })), `key "${key}"`).toBeNull();
    }
  });

  it("leaves a chord with a modifier to the browser and the operating system", () => {
    expect(resolveShortcut(press({ ctrlKey: true }))).toBeNull();
    expect(resolveShortcut(press({ metaKey: true }))).toBeNull();
    expect(resolveShortcut(press({ altKey: true }))).toBeNull();
  });

  it("does nothing behind an open dialog", () => {
    expect(resolveShortcut(press({ dialogOpen: true }))).toBeNull();
    expect(resolveShortcut(press({ key: "?", dialogOpen: true }))).toBeNull();
  });

  it("ignores a key held down rather than pressed, so nothing fires in a burst", () => {
    expect(resolveShortcut(press({ repeat: true }))).toBeNull();
    expect(resolveShortcut(press({ key: "?", repeat: true }))).toBeNull();
  });

  it("ignores keys it does not own", () => {
    // Escape and the arrow keys belong to the tables and the dialogs, which
    // handle them where the context actually lives.
    for (const key of ["x", "Enter", "Escape", "ArrowDown", "1", " "]) {
      expect(resolveShortcut(press({ key })), `key "${key}"`).toBeNull();
    }
  });
});
