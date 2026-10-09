import { DownloadIcon } from "lucide-react";
import { useState } from "react";

import { CategoryBreakdown } from "@/components/charts/CategoryBreakdown";
import { BalanceChartPanel } from "@/components/forecast/BalanceChartPanel";
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
import { aggregate } from "@/lib/forecast/aggregate";
import { formatIsoDate, formatIsoDateRange } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { exportProjectionToCsv } from "@/lib/storage/backup";
import { cn } from "@/lib/utils";
import type { Forecast, Granularity, Projection, ProjectionPeriod } from "@/types/forecast";

const GRANULARITIES: ReadonlyArray<{ value: Granularity; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

interface OverviewTabProps {
  forecast: Forecast;
  projection: Projection;
}

export function OverviewTab({ forecast, projection }: OverviewTabProps) {
  const [granularity, setGranularity] = useState<Granularity>("weekly");

  const periods = aggregate(projection.days, granularity);

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

      <ProjectionTable periods={periods} currency={forecast.currency} granularity={granularity} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CategoryBreakdown projection={projection} currency={forecast.currency} variant="spending" />
        <CategoryBreakdown projection={projection} currency={forecast.currency} variant="income" />
      </div>

      {/*
       * Rendered even when empty: the empty state is what tells a new user that
       * Savings, Investing, Pension and Debt repayment are treated as kept money
       * rather than spending.
       */}
      <CategoryBreakdown projection={projection} currency={forecast.currency} variant="transfers" />
    </div>
  );
}

function GranularityToggle({
  value,
  onChange,
}: {
  value: Granularity;
  onChange: (value: Granularity) => void;
}) {
  return (
    <div className="bg-muted inline-flex items-center gap-0.5 rounded-lg p-0.5" role="group" aria-label="Chart granularity">
      {GRANULARITIES.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "focus-visible:ring-ring rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
            value === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ProjectionTable({
  periods,
  currency,
  granularity,
}: {
  periods: readonly ProjectionPeriod[];
  currency: Forecast["currency"];
  granularity: Granularity;
}) {
  const label = granularity === "daily" ? "Day" : granularity === "weekly" ? "Week" : "Month";

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
                    {granularity === "daily"
                      ? formatIsoDate(period.startDate)
                      : formatIsoDateRange(period.startDate, period.endDate)}
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
      </CardContent>
    </Card>
  );
}
