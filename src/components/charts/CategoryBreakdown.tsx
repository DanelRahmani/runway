import { PiggyBankIcon } from "lucide-react";

import { CategoryLabel } from "@/components/forecast/CategoryLabel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { splitOutflows, sumCategoryTotals } from "@/lib/categories";
import { categoryTotals } from "@/lib/forecast/engine";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CategoryTotal, Currency, Projection } from "@/types/forecast";

export type BreakdownVariant = "spending" | "transfers" | "income";

const TITLES: Record<BreakdownVariant, string> = {
  spending: "Where the money goes",
  transfers: "Kept, not spent",
  income: "Where income comes from",
};

const EMPTY: Record<BreakdownVariant, string> = {
  spending: "No spending in this horizon.",
  transfers: "Nothing set aside in this horizon.",
  income: "No income in this horizon.",
};

const HINTS: Record<BreakdownVariant, string> = {
  spending: "Add expenses with a category to see this breakdown.",
  transfers:
    "Tag an item as Savings, Investing, Pension or Debt repayment and it shows up here instead of counting as spending.",
  income: "Add income with a category to see this breakdown.",
};

const TONE: Record<BreakdownVariant, string> = {
  spending: "text-negative",
  transfers: "text-positive",
  income: "text-positive",
};

const BAR: Record<BreakdownVariant, string> = {
  spending: "bg-negative",
  transfers: "bg-positive",
  income: "bg-positive",
};

function selectTotals(totals: readonly CategoryTotal[], variant: BreakdownVariant): CategoryTotal[] {
  if (variant === "income") return totals.filter((total) => total.direction === "INFLOW");
  const split = splitOutflows(totals);
  return variant === "transfers" ? split.transfers : split.spending;
}

/**
 * Where the money goes, where it comes from, and what you kept.
 *
 * Horizontal bars rather than a donut: with twenty categories a pie chart is
 * unreadable, and bars put the labels on a straight line where they can be read.
 * Bars are sized against the largest single total so the biggest line fills the
 * track, which is what makes the shape of the month legible at a glance.
 */
export function CategoryBreakdown({
  projection,
  currency,
  variant,
}: {
  projection: Projection;
  currency: Currency;
  variant: BreakdownVariant;
}) {
  const totals = selectTotals(categoryTotals(projection), variant);
  const grandTotal = sumCategoryTotals(totals);
  const largest = totals[0]?.totalCents ?? 0;
  const isTransferView = variant === "transfers";

  return (
    <Card className={cn(isTransferView && totals.length > 0 && "border-positive/30 bg-positive-muted/20")}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isTransferView ? <PiggyBankIcon className="size-3.5" /> : null}
          {TITLES[variant]}
        </CardTitle>
        <CardDescription>
          {totals.length === 0
            ? EMPTY[variant]
            : `${formatCents(grandTotal, currency)} across ${totals.length} categor${totals.length === 1 ? "y" : "ies"} over the horizon.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {totals.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-xs leading-relaxed">
            {HINTS[variant]}
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {totals.map((total) => {
              const share = grandTotal === 0 ? 0 : total.totalCents / grandTotal;
              const width = largest === 0 ? 0 : Math.max(2, (total.totalCents / largest) * 100);
              return (
                <li key={`${total.direction}-${total.category}`} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <CategoryLabel category={total.category} className="truncate" />
                    <span className="flex shrink-0 items-baseline gap-2">
                      <span className={cn("tnum font-medium", TONE[variant])}>
                        {formatCents(total.totalCents, currency)}
                      </span>
                      <span className="text-muted-foreground tnum w-9 text-right">
                        {Math.round(share * 100)}%
                      </span>
                    </span>
                  </div>
                  <div
                    className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
                    role="img"
                    aria-label={`${total.category}: ${formatCents(total.totalCents, currency)}, ${Math.round(share * 100)} percent`}
                  >
                    <div
                      className={cn("h-full rounded-full", BAR[variant])}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {isTransferView && totals.length > 0 ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            This money is still yours. It left your current account, so it counts as cash out, but it
            moved into savings, investments or a pension rather than being spent.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
