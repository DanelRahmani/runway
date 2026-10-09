export interface ChipSuggestion {
  value: string;
  emoji?: string;
}

/** How many chips to show before the list is expanded. */
export const COLLAPSED_SUGGESTIONS = 8;

interface SelectOptions {
  /** What the user has typed into the field. */
  query: string;
  /** Whether the user has asked to see everything. */
  expanded: boolean;
  initialCount?: number;
  /** The currently chosen value, if it came from this suggestion list. */
  activeValue?: string | undefined;
}

/**
 * Decides which suggestion chips are worth showing.
 *
 * Three states, in priority order:
 *
 * 1. **The user is typing.** Show every match. This is the real discovery
 *    mechanism, and it is why the collapsed list does not need to be long — the
 *    chips are a shortcut for the common cases, not a menu of everything.
 * 2. **Collapsed.** A shortlist of the most common, which is simply the head of
 *    the list because the declared order already runs most-common-first.
 * 3. **Expanded.** Everything.
 *
 * A selected chip is always kept visible even when it falls outside the
 * shortlist, otherwise choosing "Pension" and then collapsing the list would look
 * like the choice had been dropped.
 */
export function selectVisibleSuggestions<T extends ChipSuggestion>(
  suggestions: readonly T[],
  { query, expanded, initialCount = COLLAPSED_SUGGESTIONS, activeValue }: SelectOptions,
): { visible: T[]; hiddenCount: number } {
  const trimmed = query.trim().toLowerCase();

  if (trimmed !== "") {
    return {
      visible: suggestions.filter((suggestion) =>
        suggestion.value.toLowerCase().includes(trimmed),
      ),
      hiddenCount: 0,
    };
  }

  if (expanded) {
    return { visible: [...suggestions], hiddenCount: 0 };
  }

  const visible = suggestions.slice(0, initialCount);

  if (activeValue !== undefined) {
    const selected = suggestions.find((suggestion) => suggestion.value === activeValue);
    if (selected !== undefined && !visible.some((suggestion) => suggestion.value === selected.value)) {
      visible.push(selected);
    }
  }

  return {
    visible,
    hiddenCount: Math.max(0, suggestions.length - initialCount),
  };
}
