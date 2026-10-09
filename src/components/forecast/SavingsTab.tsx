import { PiggyBankIcon } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { DonutChart } from "@/components/charts/DonutChart";
import { AnimatedMoney } from "@/components/forecast/AnimatedMoney";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { savingsSummary } from "@/lib/forecast/savings";
import { formatCents } from "@/lib/money";
import { cn, formatPercent } from "@/lib/utils";
import type { Forecast, Projection } from "@/types/forecast";

interface SavingsTabProps {
  forecast: Forecast;
  projection: Projection;
}

/**
 * Savings and investments, kept apart from the spending story.
 *
 * Everything here is a **flow over the horizon**, never a balance. Runway does
 * not yet know what was already in savings, because there are no accounts, so the
 * copy is careful to say what moved rather than what is held.
 */
export function SavingsTab({ forecast, projection }: SavingsTabProps) {
  const currency = forecast.currency;
  const summary = useMemo(() => savingsSummary(projection), [projection]);

  const keptSlices = summary.keptByCategory.map((total) => ({
    key: `${total.direction}-${total.category}`,
    label: total.category,
    cents: total.totalCents,
  }));

  const outflowSlices = [
    { key: "spending", label: "Spending", cents: summary.spendingCents },
    { key: "kept", label: "Kept", cents: summary.keptCents },
    { key: "tax", label: "Tax", cents: summary.taxCents },
  ].filter((slice) => slice.cents > 0);

  const hasKept = summary.keptCents > 0;

  return (
    <div className="flex flex-col gap-4">
      <Card className={cn(hasKept && "border-positive/30")}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PiggyBankIcon className="size-3.5" />
            Set aside over the horizon
          </CardTitle>
          <CardDescription>
            {hasKept
              ? `Money that left your current account but stayed yours — ${formatCents(summary.keptCents, currency)} across ${summary.keptByCategory.length} categor${summary.keptByCategory.length === 1 ? "y" : "ies"}.`
              : "Nothing is being set aside in this horizon yet."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <Figure label="Total kept">
              <AnimatedMoney cents={summary.keptCents} currency={currency} />
            </Figure>
            <Figure label="Savings rate">
              {summary.savingsRate === null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                formatPercent(summary.savingsRate)
              )}
            </Figure>
            <Figure label="Average per month">
              <AnimatedMoney cents={summary.monthlyKeptCents} currency={currency} />
            </Figure>
          </dl>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>What you kept</CardTitle>
            <CardDescription>
              {hasKept
                ? "Savings, investments, pension and debt principal — money moved, not money spent."
                : "Tag an item as Savings, Investing, Pension or Debt repayment and it appears here."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasKept ? (
              <DonutChart
                slices={keptSlices}
                currency={currency}
                height={168}
              />
            ) : (
              <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-xs leading-relaxed">
                A transfer reduces your cash without being spending. Paying yourself into savings,
                buying investments, funding a pension and repaying debt principal all work this way,
                which is why they are counted separately.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Where your outflow goes</CardTitle>
            <CardDescription>
              {summary.outflowCents > 0
                ? `${formatCents(summary.outflowCents, currency)} left your accounts in total. Tax is shown apart from spending: it is neither a choice nor money kept.`
                : "No outflows in this horizon."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {outflowSlices.length > 0 ? (
              <DonutChart
                slices={outflowSlices}
                currency={currency}
                height={168}
              />
            ) : (
              <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-xs leading-relaxed">
                Add expenses to see how your outflow splits between spending, tax and money kept.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What this does not include</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground flex flex-col gap-2 text-xs leading-relaxed">
          <p>
            These are totals <em>moved</em> across the horizon, not balances you hold. Runway does
            not yet know what was already in savings before the forecast starts, so it will not
            guess at your net worth.
          </p>
          <p>
            Interest, investment growth and debt interest are also not modelled. Every figure here is
            a contribution, not a return.
          </p>
          <p>
            {summary.savingsRate === null
              ? "The savings rate needs income in the same horizon to divide by, which this forecast does not have."
              : `The savings rate is what you set aside divided by the ${formatCents(summary.inflowCents, currency)} of income in this horizon.`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/** The engraved label register the KPI cards use, sized for a card body. */
function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground font-mono text-[0.6875rem] font-medium tracking-wide uppercase">
        {label}
      </dt>
      <dd className="font-display tnum text-xl leading-tight">{children}</dd>
    </div>
  );
}
