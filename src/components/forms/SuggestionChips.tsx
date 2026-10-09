import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ChipSuggestion {
  value: string;
  emoji?: string;
}

interface SuggestionChipsProps {
  /** Accessible name for the group, e.g. "Suggested names". */
  label: string;
  suggestions: readonly ChipSuggestion[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * One-tap suggestions rendered as toggle chips.
 *
 * Shared by the name and category fields so the two behave identically and look
 * the same. A native `<datalist>` would be less code, but its dropdown cannot be
 * styled to match and behaves differently in every browser; chips are also far
 * better on touch.
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
}: SuggestionChipsProps) {
  const normalised = value.trim().toLowerCase();
  const active = suggestions.find(
    (suggestion) => suggestion.value.toLowerCase() === normalised,
  )?.value;

  if (suggestions.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)} role="group" aria-label={label}>
      {suggestions.map((suggestion) => {
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
            {selected ? <CheckIcon className="size-3" /> : null}
          </button>
        );
      })}
    </div>
  );
}
