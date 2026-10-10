import { compareIsoDate } from "@/lib/dates";
import type { Forecast, IsoDate, Projection } from "@/types/forecast";

/**
 * Plan versus reality.
 *
 * A forecast nobody checks is a guess that has been typed up. Comparing a real
 * closing balance with the one the plan predicted is the cheapest way to find out
 * that an assumption has stopped being true — and the newest comparison is the one
 * that matters, because it says whether next month will land where the line says.
 */

export interface ActualComparisonRow {
  date: IsoDate;
  /** What the plan said the balance would be, or `null` outside the horizon. */
  plannedCents: number | null;
  actualCents: number;
  /** Actual minus planned: positive means better than the plan said. */
  varianceCents: number | null;
}

export interface ActualComparison {
  rows: ActualComparisonRow[];
  /** Every variance added up: the drift so far. */
  totalVarianceCents: number;
  /** The newest variance, which is the one worth acting on. */
  latestVarianceCents: number | null;
}

export function compareActuals(
  forecast: Forecast,
  projection: Projection,
): ActualComparison {
  // A map rather than a `find` per actual, so the cost does not grow with the
  // product of the two lists.
  const planned = new Map(projection.days.map((day) => [day.date, day.closingCents]));

  const rows = [...(forecast.actuals ?? [])]
    .sort((a, b) => compareIsoDate(a.date, b.date))
    .map((actual) => {
      const plannedCents = planned.get(actual.date) ?? null;
      return {
        date: actual.date,
        plannedCents,
        actualCents: actual.closingBalanceCents,
        varianceCents:
          plannedCents === null ? null : actual.closingBalanceCents - plannedCents,
      };
    });

  const variances = rows
    .map((row) => row.varianceCents)
    .filter((value): value is number => value !== null);

  return {
    rows,
    totalVarianceCents: variances.reduce((sum, value) => sum + value, 0),
    latestVarianceCents: variances.at(-1) ?? null,
  };
}
