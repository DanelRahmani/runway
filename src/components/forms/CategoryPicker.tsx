import { Input } from "@/components/ui/input";
import { SuggestionChips } from "@/components/forms/SuggestionChips";
import { categorySuggestions } from "@/lib/categories";
import type { Direction, ForecastKind } from "@/types/forecast";

interface CategoryPickerProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  kind: ForecastKind | undefined;
  /** The direction currently selected, so matching suggestions lead. */
  direction: Direction;
  disabled?: boolean;
}

/** Free-text category with one-tap suggestions filtered to the forecast kind. */
export function CategoryPicker({
  id,
  value,
  onChange,
  kind,
  direction,
  disabled,
}: CategoryPickerProps) {
  const suggestions = categorySuggestions(kind, direction).map((category) => ({
    value: category.label,
    emoji: category.emoji,
  }));

  return (
    <div className="flex flex-col gap-2">
      <Input
        id={id}
        value={value}
        placeholder="e.g. Housing"
        autoComplete="off"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      <SuggestionChips
        label="Suggested categories"
        suggestions={suggestions}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}
