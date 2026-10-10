import { DownloadIcon } from "lucide-react";
import { useState, useMemo } from "react";

import { CategoryBreakdown } from "@/components/charts/CategoryBreakdown";
import { BalanceChartPanel } from "@/components/forecast/BalanceChartPanel";
import { CashCalendar } from "@/components/forecast/CashCalendar";
import { DonutChart } from "@/components/charts/DonutChart";
import { heatLevel } from "@/components/charts/chart-utils";
import { GranularityToggle } from "@/components/forecast/GranularityToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrapper,
} from "@/components/ui/table";
import { aggregate, isPartialPeriod, periodDayCount } from "@/lib/forecast/aggregate";
import { categoryTotals } from "@/lib/forecast/engine";
import { insights, type Insight } from "@/lib/forecast/insights";
import { sumCategoryTotals } from "@/lib/categories";
import { formatIsoDate, formatIsoDateRange } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { exportProjectionToCsv } from "@/lib/storage/backup";
import { cn } from "@/lib/utils";
import type { Forecast, Granularity, Projection, ProjectionPeriod } from "@/types/forecast";

interface OverviewTabProps {
  forecast: Forecast;
  projection: Projection;
}

export function OverviewTab({ forecast, projection }: OverviewTabProps) {
  const [granularity, setGranularity] = useState<Granularity>("weekly");

  const periods = aggregate(projection.days, granularity);

  /*
   * Whether anything repeats faster than the table's own periods. Weekly costs are
   * charged four times in some months and five in others, which is the usual reason
   * a column of monthly outflows does not hold still — so the table can say so
   * rather than leaving it to look like an error.
   */
  const hasFastRepeats = useMemo(
    () =>
      forecast.recurringItems.some(
        (item) => item.isActive && (item.frequency === "WEEKLY" || item.frequency === "BIWEEKLY"),
      ),
    [forecast.recurringItems],
  );

  // Income runs to a handful of categories at most, which is what makes a donut
  // readable here — unlike the twenty-category spending list beside it.
  const incomeTotals = useMemo(
    () => categoryTotals(projection).filter((total) => total.direction === "INFLOW"),
    [projection],
  );
  const incomeSlices = incomeTotals.map((total) => ({
    key: `${total.direction}-${total.category}`,
    label: total.category,
    cents: total.totalCents,
  }));

  return (
    <div className="flex flex-col gap-4">
      <BalanceChartPanel
        projection={projection}
        currency={forecast.currency}
        actions={
          <>
            <GranularityToggle value={granularity} onChange={setGranularity} />
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportProjectionToCsv(forecast.name, forecast.currency, periods, granularity)
              }
            >
              <DownloadIcon />
              CSV
            </Button>
          </>
        }
      />

      <ProjectionTable
        periods={periods}
        currency={forecast.currency}
        granularity={granularity}
        hasFastRepeats={hasFastRepeats}
      />

      <CashCalendar projection={projection} currency={forecast.currency} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CategoryBreakdown projection={projection} currency={forecast.currency} />
        <Card>
          <CardHeader>
            <CardTitle>Where income comes from</CardTitle>
            <CardDescription>
              {incomeTotals.length === 0
                ? "No income in this horizon."
                : `${formatCents(sumCategoryTotals(incomeTotals), forecast.currency)} across ${incomeTotals.length} categor${incomeTotals.length === 1 ? "y" : "ies"} over the horizon.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {incomeTotals.length === 0 ? (
              <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-xs leading-relaxed">
                Add income with a category to see this breakdown.
              </p>
            ) : (
              <DonutChart slices={incomeSlices} currency={forecast.currency} />
            )}
          </CardContent>
        </Card>
      </div>

      <InsightsCard forecast={forecast} projection={projection} />
      <NetByMonth projection={projection} currency={forecast.currency} />
    </div>
  );
}

/**
 * Intensity classes for the month grid.
 *
 * Written out in full rather than composed at runtime: Tailwind scans source text,
 * so `bg-positive/${n}` would simply never be generated. That is also why
 * `heatLevel` returns an index into these two lists rather than a colour.
 */
const GAIN_CLASSES = [
  "bg-muted/40",
  "bg-positive/10",
  "bg-positive/20",
  "bg-positive/30",
  "bg-positive/40",
] as const;

const LOSS_CLASSES = [
  "bg-muted/40",
  "bg-negative/10",
  "bg-negative/20",
  "bg-negative/30",
  "bg-negative/40",
] as const;

/**
 * Net movement per whole month.
 *
 * Partial months are left out deliberately: the first and last period of a
 * horizon cover a few days each, and a stub of a month painted next to twelve real
 * ones would read as a quiet month rather than a short one. With fewer than two
 * whole months there is no shape to see, so the card stays away.
 */
function NetByMonth({ projection, currency }: { projection: Projection; currency: Forecast["currency"] }) {
  const months = useMemo(
    () =>
      aggregate(projection.days, "monthly").filter(
        (period) => !isPartialPeriod(period, "monthly"),
      ),
    [projection.days],
  );

  const bound = useMemo(
    () => months.reduce((largest, month) => Math.max(largest, Math.abs(month.netCents)), 0),
    [months],
  );

  if (months.length < 2) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Net by month</CardTitle>
        <CardDescription>
          What each whole month moved. Darker is a bigger swing either way; red lost money.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {months.map((month) => {
            const level = heatLevel(month.netCents, bound);
            const shade =
              month.netCents < 0 ? LOSS_CLASSES[level] : GAIN_CLASSES[level];

            return (
              <li key={month.key} className={cn("rounded-lg border p-2.5", shade)}>
                <p className="text-xs font-medium">{month.label}</p>
                <p className="tnum text-muted-foreground text-xs">
                  {formatCents(month.netCents, currency, { signed: true })}
                </p>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

const TONE_CLASSES: Record<Insight["tone"], string> = {
  positive: "bg-positive",
  negative: "bg-negative",
  neutral: "bg-muted-foreground",
};

/** Plain sentences about the projection, so read off it rather than generated. */
function InsightsCard({ forecast, projection }: OverviewTabProps) {
  const found = useMemo(() => insights(forecast, projection), [forecast, projection]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Worth knowing</CardTitle>
        <CardDescription>
          Read off this projection — every line is a comparison, not a guess.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2.5">
          {found.map((insight) => (
            <li key={insight.id} className="flex items-start gap-2.5">
              <span
                aria-hidden="true"
                className={cn(
                  "mt-1.5 size-1.5 shrink-0 rounded-full",
                  TONE_CLASSES[insight.tone],
                )}
              />
              <span className="text-muted-foreground text-sm leading-relaxed">
                {insight.text}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function ProjectionTable({
  periods,
  currency,
  granularity,
  hasFastRepeats = false,
}: {
  periods: readonly ProjectionPeriod[];
  currency: Forecast["currency"];
  granularity: Granularity;
  /** Whether the forecast repeats anything faster than a period, so totals move. */
  hasFastRepeats?: boolean;
}) {
  const label = granularity === "daily" ? "Day" : granularity === "weekly" ? "Week" : "Month";
  const partials = periods.filter((period) => isPartialPeriod(period, granularity));
  const showNote = granularity !== "daily" && (partials.length > 0 || hasFastRepeats);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash-flow table</CardTitle>
        <CardDescription>
          {label}ly inflows, outflows, net movement and closing balance across the horizon.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TableWrapper className="max-h-[28rem] overflow-y-auto">
          <Table>
            <TableHeader className="bg-card sticky top-0 z-10">
              <TableRow>
                <TableHead>{label}</TableHead>
                <TableHead className="text-right">Opening</TableHead>
                <TableHead className="text-right">Inflows</TableHead>
                <TableHead className="text-right">Outflows</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Closing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.map((period) => (
                <TableRow key={period.key}>
                  <TableCell className="text-muted-foreground text-xs">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {granularity === "daily"
                        ? formatIsoDate(period.startDate)
                        : formatIsoDateRange(period.startDate, period.endDate)}
                      {/* The count is what makes a short period obvious: a month that
                          reports no income is not broken, it is nine days long. */}
                      {isPartialPeriod(period, granularity) ? (
                        <span className="text-[0.625rem] tracking-wide whitespace-nowrap uppercase">
                          {periodDayCount(period)} days
                        </span>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell className="tnum text-right">
                    {formatCents(period.openingCents, currency)}
                  </TableCell>
                  <TableCell className="tnum text-positive text-right">
                    {period.inflowCents === 0 ? "—" : formatCents(period.inflowCents, currency)}
                  </TableCell>
                  <TableCell className="tnum text-negative text-right">
                    {period.outflowCents === 0 ? "—" : formatCents(period.outflowCents, currency)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "tnum text-right font-medium",
                      period.netCents < 0 ? "text-negative" : "text-positive",
                    )}
                  >
                    {formatCents(period.netCents, currency, { signed: true })}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "tnum text-right font-semibold",
                      period.closingCents < 0 ? "text-negative" : "text-foreground",
                    )}
                  >
                    {formatCents(period.closingCents, currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrapper>

        {/*
         * Both of these are ordinary arithmetic rather than faults, and both look
         * like faults without a sentence saying so. The first and last periods of a
         * horizon cover only part of one; anything repeating faster than the period
         * lands four or five times, so its column does not hold still.
         */}
        {showNote ? (
          <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
            {partials.length > 0
              ? `The ${partials.length === 1 ? "row marked" : "rows marked"} with a day count ${partials.length === 1 ? "covers" : "cover"} only part of a ${label.toLowerCase()}, because the horizon starts or ends inside it — so those totals are smaller than a full one, not smaller than expected. `
              : null}
            {hasFastRepeats
              ? "Anything repeating faster than this — a weekly cost in a monthly table — is charged four times in some periods and five in others."
              : null}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
