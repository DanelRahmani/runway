import { Input } from "@/components/ui/input";
import { SuggestionChips } from "@/components/forms/SuggestionChips";
import { nameSuggestions } from "@/lib/itemNames";
import type { Direction, ForecastKind } from "@/types/forecast";

interface NamePickerProps {
  id: string;
  value: string;
  onChange: (name: string) => void;
  /**
   * Called when a chosen suggestion implies a category and the category field is
   * still empty. A category the user already set is never touched.
   */
  onImpliedCategory?: (category: string) => void;
  categoryIsEmpty: boolean;
  kind: ForecastKind | undefined;
  direction: Direction;
  disabled?: boolean;
}

/**
 * Free-text name with one-tap suggestions.
 *
 * Suggestions are direction-aware: adding an expense leads with Rent and
 * Groceries, adding income leads with Salary and Client retainer.
 */
export function NamePicker({
  id,
  value,
  onChange,
  onImpliedCategory,
  categoryIsEmpty,
  kind,
  direction,
  disabled,
}: NamePickerProps) {
  const suggestions = nameSuggestions(kind, direction);

  const handleChange = (name: string): void => {
    onChange(name);
    if (!categoryIsEmpty) return;

    // Only fire on an exact suggestion match, so typing never silently sets a category.
    const match = suggestions.find((suggestion) => suggestion.name === name);
    if (match?.category !== undefined) onImpliedCategory?.(match.category);
  };

  return (
    <div className="flex flex-col gap-2">
      <Input
        id={id}
        value={value}
        placeholder="e.g. Rent"
        autoComplete="off"
        disabled={disabled}
        onChange={(event) => handleChange(event.target.value)}
      />
      <SuggestionChips
        label="Suggested names"
        suggestions={suggestions.map((suggestion) => ({ value: suggestion.name }))}
        value={value}
        onChange={handleChange}
        disabled={disabled}
      />
    </div>
  );
}
