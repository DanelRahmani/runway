import { describe, expect, it } from "vitest";

import { runProjection } from "@/lib/forecast/engine";
import { costUpliftSensitivity } from "@/lib/forecast/sensitivity";
import type { Forecast, RecurringItem } from "@/types/forecast";

function makeForecast(overrides: Partial<Forecast> = {}): Forecast {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: "forecast",
    name: "Household",
    currency: "EUR",
    startingBalanceCents: 500_000,
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

const household = makeForecast({
  startingBalanceCents: 300_000,
  recurringItems: [
    recurring(280_000, "INFLOW", "Salary"),
    recurring(115_000, "OUTFLOW", "Housing"),
    recurring(40_000, "OUTFLOW", "Groceries", "WEEKLY"),
  ],
});

describe("cost uplift sensitivity", () => {
  it("starts from the forecast exactly as it stands", () => {
    const base = runProjection(household).summary;
    const { rows } = costUpliftSensitivity(household);
    const first = rows[0];

    expect(first?.percent).toBe(0);
    expect(first?.extraMonthlyCents).toBe(0);
    expect(first?.endingBalanceCents).toBe(base.endingBalanceCents);
    expect(first?.minimumBalanceCents).toBe(base.minimumBalanceCents);
    expect(first?.cashOutDate).toBe(base.cashOutDate);
  });

  it("never lets a higher cost improve the plan", () => {
    // A property rather than arithmetic: adding a cost can only move the balance
    // down, so the table must read top to bottom as a worsening. If this ever
    // fails, the whole table is telling the wrong story.
    const { rows } = costUpliftSensitivity(household);

    for (const [index, row] of rows.entries()) {
      const previous = rows[index - 1];
      if (previous === undefined) continue;
      expect(row.endingBalanceCents).toBeLessThanOrEqual(previous.endingBalanceCents);
      expect(row.minimumBalanceCents).toBeLessThanOrEqual(previous.minimumBalanceCents);
    }
  });

  it("asks for more money at every step", () => {
    const { rows } = costUpliftSensitivity(household);

    for (const [index, row] of rows.entries()) {
      const previous = rows[index - 1];
      if (previous === undefined) continue;
      expect(row.extraMonthlyCents).toBeGreaterThan(previous.extraMonthlyCents);
    }
  });

  it("measures the base from the projection rather than the item amounts", () => {
    // A weekly cost is not one payment a month. Reading the weekly 100 as a
    // monthly 100 would understate the base several times over, so this is
    // bounded rather than restated: a weekly occurrence lands ~4.3 times a month.
    const weekly = makeForecast({
      recurringItems: [recurring(10_000, "OUTFLOW", "Groceries", "WEEKLY")],
    });
    const { baseMonthlyOutflowCents } = costUpliftSensitivity(weekly);

    expect(baseMonthlyOutflowCents).toBeGreaterThan(40_000);
    expect(baseMonthlyOutflowCents).toBeLessThan(46_000);
  });

  it("collapses to a single figure when nothing is going out", () => {
    const incomeOnly = makeForecast({
      recurringItems: [recurring(300_000, "INFLOW", "Salary")],
    });
    const { baseMonthlyOutflowCents, rows } = costUpliftSensitivity(incomeOnly);

    expect(baseMonthlyOutflowCents).toBe(0);
    expect(rows.every((row) => row.extraMonthlyCents === 0)).toBe(true);
  });

  it("never mutates the forecast it was handed", () => {
    const snapshot = structuredClone(household);
    costUpliftSensitivity(household);

    expect(household).toEqual(snapshot);
  });
});
