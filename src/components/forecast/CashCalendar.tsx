import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { calendarMonths } from "@/lib/forecast/calendar";
import { formatCentsCompact } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Currency, Projection } from "@/types/forecast";

/** Monday-based, matching `startOfWeek` and the rest of the app's date handling. */
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/**
 * One month of cash flow, day by day.
 *
 * The table and the chart both answer "what happens over the horizon". Neither
 * answers "is my money in before the rent goes out", which is the shape of the
 * question a household actually has. One month at a time, because twelve month
 * grids stacked up is a wall rather than a calendar.
 *
 * A real table so the structure survives a screen reader; a movement is written
 * out rather than only coloured.
 */
export function CashCalendar({
  projection,
  currency,
}: {
  projection: Projection;
  currency: Currency;
}) {
  const months = useMemo(() => calendarMonths(projection.days), [projection.days]);
  const [index, setIndex] = useState(0);

  const month = months[Math.min(index, months.length - 1)];
  if (month === undefined) return null;

  const cashOutDate = projection.summary.cashOutDate;

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>Month by month</CardTitle>
          <CardDescription>
            Every day of {month.label}, with the days money lands and the days it leaves.
          </CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous month"
            disabled={index === 0}
            onClick={() => setIndex((current) => Math.max(0, current - 1))}
          >
            <ChevronLeftIcon />
          </Button>
          <span className="text-muted-foreground tnum min-w-20 text-center text-xs">
            {index + 1} / {months.length}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next month"
            disabled={index >= months.length - 1}
            onClick={() => setIndex((current) => Math.min(months.length - 1, current + 1))}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[40rem] border-separate border-spacing-1">
            <caption className="sr-only">Cash flow for {month.label}</caption>
            <thead>
              <tr>
                {WEEKDAY_LABELS.map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className="text-muted-foreground pb-1 text-left font-mono text-[0.625rem] font-medium tracking-wide uppercase"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {month.weeks.map((week, weekIndex) => (
                <tr key={weekIndex}>
                  {week.map((cell, cellIndex) =>
                    cell === null ? (
                      // An absent day, not an empty one — see `calendarMonths`.
                      <td key={`pad-${weekIndex}-${cellIndex}`} aria-hidden="true" />
                    ) : (
                      <td
                        key={cell.date}
                        className={cn(
                          "bg-muted/40 align-top rounded-md p-1.5",
                          cell.date === cashOutDate && "ring-negative ring-1",
                        )}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="tnum text-xs font-medium">{cell.dayOfMonth}</span>
                          {cell.inflowCents > 0 ? (
                            <span className="text-positive tnum text-[0.625rem] leading-tight">
                              +{formatCentsCompact(cell.inflowCents, currency)}
                            </span>
                          ) : null}
                          {cell.outflowCents > 0 ? (
                            <span className="text-negative tnum text-[0.625rem] leading-tight">
                              −{formatCentsCompact(cell.outflowCents, currency)}
                            </span>
                          ) : null}
                        </div>
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground mt-3 text-xs">
          {cashOutDate === null
            ? "No day this horizon closes below zero."
            : `The day the balance first closes below zero is outlined.`}
        </p>
      </CardContent>
    </Card>
  );
}
