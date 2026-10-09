import { isTransferCategory, sumCategoryTotals, TAX_CATEGORY } from "@/lib/categories";
import { categoryTotals } from "@/lib/forecast/engine";
import type { CategoryTotal, ForecastGoal, IsoDate, Projection } from "@/types/forecast";

/** Average Gregorian month, used to turn a horizon into a monthly pace. */
const DAYS_PER_MONTH = 30.4375;

export interface SavingsSummary {
  /** Moved to savings, investments, pension or debt principal — still yours. */
  keptCents: number;
  /** Chosen spending, excluding tax. */
  spendingCents: number;
  /** Tax, reported apart from spending because it is neither chosen nor kept. */
  taxCents: number;
  /** Every outflow the three above add up to. */
  outflowCents: number;
  inflowCents: number;
  /** `keptCents / inflowCents`, or `null` when there is no income to divide by. */
  savingsRate: number | null;
  /** Average kept per month across the horizon, rounded to whole cents. */
  monthlyKeptCents: number;
  /** The transfer categories, largest first. */
  keptByCategory: CategoryTotal[];
}

/**
 * What the forecast sets aside, and what that amounts to.
 *
 * This is deliberately a **flow**, not a balance. Runway knows what moves into
 * savings during the horizon; it does not know what was already there, because
 * there are no accounts yet. So nothing derived here may be presented as "your
 * savings are worth X" — only "you set aside X over these months".
 *
 * `keptCents + taxCents + spendingCents` is always `outflowCents`: the three are
 * a partition of the outflows, not a selection from them.
 */
export function savingsSummary(projection: Projection): SavingsSummary {
  const outflows = categoryTotals(projection).filter((total) => total.direction === "OUTFLOW");

  const keptByCategory = outflows.filter((total) => isTransferCategory(total.category));
  const taxTotals = outflows.filter((total) => total.category === TAX_CATEGORY);
  const spendingTotals = outflows.filter(
    (total) => !isTransferCategory(total.category) && total.category !== TAX_CATEGORY,
  );

  const keptCents = sumCategoryTotals(keptByCategory);
  const taxCents = sumCategoryTotals(taxTotals);
  const spendingCents = sumCategoryTotals(spendingTotals);
  const inflowCents = projection.summary.totalInflowCents;

  const days = projection.days.length;
  const months = days === 0 ? 0 : days / DAYS_PER_MONTH;

  return {
    keptCents,
    spendingCents,
    taxCents,
    outflowCents: keptCents + taxCents + spendingCents,
    inflowCents,
    // Guarded rather than clamped: with no income the ratio is undefined, and
    // showing 0% would read as "you kept nothing" when the truth is "unknown".
    savingsRate: inflowCents === 0 ? null : keptCents / inflowCents,
    monthlyKeptCents: months === 0 ? 0 : Math.round(keptCents / months),
    keptByCategory,
  };
}

export interface KeptPoint {
  date: IsoDate;
  /** Everything kept from the start of the horizon up to and including this day. */
  cumulativeCents: number;
}

/**
 * Money kept, accumulated day by day.
 *
 * Monotonic by construction — it only ever counts transfers out — so unlike the
 * balance chart it never falls. That is what makes it useful: it answers "how far
 * along am I" rather than "where do I stand".
 */
export function keptCurve(projection: Projection): KeptPoint[] {
  let running = 0;

  return projection.days.map((day) => {
    for (const entry of day.entries) {
      if (entry.direction === "OUTFLOW" && isTransferCategory(entry.category)) {
        running += entry.amountCents;
      }
    }
    return { date: day.date, cumulativeCents: running };
  });
}

export interface GoalProgress {
  goal: ForecastGoal;
  targetCents: number;
  /** Kept across the whole horizon. */
  keptCents: number;
  /** Progress towards the target, clamped to 0–1 for a progress bar. */
  fraction: number;
  /** First date the running total reaches the target, or `null` if it never does. */
  reachedDate: IsoDate | null;
  /** Still missing by the end of the horizon. Zero once the target is met. */
  shortfallCents: number;
  /** The target is reached on or before its own date. */
  onTrack: boolean;
  /**
   * The target date sits beyond the horizon, so whether it will be met is not
   * something this projection can say. The UI must not claim otherwise.
   */
  inconclusive: boolean;
}

/**
 * Measures a goal against the projection.
 *
 * Kept separate from `savingsSummary` because a goal is optional and the summary
 * is not: this is only called when one is set.
 */
export function goalProgress(projection: Projection, goal: ForecastGoal): GoalProgress {
  const curve = keptCurve(projection);
  const keptCents = curve[curve.length - 1]?.cumulativeCents ?? 0;

  const reached = curve.find((point) => point.cumulativeCents >= goal.targetCents);
  const reachedDate = reached?.date ?? null;

  const inconclusive = goal.targetDate > projection.endDate;

  return {
    goal,
    targetCents: goal.targetCents,
    keptCents,
    fraction: goal.targetCents <= 0 ? 0 : Math.min(1, keptCents / goal.targetCents),
    reachedDate,
    shortfallCents: Math.max(0, goal.targetCents - keptCents),
    // Reaching the target after the deadline is still late, so the date matters
    // as much as the amount.
    onTrack: reachedDate !== null && reachedDate <= goal.targetDate,
    inconclusive,
  };
}
