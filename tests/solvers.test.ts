import { describe, expect, it } from "vitest";

import { compareIsoDate } from "@/lib/dates";
import { runProjection } from "@/lib/forecast/engine";
import { withExtraMonthlyCost } from "@/lib/forecast/sensitivity";
import { maxSustainableMonthlyCost, requiredMonthlySaving } from "@/lib/forecast/solvers";
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

describe("monthly saving a goal needs", () => {
  const saver = makeForecast({
    startingBalanceCents: 100_000,
    recurringItems: [recurring(300_000, "INFLOW", "Salary")],
  });

  /** Whether a given monthly saving reaches the goal in time, by the app's own measure. */
  function reaches(amountCents: number, goal: { label: string; targetCents: number; targetDate: string }): boolean {
    const target = runProjection(
      withExtraMonthlyCost(saver, amountCents, { name: "Goal saving", category: "Savings" }),
    );
    const progress = goalProgress(target, goal);
    return (
      progress.reachedDate !== null &&
      compareIsoDate(progress.reachedDate, goal.targetDate) <= 0
    );
  }

  it("asks for nothing when the plan already gets there", () => {
    const goal = { label: "Buffer", targetCents: 50_000, targetDate: "2026-02-01" };

    // A salary-only plan keeps nothing, so this goal is only reachable by saving;
    // start from one that already saves and the answer has to be zero.
    const already = makeForecast({
      startingBalanceCents: 100_000,
      recurringItems: [
        recurring(300_000, "INFLOW", "Salary"),
        recurring(50_000, "OUTFLOW", "Savings"),
      ],
    });

    expect(requiredMonthlySaving(already, goal)).toBe(0);
  });

  it("asks for an amount that works, and refuses to overstate it", () => {
    const goal = { label: "Japan", targetCents: 900_000, targetDate: "2026-03-31" };
    const answer = requiredMonthlySaving(saver, goal);

    expect(answer).not.toBeNull();
    // The amount settles the goal...
    expect(reaches(answer ?? 0, goal)).toBe(true);
    // ...and half of it does not, so the figure is not padded with slack.
    expect(reaches(Math.floor((answer ?? 0) / 2), goal)).toBe(false);
  });

  it("declines to answer when the target date is beyond the horizon", () => {
    // There is no day out there to check an answer against, and a guess would look
    // as confident as the real thing.
    const goal = { label: "Deposit", targetCents: 900_000, targetDate: "2030-01-01" };

    expect(requiredMonthlySaving(saver, goal)).toBeNull();
  });

  it("declines to answer when no amount arrives in time", () => {
    const goal = { label: "Impossible", targetCents: 100_000_000_000, targetDate: "2026-01-01" };

    expect(requiredMonthlySaving(saver, goal)).toBeNull();
  });
});
