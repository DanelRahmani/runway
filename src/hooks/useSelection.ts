import { useCallback, useMemo, useState } from "react";

export interface Selection {
  /** The selected ids, with any that no longer exist already dropped. */
  ids: ReadonlySet<string>;
  count: number;
  isSelected: (id: string) => boolean;
  toggle: (id: string, selected: boolean) => void;
  setMany: (ids: readonly string[], selected: boolean) => void;
  clear: () => void;
}

/**
 * Multi-selection over a list of ids.
 *
 * Two decisions worth naming:
 *
 * 1. **Selection survives filtering.** Ticking three items and then narrowing the
 *    search does not silently drop them — the count in the bar keeps telling the
 *    truth about what a bulk change is going to touch. Silently narrowing the
 *    selection is how someone deletes something they never meant to.
 * 2. **Ids that no longer exist are filtered out on read rather than repaired in an
 *    effect.** An item deleted in another tab, or by an undo, simply stops being
 *    selected; there is no second state to keep in step.
 */
export function useSelection(allIds: readonly string[]): Selection {
  const [raw, setRaw] = useState<ReadonlySet<string>>(() => new Set<string>());

  const ids = useMemo(() => {
    const existing = new Set(allIds);
    return new Set([...raw].filter((id) => existing.has(id)));
  }, [raw, allIds]);

  const toggle = useCallback((id: string, selected: boolean) => {
    setRaw((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const setMany = useCallback((targets: readonly string[], selected: boolean) => {
    setRaw((current) => {
      const next = new Set(current);
      for (const id of targets) {
        if (selected) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => setRaw(new Set<string>()), []);

  return {
    ids,
    count: ids.size,
    isSelected: (id: string) => ids.has(id),
    toggle,
    setMany,
    clear,
  };
}

/**
 * Removes an optional `category` from an item.
 *
 * Dropping the key rather than setting it to `undefined` keeps stored records and
 * JSON exports clean — an `undefined` would survive structured clone but vanish
 * through `JSON.stringify`, so the same record would look different depending on
 * how it left the app.
 */
export function withoutCategory<T extends { category?: string }>(item: T): T {
  const { category: _dropped, ...rest } = item;
  return rest as T;
}
