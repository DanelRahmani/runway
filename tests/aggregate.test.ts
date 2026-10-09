import { describe, expect, it } from "vitest";

import { aggregate, isPartialPeriod, periodDayCount } from "@/lib/forecast/aggregate";
import { runProjection } from "@/lib/forecast/engine";
import { daysBetween } from "@/lib/dates";
import type { Forecast, ProjectionPeriod, RecurringItem } from "@/types/forecast";

/*
 * Why a monthly table does not show a column of identical numbers.
 *
 * Reported as two apparent faults: a month with no inflows at all, and outflows
 * that shift from month to month. Neither is a fault — the first is a partial
 * period at the end of the horizon, the second is a weekly item falling four or
 * five times in a month — but both looked like one, so the mechanism is pinned
 * here rather than left to be rediscovered.
 */

function recurring(
  name: string,
  direction: "INFLOW" | "OUTFLOW",
  amountCents: number,
  frequency: RecurringItem["frequency"],
  startDate: string,
): RecurringItem {
  return {
    id: `${name}-${frequency}`,
    name,
    direction,
    amountCents,
    frequency,
    startDate,
    category: direction === "INFLOW" ? "Salary" : "Housing",
    isActive: true,
  };
}

function makeForecast(overrides: Partial<Forecast> = {}): Forecast {
  return {
    id: "aggregate",
    name: "Aggregate",
    currency: "EUR",
    startingBalanceCents: 500_000,
    // Mid-month on purpose: this is what produces partial end periods.
    startDate: "2026-10-10",
    horizon: "TWELVE_MONTHS",
    recurringItems: [
      recurring("Salary", "INFLOW", 300_000, "MONTHLY", "2026-10-25"),
      recurring("Rent", "OUTFLOW", 120_000, "MONTHLY", "2026-10-01"),
      recurring("Groceries", "OUTFLOW", 40_000, "WEEKLY", "2026-10-05"),
    ],
    oneOffItems: [],
    invoices: [],
    createdAt: "2026-10-10T00:00:00.000Z",
    updatedAt: "2026-10-10T00:00:00.000Z",
    ...overrides,
  };
}

const monthsOf = (forecast: Forecast) =>
  aggregate(runProjection(forecast).days, "monthly", "en-GB");

/** Narrows the optional accessors once, so the assertions below read plainly. */
function edges(months: readonly ProjectionPeriod[]): [ProjectionPeriod, ProjectionPeriod] {
  const first = months[0];
  const last = months.at(-1);
  if (first === undefined || last === undefined) throw new Error("expected some months");
  return [first, last];
}

describe("partial periods at the edges of a horizon", () => {
  it("marks the first and last period and leaves the middle ones alone", () => {
    const months = monthsOf(makeForecast());
    const [first, last] = edges(months);

    expect(isPartialPeriod(first, "monthly")).toBe(true);
    expect(isPartialPeriod(last, "monthly")).toBe(true);

    // Everything between them covers a real calendar month.
    for (const month of months.slice(1, -1)) {
      expect(isPartialPeriod(month, "monthly"), `${month.startDate} should be whole`).toBe(false);
    }
  });

  it("explains a final month with no income at all without anything being wrong", () => {
    const months = monthsOf(makeForecast());
    const last = edges(months)[1];

    // The salary lands on the 25th and the horizon stops on the 9th, so this
    // stretch genuinely contains no pay. Reported as a bug; it is nine days.
    expect(periodDayCount(last)).toBe(9);
    expect(last.inflowCents).toBe(0);
    expect(last.outflowCents).toBeGreaterThan(0);

    // The whole horizon still contains every salary, so nothing is lost.
    const totalInflow = months.reduce((sum, month) => sum + month.inflowCents, 0);
    expect(totalInflow).toBe(12 * 300_000);
  });

  it("never reports a negative inflow, however much a month loses", () => {
    // A month can lose money without its income becoming negative — the loss is
    // in the net, and the two columns mean different things.
    const months = monthsOf(makeForecast());
    const losing = months.filter((month) => month.netCents < 0);

    expect(losing.length).toBeGreaterThan(0);
    for (const month of losing) {
      expect(month.inflowCents).toBeGreaterThanOrEqual(0);
      expect(month.outflowCents).toBeGreaterThanOrEqual(0);
    }
  });

  it("charges a weekly item four or five times, which is why outflows move", () => {
    const months = monthsOf(makeForecast());
    const groceries = 40_000;
    const rent = 120_000;

    const counts = months
      .slice(1, -1)
      .map((month) => (month.outflowCents - rent) / groceries);

    // Whole months hold either four or five groceries runs, and both happen.
    for (const count of counts) {
      expect([4, 5]).toContain(count);
    }
    expect(new Set(counts).size).toBe(2);
  });

  it("counts the days it claims to count", () => {
    const months = monthsOf(makeForecast());

    for (const month of months) {
      expect(periodDayCount(month)).toBe(daysBetween(month.startDate, month.endDate) + 1);
    }
  });
});
