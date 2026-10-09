import { isTransferCategory, sumCategoryTotals, TAX_CATEGORY } from "@/lib/categories";
import { categoryTotals } from "@/lib/forecast/engine";
import type { CategoryTotal, Projection } from "@/types/forecast";

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
