import { CheckSquareIcon, Trash2Icon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { categorySuggestions } from "@/lib/categories";
import { formatCents } from "@/lib/money";
import type { Currency, ForecastKind } from "@/types/forecast";

const SELECT_CLASS =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 h-8 rounded-md border px-2 text-xs outline-none focus-visible:ring-[3px]";

/** Sentinel for "remove the category", because a select can only carry strings. */
const CLEAR = "__clear__";

/**
 * A checkbox that can show the "some but not all" state.
 *
 * `indeterminate` is a DOM property with no HTML attribute, so it has to be set on
 * the element directly. Without it a header box would read as unchecked while
 * several rows are ticked, which is the opposite of what it means.
 */
export function SelectionCheckbox({
  checked,
  indeterminate = false,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current !== null) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      aria-label={label}
      className="accent-accent border-input size-4 cursor-pointer align-middle"
    />
  );
}

interface BulkBarProps {
  count: number;
  currency: Currency;
  /**
   * What the selection is worth, so a bulk change is made with the amount in
   * front of you rather than from memory of which rows were ticked.
   */
  summaryCents: number;
  /** What that total means, e.g. "net over the horizon". */
  summaryLabel: string;
  /** Categories already present in this list, offered first. */
  existing: readonly string[];
  forecastKind: ForecastKind | undefined;
  onApplyCategory: (category: string | undefined) => void;
  onDelete: () => void;
  onClear: () => void;
}

/**
 * The bar that appears once anything is selected.
 *
 * Categories already used in this forecast come first, because the common job is
 * "these five belong with the one I already have" rather than picking a fresh
 * label out of the whole taxonomy.
 */
export function BulkBar({
  count,
  currency,
  summaryCents,
  summaryLabel,
  existing,
  forecastKind,
  onApplyCategory,
  onDelete,
  onClear,
}: BulkBarProps) {
  const [choice, setChoice] = useState("");

  const known = new Set(existing);
  const rest = categorySuggestions(forecastKind, undefined)
    .map((category) => category.label)
    .filter((label) => !known.has(label));

  return (
    <div className="bg-accent/10 ring-accent/25 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 ring-1">
      <span className="flex flex-wrap items-baseline gap-1.5 text-xs font-medium">
        <CheckSquareIcon className="size-3.5 self-center" aria-hidden="true" />
        {count} selected
        <span className="text-muted-foreground tnum font-normal">
          · {formatCents(summaryCents, currency, { signed: summaryCents > 0 })} {summaryLabel}
        </span>
      </span>

      <label className="flex items-center">
        <span className="sr-only">Category to apply to the selection</span>
        <select
          value={choice}
          onChange={(event) => setChoice(event.target.value)}
          className={SELECT_CLASS}
        >
          <option value="">Change category…</option>
          <option value={CLEAR}>Remove category</option>
          {existing.length > 0 ? (
            <optgroup label="Used in this forecast">
              {existing.map((label) => (
                <option key={`used-${label}`} value={label}>
                  {label}
                </option>
              ))}
            </optgroup>
          ) : null}
          {rest.length > 0 ? (
            <optgroup label="All categories">
              {rest.map((label) => (
                <option key={`all-${label}`} value={label}>
                  {label}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
      </label>

      <Button
        size="sm"
        disabled={choice === ""}
        onClick={() => {
          onApplyCategory(choice === CLEAR ? undefined : choice);
          setChoice("");
        }}
      >
        Apply
      </Button>

      <Button variant="ghost" size="sm" className="text-destructive" onClick={onDelete}>
        <Trash2Icon />
        Delete
      </Button>

      <Button variant="ghost" size="sm" className="ml-auto" onClick={onClear}>
        <XIcon />
        Clear selection
      </Button>
    </div>
  );
}
