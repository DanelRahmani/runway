import { useMemo } from "react";

import { CategoryLabel } from "@/components/forecast/CategoryLabel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { splitOutflows, sumCategoryTotals } from "@/lib/categories";
import { categoryTotals } from "@/lib/forecast/engine";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Currency, Projection } from "@/types/forecast";

const TITLE = "Where the money goes";
const EMPTY = "No spending in this horizon.";
const HINT = "Add expenses with a category to see this breakdown.";
const TONE = "text-negative";
const BAR = "bg-negative";

/**
 * Where the money goes.
 *
 * Horizontal bars rather than a donut: with twenty categories a pie chart is
 * unreadable, and bars put the labels on a straight line where they can be read.
 * Bars are sized against the largest single total so the biggest line fills the
 * track, which is what makes the shape of the month legible at a glance.
 *
 * Income and kept money are donuts instead, because those never run to more than
 * a handful of categories — the shape is the message there, and a list would just
 * be longer.
 */
export function CategoryBreakdown({
  projection,
  currency,
}: {
  projection: Projection;
  currency: Currency;
}) {
  // Walks every entry in the projection, so it is worth not repeating on each render.
  const totals = useMemo(() => splitOutflows(categoryTotals(projection)).spending, [projection]);
  const grandTotal = sumCategoryTotals(totals);
  const largest = totals[0]?.totalCents ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{TITLE}</CardTitle>
        <CardDescription>
          {totals.length === 0
            ? EMPTY
            : `${formatCents(grandTotal, currency)} across ${totals.length} categor${totals.length === 1 ? "y" : "ies"} over the horizon.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {totals.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-xs leading-relaxed">
            {HINT}
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
                      <span className={cn("tnum font-medium", TONE)}>
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
                    <div className={cn("h-full rounded-full", BAR)} style={{ width: `${width}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
