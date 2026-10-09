import { GRANULARITY_LABELS, type Granularity } from "@/types/forecast";
import { cn } from "@/lib/utils";

const ALL: readonly Granularity[] = ["daily", "weekly", "monthly"];

interface GranularityToggleProps {
  value: Granularity;
  onChange: (value: Granularity) => void;
  /**
   * Which steps to offer.
   *
   * The stacked composition chart omits daily: ninety-odd columns cannot be read,
   * so offering the choice would only let the user break their own chart.
   */
  options?: readonly Granularity[];
}

/** Segmented control for a chart's time step. */
export function GranularityToggle({ value, onChange, options = ALL }: GranularityToggleProps) {
  return (
    <div
      className="bg-muted inline-flex items-center gap-0.5 rounded-lg p-0.5"
      role="group"
      aria-label="Chart granularity"
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "focus-visible:ring-ring rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
            value === option
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {GRANULARITY_LABELS[option]}
        </button>
      ))}
    </div>
  );
}
