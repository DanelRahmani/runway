import { addMonths, compareIsoDate, horizonEndDate } from "@/lib/dates";
import { runProjection } from "@/lib/forecast/engine";
import { withExtraMonthlyCost } from "@/lib/forecast/sensitivity";
import { goalProgress } from "@/lib/forecast/savings";
import type { Forecast, ForecastGoal, IsoDate } from "@/types/forecast";

/**
 * Inverse questions.
 *
 * Everything else in the app answers "given this plan, what happens?". These
 * answer the other direction — "what would have to be true for that outcome?" — by
 * searching for the amount rather than solving for it. The projection stops being
 * linear in the amount the moment a month goes short, so a search is the honest
 * method, and it is why every answer here is an amount the engine has actually run.
 */

/**
 * A ceiling on the search: 1,000,000 major units a month. No real plan survives
 * an extra cost that size, so this bounds the work rather than the answer.
 */
const MAX_SEARCH_CENTS = 100_000_000;

/**
 * The first probe when growing towards the answer. Doubled from here rather than
 * guessed, so the search is the same in yen as in euro.
 */
const FIRST_PROBE_CENTS = 1_000;

/**
 * The largest amount for which `holds` is still true.
 *
 * For a property that gets *harder* as the amount grows — surviving another
 * monthly cost — so the interval is grown until it breaks and then narrowed.
 * Callers must have established that `holds(0)` is true. Terminating on
 * `high - low === 1` makes the answer exact to the cent with no fixed step count.
 */
function searchLargest(holds: (amountCents: number) => boolean): number {
  let low = 0;
  let high = FIRST_PROBE_CENTS;

  while (holds(high)) {
    low = high;
    high *= 2;
    if (low >= MAX_SEARCH_CENTS) return low;
  }

  while (high - low > 1) {
    const mid = low + Math.floor((high - low) / 2);
    if (holds(mid)) low = mid;
    else high = mid;
  }

  return low;
}

/**
 * The smallest amount for which `holds` is true.
 *
 * For a property that gets *easier* as the amount grows — reaching a goal sooner
 * — which is the opposite search: the interval is grown until the amount works and
 * then narrowed from the other end. Callers must have established that `holds(0)`
 * is false and that some larger amount holds.
 */
function searchSmallest(holds: (amountCents: number) => boolean): number {
  let low = 0;
  let high = FIRST_PROBE_CENTS;

  while (!holds(high)) {
    low = high;
    high *= 2;
    // Unreachable given the caller's check, but returning the ceiling is a safer
    // failure than looping for ever.
    if (high > MAX_SEARCH_CENTS) return MAX_SEARCH_CENTS;
  }

  while (high - low > 1) {
    const mid = low + Math.floor((high - low) / 2);
    if (holds(mid)) high = mid;
    else low = mid;
  }

  return high;
}

/**
 * The most that could be added to monthly running costs and still never close below
 * zero — the answer to "how much room do I actually have?".
 *
 * Returns `null` when the plan already dips: there is no monthly room to give, and
 * a number there would invite the user to spend it.
 */
export function maxSustainableMonthlyCost(forecast: Forecast): number | null {
  const survives = (amountCents: number): boolean => {
    const target =
      amountCents === 0
        ? forecast
        : withExtraMonthlyCost(forecast, amountCents, {
            name: "Headroom probe",
            note: "Solver: the most sustainable extra monthly cost",
          });

    return runProjection(target).summary.minimumBalanceCents >= 0;
  };

  if (!survives(0)) return null;
  return searchLargest(survives);
}

/**
 * How far past its own start the goal calculator will project.
 *
 * Five years. Beyond that the answer rests on today's income and costs holding for
 * half a decade, which has stopped being a forecast and become arithmetic wearing a
 * forecast's clothes.
 */
export const GOAL_PLAN_MAX_YEARS = 5;

/** Months in a year. Local because this module must not import the schema. */
const MONTHS_PER_YEAR = 12;

export interface GoalPlan {
  /** Monthly amount to set aside. `0` when the plan already gets there. */
  requiredMonthlyCents: number | null;
  /** The last day the answer was computed over. */
  windowEnd: IsoDate;
  /** True when that window runs past the forecast's own horizon. */
  extended: boolean;
  /** True when the target sits further out than the calculator will project. */
  beyondLimit: boolean;
}

/**
 * What it takes to reach a goal, projected as far as the goal's own date.
 *
 * The horizon is a display choice — thirteen weeks or a year of curve to look at —
 * not a property of the arithmetic, so a target beyond it is no harder to calculate
 * than one inside it. This runs the engine out to the target date and solves for the
 * monthly amount that arrives in time, rather than refusing to answer.
 *
 * The extra money is filed as a transfer, because that is what setting money aside
 * is: a category the engine already counts as kept rather than spent.
 *
 * `requiredMonthlyCents` is `null` in two different situations and the caller must
 * keep them apart: the target is further out than the calculator will project
 * (`beyondLimit`), or no affordable amount arrives in time.
 */
export function planGoalSaving(forecast: Forecast, goal: ForecastGoal): GoalPlan {
  const start = forecast.startDate;
  const limit = addMonths(start, GOAL_PLAN_MAX_YEARS * MONTHS_PER_YEAR);

  if (compareIsoDate(goal.targetDate, limit) > 0) {
    return { requiredMonthlyCents: null, windowEnd: limit, extended: true, beyondLimit: true };
  }

  const horizonEnd = horizonEndDate(start, forecast.horizon);
  const extended = compareIsoDate(goal.targetDate, horizonEnd) > 0;
  const windowEnd = extended ? goal.targetDate : horizonEnd;

  const reaches = (amountCents: number): boolean => {
    const target =
      amountCents === 0
        ? forecast
        : withExtraMonthlyCost(forecast, amountCents, {
            name: "Goal saving",
            category: "Savings",
            note: "Solver: the amount needed to reach the goal",
          });

    const progress = goalProgress(runProjection(target, { endDate: windowEnd }), goal);
    return (
      progress.reachedDate !== null && compareIsoDate(progress.reachedDate, goal.targetDate) <= 0
    );
  };

  if (reaches(0)) {
    return { requiredMonthlyCents: 0, windowEnd, extended, beyondLimit: false };
  }
  if (!reaches(MAX_SEARCH_CENTS)) {
    return { requiredMonthlyCents: null, windowEnd, extended, beyondLimit: false };
  }

  return {
    requiredMonthlyCents: searchSmallest(reaches),
    windowEnd,
    extended,
    beyondLimit: false,
  };
}
