import type { ReactNode } from "react";

import { BalanceChart, ChartLegend, type BalancePoint } from "@/components/charts/BalanceChart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatIsoDateRange } from "@/lib/dates";
import type { Currency, Projection } from "@/types/forecast";

interface BalanceChartPanelProps {
  projection: Projection;
  currency: Currency;
  title?: string;
  /** Header controls (granularity, export). Owned by the caller. */
  actions?: ReactNode;
  height?: number;
  className?: string;
}

/**
 * The projected-balance chart with its card chrome and legend.
 *
 * Shared by the Overview tab and the graph drawer so the two cannot drift apart.
 * Header controls arrive through `actions` rather than living here, because
 * granularity also drives the cash-flow table on the Overview tab and that state
 * has to stay with its owner.
 */
export function BalanceChartPanel({
  projection,
  currency,
  title = "Projected balance",
  actions,
  height,
  className,
}: BalanceChartPanelProps) {
  const chartData: BalancePoint[] = projection.days.map((day) => ({
    date: day.date,
    label: day.date,
    balanceCents: day.closingCents,
  }));

  const { minimumBalanceCents, minimumBalanceDate } = projection.summary;

  return (
    <Card className={className}>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {formatIsoDateRange(projection.startDate, projection.endDate)} ·{" "}
            {projection.days.length} days
          </CardDescription>
        </div>
        {actions !== undefined ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </CardHeader>
      <CardContent>
        <BalanceChart
          data={chartData}
          currency={currency}
          minimumDate={minimumBalanceDate}
          minimumCents={minimumBalanceCents}
          height={height}
        />
        <ChartLegend minimumCents={minimumBalanceCents} />
      </CardContent>
    </Card>
  );
}
