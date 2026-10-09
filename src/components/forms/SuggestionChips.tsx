import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { useState } from "react";

import {
  COLLAPSED_SUGGESTIONS,
  selectVisibleSuggestions,
  type ChipSuggestion,
} from "@/lib/suggestions";
import { cn } from "@/lib/utils";

interface SuggestionChipsProps {
  /** Accessible name for the group, e.g. "Suggested names". */
  label: string;
  suggestions: readonly ChipSuggestion[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  /** How many chips to show before expanding. */
  initialCount?: number;
}

/**
 * One-tap suggestions rendered as toggle chips.
 *
 * Shared by the name and category fields so the two behave identically and look
 * the same. A native `<datalist>` would be less code, but its dropdown cannot be
 * styled to match and behaves differently in every browser; chips are also far
 * better on touch.
 *
 * The list opens collapsed. Dumping twenty chips under a text field turns a
 * shortcut into a wall the reader has to scan past, so the common ones lead and
 * the rest arrive on typing or on request.
 *
 * Choosing the active chip clears the field again, which is how a mis-tap is
 * undone without reaching for the keyboard.
 */
export function SuggestionChips({
  label,
  suggestions,
  value,
  onChange,
  disabled,
  className,
  initialCount = COLLAPSED_SUGGESTIONS,
}: SuggestionChipsProps) {
  const [expanded, setExpanded] = useState(false);

  const active = suggestions.find(
    (suggestion) => suggestion.value.toLowerCase() === value.trim().toLowerCase(),
  )?.value;

  if (suggestions.length === 0) return null;

  const { visible } = selectVisibleSuggestions(suggestions, {
    query: value,
    expanded,
    initialCount,
    activeValue: active,
  });

  // While typing, filtering is itself the reveal mechanism, so a toggle would
  // just be noise; it only earns its place on a collapsed, untouched field.
  const showToggle = value.trim() === "" && suggestions.length > initialCount;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)} role="group" aria-label={label}>
      {visible.map((suggestion) => {
        const selected = suggestion.value === active;
        return (
          <button
            key={suggestion.value}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            title={selected ? `Clear ${suggestion.value}` : `Use ${suggestion.value}`}
            onClick={() => onChange(selected ? "" : suggestion.value)}
            className={cn(
              "focus-visible:ring-ring inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50",
              selected
                ? "border-accent bg-negative-muted text-accent-text"
                : "border-border hover:border-border-strong hover:bg-secondary text-muted-foreground",
            )}
          >
            {suggestion.emoji !== undefined ? <span aria-hidden="true">{suggestion.emoji}</span> : null}
            {suggestion.value}
            {selected ? <span aria-hidden="true">✓</span> : null}
          </button>
        );
      })}

      {showToggle ? (
        <button
          type="button"
          disabled={disabled}
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className="focus-visible:ring-ring border-border text-muted-foreground hover:border-border-strong hover:bg-secondary hover:text-foreground inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
        >
          {expanded ? (
            <>
              <ChevronUpIcon className="size-3" aria-hidden="true" />
              Show fewer
            </>
          ) : (
            <>
              <ChevronDownIcon className="size-3" aria-hidden="true" />
              Show all {suggestions.length}
            </>
          )}
        </button>
      ) : null}
    </div>
  );
}
