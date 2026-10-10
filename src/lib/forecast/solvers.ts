import { runProjection } from "@/lib/forecast/engine";
import { withExtraMonthlyCost } from "@/lib/forecast/sensitivity";
import { goalProgress } from "@/lib/forecast/savings";
import type { Forecast, ForecastGoal } from "@/types/forecast";

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
 * The monthly amount that has to be set aside to reach a goal by its own date.
 *
 * `0` means the plan already gets there. `null` means the question has no answer
 * worth printing: either the target date sits beyond the horizon, so there is
 * nothing to check an answer against, or even an implausible monthly amount never
 * arrives in time.
 *
 * The extra money is filed as a transfer, because that is what sets money aside —
 * a category the engine already counts as kept rather than spent.
 */
export function requiredMonthlySaving(forecast: Forecast, goal: ForecastGoal): number | null {
  if (goal.targetDate > runProjection(forecast).endDate) return null;

  const reaches = (amountCents: number): boolean => {
    const target =
      amountCents === 0
        ? forecast
        : withExtraMonthlyCost(forecast, amountCents, {
            name: "Goal saving",
            category: "Savings",
            note: "Solver: the amount needed to reach the goal",
          });

    const progress = goalProgress(runProjection(target), goal);
    return progress.reachedDate !== null && progress.reachedDate <= goal.targetDate;
  };

  if (reaches(0)) return 0;
  if (!reaches(MAX_SEARCH_CENTS)) return null;

  return searchSmallest(reaches);
}
