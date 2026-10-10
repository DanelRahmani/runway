import { useMemo } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrapper,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatIsoDate } from "@/lib/dates";
import { costUpliftSensitivity } from "@/lib/forecast/sensitivity";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Forecast } from "@/types/forecast";

/**
 * "What if everything costs a bit more?"
 *
 * The one lever that matters most to a household and the one the projection
 * cannot answer by itself. Deliberately a table rather than a chart: the useful
 * output is the number at which the plan breaks, and a break point is read off a
 * column, not estimated off a curve.
 */
export function WhatIfTab({ forecast }: { forecast: Forecast }) {
  const currency = forecast.currency;
  const result = useMemo(() => costUpliftSensitivity(forecast), [forecast]);
  const noOutflows = result.baseMonthlyOutflowCents === 0;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>If running costs come in higher</CardTitle>
          <CardDescription>
            {noOutflows
              ? "This forecast has no outflows to raise."
              : `Your outflows average ${formatCents(result.baseMonthlyOutflowCents, currency)} a month here. Each row adds that much more every month and re-runs the whole projection.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {noOutflows ? (
            <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-xs leading-relaxed">
              Add some spending and this table will show how much room there is before the plan
              breaks.
            </p>
          ) : (
            <TableWrapper>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Costs</TableHead>
                    <TableHead className="text-right">Extra per month</TableHead>
                    <TableHead className="text-right">Ending balance</TableHead>
                    <TableHead className="text-right">Cash-out date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row) => (
                    <TableRow key={row.percent} className={cn(row.percent === 0 && "bg-muted/40")}>
                      <TableCell className="font-medium">
                        {row.percent === 0 ? "As planned" : `${row.percent}% higher`}
                      </TableCell>
                      <TableCell className="tnum text-right">
                        {row.extraMonthlyCents === 0
                          ? "—"
                          : formatCents(row.extraMonthlyCents, currency)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "tnum text-right",
                          row.endingBalanceCents < 0 && "text-negative",
                        )}
                      >
                        {formatCents(row.endingBalanceCents, currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.cashOutDate === null ? "No shortfall" : formatIsoDate(row.cashOutDate)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What this does not model</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground flex flex-col gap-2 text-xs leading-relaxed">
          <p>
            The increase is flat and lands on outflows only — income is left alone. That makes this a
            question about your costs rather than an inflation model: nothing compounds, and the same
            amount is added in the final month as the first.
          </p>
          <p>
            The base is your average monthly outflow <em>taken from the projection</em>, so a weekly
            cost counts the four or five times it actually lands, and an item that ends mid-horizon
            stops counting when it ends.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
