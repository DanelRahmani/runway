import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/money";
import type { Currency, ItemImpact } from "@/types/forecast";

/**
 * How much an item moves the forecast across the whole horizon.
 *
 * The per-occurrence `Amount` column answers "what does this cost?"; this one
 * answers "what does this cost me over the year?", which is usually the figure
 * that changes a decision. An inactive item is excluded from the projection, so
 * it reports nothing rather than a misleading zero.
 */
export function ImpactCell({
  impact,
  currency,
  isActive,
}: {
  impact: ItemImpact | null;
  currency: Currency;
  isActive: boolean;
}) {
  if (!isActive) {
    return (
      <td className="tnum text-muted-foreground/70 text-right" title="Inactive, so excluded from the projection">
        —
      </td>
    );
  }

  if (impact === null) {
    return (
      <td
        className="tnum text-muted-foreground/70 text-right"
        title="Falls outside the forecast horizon"
      >
        —
      </td>
    );
  }

  const negative = impact.direction === "OUTFLOW";

  return (
    <td className="text-right">
      <span className={cn("tnum font-medium", negative ? "text-negative" : "text-positive")}>
        {negative ? "−" : "+"}
        {formatCents(impact.totalCents, currency)}
      </span>
      {impact.occurrences > 1 ? (
        <span className="text-muted-foreground block font-mono text-[0.6875rem]">
          ×{impact.occurrences}
        </span>
      ) : null}
    </td>
  );
}
