import { describe, expect, it } from "vitest";

import { compareActuals } from "@/lib/forecast/actuals";
import { runProjection } from "@/lib/forecast/engine";
import type { Forecast } from "@/types/forecast";

function makeForecast(overrides: Partial<Forecast> = {}): Forecast {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: "forecast",
    name: "Household",
    currency: "EUR",
    // No items, so the plan predicts the same balance every day and each
    // expectation below can be read straight off the numbers recorded.
    startingBalanceCents: 100_000,
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

const withBalances = makeForecast({
  actuals: [
    { date: "2026-01-20", closingBalanceCents: 90_000 },
    { date: "2026-01-10", closingBalanceCents: 120_000 },
  ],
});

describe("plan versus reality", () => {
  it("measures each balance against what the plan said for that day", () => {
    const comparison = compareActuals(withBalances, runProjection(withBalances));

    expect(comparison.rows.map((row) => row.plannedCents)).toEqual([100_000, 100_000]);
    expect(comparison.rows.map((row) => row.varianceCents)).toEqual([20_000, -10_000]);
  });

  it("orders them by date, however they were recorded", () => {
    const comparison = compareActuals(withBalances, runProjection(withBalances));

    expect(comparison.rows.map((row) => row.date)).toEqual(["2026-01-10", "2026-01-20"]);
  });

  it("reports the drift so far and the newest comparison as different things", () => {
    const comparison = compareActuals(withBalances, runProjection(withBalances));

    // The sum says how far off the plan has been; the newest says where it stands.
    // They point opposite ways here, which is exactly why both are reported.
    expect(comparison.totalVarianceCents).toBe(10_000);
    expect(comparison.latestVarianceCents).toBe(-10_000);
  });

  it("refuses to invent a plan for a date outside the horizon", () => {
    const beyond = makeForecast({
      actuals: [{ date: "2027-06-01", closingBalanceCents: 50_000 }],
    });
    const comparison = compareActuals(beyond, runProjection(beyond));

    expect(comparison.rows[0]?.plannedCents).toBeNull();
    expect(comparison.rows[0]?.varianceCents).toBeNull();
    // And a comparison that cannot be made is left out of the totals rather than
    // counted as a zero.
    expect(comparison.totalVarianceCents).toBe(0);
    expect(comparison.latestVarianceCents).toBeNull();
  });

  it("has nothing to say before anything has been recorded", () => {
    const untouched = makeForecast();
    const comparison = compareActuals(untouched, runProjection(untouched));

    expect(comparison.rows).toEqual([]);
    expect(comparison.totalVarianceCents).toBe(0);
    expect(comparison.latestVarianceCents).toBeNull();
  });

  it("never mutates the forecast it was handed", () => {
    const snapshot = structuredClone(withBalances);
    compareActuals(withBalances, runProjection(withBalances));

    expect(withBalances).toEqual(snapshot);
  });
});
