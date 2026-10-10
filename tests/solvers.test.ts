import { describe, expect, it } from "vitest";

import { addMonths, compareIsoDate, horizonEndDate } from "@/lib/dates";
import { runProjection } from "@/lib/forecast/engine";
import { withExtraMonthlyCost } from "@/lib/forecast/sensitivity";
import {
  GOAL_PLAN_MAX_YEARS,
  maxSustainableMonthlyCost,
  planGoalSaving,
} from "@/lib/forecast/solvers";
import { goalProgress } from "@/lib/forecast/savings";
import type { Forecast, RecurringItem } from "@/types/forecast";

function makeForecast(overrides: Partial<Forecast> = {}): Forecast {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: "forecast",
    name: "Household",
    currency: "EUR",
    startingBalanceCents: 300_000,
    startDate: "2026-01-01",
    horizon: "THIRTEEN_WEEKS",
    recurringItems: [],
    oneOffItems: [],
    invoices: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function recurring(
  amountCents: number,
  direction: "INFLOW" | "OUTFLOW",
  category: string,
  frequency: RecurringItem["frequency"] = "MONTHLY",
): RecurringItem {
  return {
    id: `r-${category}-${amountCents}`,
    name: category,
    direction,
    amountCents,
    frequency,
    startDate: "2026-01-01",
    category,
    isActive: true,
  };
}

/** Salary in, modest costs out — a plan with genuine room in it. */
const roomy = makeForecast({
  startingBalanceCents: 500_000,
  recurringItems: [
    recurring(300_000, "INFLOW", "Salary"),
    recurring(100_000, "OUTFLOW", "Housing"),
  ],
});

describe("sustainable monthly cost", () => {
  it("returns an amount the plan really survives, and one cent more that it does not", () => {
    // The exact property, checked by running the engine rather than by restating
    // the search: the answer is the largest amount that holds, so its neighbour
    // must fail. That is what makes this a break-even point and not an estimate.
    const answer = maxSustainableMonthlyCost(roomy);

    expect(answer).not.toBeNull();
    const amount = answer ?? 0;

    const atAnswer = runProjection(
      withExtraMonthlyCost(roomy, amount, { name: "probe" }),
    ).summary.minimumBalanceCents;
    const oneCentMore = runProjection(
      withExtraMonthlyCost(roomy, amount + 1, { name: "probe" }),
    ).summary.minimumBalanceCents;

    expect(atAnswer).toBeGreaterThanOrEqual(0);
    expect(oneCentMore).toBeLessThan(0);
  });

  it("gives no answer for a plan that is already under water", () => {
    // Zero would read as "break even"; the truth is "you have none to give", and
    // those are different sentences.
    const drowning = makeForecast({
      startingBalanceCents: 10_000,
      recurringItems: [
        recurring(50_000, "INFLOW", "Salary"),
        recurring(200_000, "OUTFLOW", "Housing"),
      ],
    });

    expect(maxSustainableMonthlyCost(drowning)).toBeNull();
  });

  it("reports no room rather than a negative one when the plan lands exactly on zero", () => {
    // A single one-off, so the balance reaches zero and stops: there *is* an
    // answer, and it is nothing. A monthly item would have fired four times and
    // taken the plan under, which is the case above.
    const exact = makeForecast({
      startingBalanceCents: 100_000,
      oneOffItems: [
        {
          id: "only",
          name: "Housing",
          direction: "OUTFLOW",
          amountCents: 100_000,
          date: "2026-01-05",
          category: "Housing",
        },
      ],
    });

    expect(maxSustainableMonthlyCost(exact)).toBe(0);
  });

  it("never mutates the forecast it was handed", () => {
    const snapshot = structuredClone(roomy);
    maxSustainableMonthlyCost(roomy);

    expect(roomy).toEqual(snapshot);
  });
});

describe("the savings goal calculator", () => {
  const saver = makeForecast({
    startingBalanceCents: 100_000,
    recurringItems: [recurring(300_000, "INFLOW", "Salary")],
  });

  /**
   * Whether a given monthly saving reaches the goal in time.
   *
   * Projected exactly to the goal's own date — the shortest window that can answer
   * the question — rather than to whichever window the solver picked, so this does
   * not restate the solver's own arithmetic.
   */
  function reaches(
    amountCents: number,
    goal: { label: string; targetCents: number; targetDate: string },
  ): boolean {
    const target = runProjection(
      withExtraMonthlyCost(saver, amountCents, { name: "Goal saving", category: "Savings" }),
      { endDate: goal.targetDate },
    );
    const progress = goalProgress(target, goal);
    return (
      progress.reachedDate !== null && compareIsoDate(progress.reachedDate, goal.targetDate) <= 0
    );
  }

  it("asks for nothing when the plan already gets there", () => {
    const already = makeForecast({
      startingBalanceCents: 100_000,
      recurringItems: [
        recurring(300_000, "INFLOW", "Salary"),
        recurring(50_000, "OUTFLOW", "Savings"),
      ],
    });

    const plan = planGoalSaving(already, {
      label: "Buffer",
      targetCents: 50_000,
      targetDate: "2026-02-01",
    });

    expect(plan.requiredMonthlyCents).toBe(0);
    expect(plan.beyondLimit).toBe(false);
  });

  it("asks for an amount that works, and refuses to overstate it", () => {
    const goal = { label: "Japan", targetCents: 900_000, targetDate: "2026-03-31" };
    const plan = planGoalSaving(saver, goal);
    const amount = plan.requiredMonthlyCents;

    expect(amount).not.toBeNull();
    // The amount settles the goal...
    expect(reaches(amount ?? 0, goal)).toBe(true);
    // ...and half of it does not, so the figure is not padded with slack.
    expect(reaches(Math.floor((amount ?? 0) / 2), goal)).toBe(false);
  });

  it("leaves a target inside the horizon alone", () => {
    const plan = planGoalSaving(saver, {
      label: "Inside",
      targetCents: 300_000,
      targetDate: "2026-03-01",
    });

    expect(plan.extended).toBe(false);
    expect(plan.windowEnd).toBe(horizonEndDate(saver.startDate, saver.horizon));
  });

  it("projects past the horizon to answer for a far-off target", () => {
    // This is the point of the calculator, and it used to answer "cannot say". The
    // horizon is a display choice, not a limit on the arithmetic.
    const goal = { label: "Deposit", targetCents: 9_000_000, targetDate: "2029-06-30" };
    const plan = planGoalSaving(saver, goal);

    expect(plan.beyondLimit).toBe(false);
    expect(plan.extended).toBe(true);
    expect(plan.windowEnd).toBe("2029-06-30");
    expect(plan.requiredMonthlyCents).not.toBeNull();
    // And the answer still holds when the engine is run out to that date.
    expect(reaches(plan.requiredMonthlyCents ?? 0, goal)).toBe(true);
  });

  it("declines past the calculator's own limit instead of guessing", () => {
    // Ten years out: income and costs holding that long is not an assumption worth
    // dressing up as a number.
    const plan = planGoalSaving(saver, {
      label: "Retirement",
      targetCents: 9_000_000,
      targetDate: "2036-01-01",
    });

    expect(plan.beyondLimit).toBe(true);
    expect(plan.requiredMonthlyCents).toBeNull();
    expect(plan.windowEnd).toBe(addMonths(saver.startDate, GOAL_PLAN_MAX_YEARS * 12));
  });

  it("declines when no amount arrives in time", () => {
    const plan = planGoalSaving(saver, {
      label: "Impossible",
      targetCents: 100_000_000_000,
      targetDate: "2026-01-01",
    });

    expect(plan.requiredMonthlyCents).toBeNull();
    // A different failure from having no answer to give at all, and the caller has
    // to be able to tell them apart.
    expect(plan.beyondLimit).toBe(false);
  });

  it("never mutates the forecast it was handed", () => {
    const snapshot = structuredClone(saver);
    planGoalSaving(saver, { label: "Japan", targetCents: 900_000, targetDate: "2029-03-31" });

    expect(saver).toEqual(snapshot);
  });
});
