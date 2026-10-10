import { runProjection } from "@/lib/forecast/engine";
import { createId } from "@/lib/utils";
import type { Forecast, IsoDate, RecurringItem } from "@/types/forecast";

/** Average Gregorian month, used to turn a horizon total into a monthly pace. */
const DAYS_PER_MONTH = 30.4375;

export interface SensitivityRow {
  /** Uplift on the running-cost base, as a percentage. Zero is the forecast as it stands. */
  percent: number;
  /** What that percentage is worth per month, in cents. */
  extraMonthlyCents: number;
  endingBalanceCents: number;
  minimumBalanceCents: number;
  cashOutDate: IsoDate | null;
}

export interface SensitivityResult {
  /** The average monthly outflow the percentages are taken from. */
  baseMonthlyOutflowCents: number;
  rows: SensitivityRow[];
}

export const DEFAULT_UPLIFT_PERCENTS: readonly number[] = [0, 5, 10, 15, 20, 25, 30];

/**
 * Average monthly outflow across the horizon.
 *
 * Taken from the projection rather than from the item amounts, so a weekly cost
 * counts the four or five times it actually lands and an item that ends
 * mid-horizon stops counting when it ends.
 */
export function averageMonthlyOutflowCents(forecast: Forecast): number {
  const projection = runProjection(forecast);
  const months = projection.days.length / DAYS_PER_MONTH;
  if (months === 0) return 0;
  return Math.round(projection.summary.totalOutflowCents / months);
}

/**
 * What happens to the plan when running costs come in higher than expected.
 *
 * One more monthly outflow is added at each step and the whole projection is
 * re-run, so the answer comes from the same engine as everything else in the app.
 *
 * This is deliberately **not** an inflation model: the uplift is flat, applies to
 * outflows only, and never compounds. Nothing here is annualised, so the copy
 * says "if costs run X% higher" rather than "inflation".
 *
 * More cost can only move the balance down, so the last row is the worst case and
 * the table reads top to bottom as a worsening. That property is pinned in
 * `tests/sensitivity.test.ts` rather than assumed.
 */
export function costUpliftSensitivity(
  forecast: Forecast,
  percents: readonly number[] = DEFAULT_UPLIFT_PERCENTS,
): SensitivityResult {
  const baseMonthlyOutflowCents = averageMonthlyOutflowCents(forecast);

  const rows = percents.map((percent) => {
    const extraMonthlyCents = Math.round((baseMonthlyOutflowCents * percent) / 100);

    // Zero is the forecast as it stands, and has to be the base projection itself
    // rather than a projection with a zero-amount item bolted on.
    const target =
      extraMonthlyCents === 0 ? forecast : withExtraMonthlyCost(forecast, extraMonthlyCents);
    const { summary } = runProjection(target);

    return {
      percent,
      extraMonthlyCents,
      endingBalanceCents: summary.endingBalanceCents,
      minimumBalanceCents: summary.minimumBalanceCents,
      cashOutDate: summary.cashOutDate,
    };
  });

  return { baseMonthlyOutflowCents, rows };
}

/**
 * A copy carrying one more active monthly outflow.
 *
 * Exported because the solvers search for an amount using the same lever this
 * table displays — one definition of "add this much per month" rather than two
 * that could disagree.
 */
export function withExtraMonthlyCost(
  forecast: Forecast,
  amountCents: number,
  options: { name?: string; category?: string; note?: string } = {},
): Forecast {
  const item: RecurringItem = {
    id: createId(),
    name: options.name ?? "Higher running costs",
    direction: "OUTFLOW",
    amountCents,
    frequency: "MONTHLY",
    startDate: forecast.startDate,
    note: options.note ?? "What-if: running costs above plan",
    isActive: true,
    // No category by default: an uncategorised outflow is counted as a running
    // cost everywhere else, so a fabricated category here would be a lie.
    ...(options.category === undefined ? {} : { category: options.category }),
  };

  return { ...forecast, recurringItems: [...forecast.recurringItems, item] };
}
