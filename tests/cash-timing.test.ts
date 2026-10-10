import { describe, expect, it } from "vitest";

import { buildLedger, runProjection } from "@/lib/forecast/engine";
import type { Forecast, RecurringItem } from "@/types/forecast";

/*
 * Two optional assumptions that change when money moves and how much of it moves.
 *
 * Both default to off, and the first test of each block exists to prove it: a
 * forecast saved before either existed has to project exactly as it did. That is
 * the whole risk with an engine change — a silent reshuffle of every existing
 * user's dates — so it is pinned rather than assumed.
 */

function makeForecast(overrides: Partial<Forecast> = {}): Forecast {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: "forecast",
    name: "Household",
    currency: "EUR",
    startingBalanceCents: 1_000_000,
    startDate: "2026-01-01",
    horizon: "TWELVE_MONTHS",
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
  startDate = "2026-01-01",
): RecurringItem {
  return {
    id: `r-${category}-${amountCents}`,
    name: category,
    direction,
    amountCents,
    frequency: "MONTHLY",
    startDate,
    category,
    isActive: true,
  };
}

/** Outflow amounts landing on one date, keyed by item name. */
function outflowsOn(forecast: Forecast, date: string): Map<string, number> {
  const ledger = buildLedger(forecast, forecast.startDate, "2026-12-31");
  const bucket = ledger.get(date);
  return new Map((bucket?.outflows ?? []).map((entry) => [entry.label, entry.amountCents]));
}

describe("weekend-aware cash timing", () => {
  const onASaturday = makeForecast({
    // 3 January 2026 is a Saturday.
    recurringItems: [recurring(50_000, "OUTFLOW", "Housing", "2026-01-03")],
  });

  it("changes nothing at all when the option is off", () => {
    expect(outflowsOn(onASaturday, "2026-01-03").get("Housing")).toBe(50_000);
    expect(outflowsOn(onASaturday, "2026-01-05").get("Housing")).toBeUndefined();
  });

  it("moves a weekend date to the Monday when it is on", () => {
    const shifted = makeForecast({
      weekendShifting: true,
      recurringItems: [recurring(50_000, "OUTFLOW", "Housing", "2026-01-03")],
    });

    expect(outflowsOn(shifted, "2026-01-03").get("Housing")).toBeUndefined();
    expect(outflowsOn(shifted, "2026-01-05").get("Housing")).toBe(50_000);
  });

  it("moves an expected invoice the same way, because it is a schedule too", () => {
    const withInvoice = makeForecast({
      weekendShifting: true,
      // 4 January 2026 is a Sunday.
      invoices: [
        {
          id: "inv",
          clientName: "Acme",
          amountCents: 200_000,
          issueDate: "2025-12-20",
          expectedPaymentDate: "2026-01-04",
          paymentDelayDays: 0,
          status: "EXPECTED",
          recurrence: "NONE",
        },
      ],
    });

    const ledger = buildLedger(withInvoice, "2026-01-01", "2026-12-31");
    expect(ledger.get("2026-01-04")?.inflows).toHaveLength(0);
    expect(ledger.get("2026-01-05")?.inflows).toHaveLength(1);
  });

  it("leaves a one-off alone, because its date was chosen rather than scheduled", () => {
    const withOneOff = makeForecast({
      weekendShifting: true,
      oneOffItems: [
        {
          id: "holiday",
          name: "Holiday",
          direction: "OUTFLOW",
          amountCents: 120_000,
          date: "2026-01-03",
          category: "Travel",
        },
      ],
    });

    // Moving it would contradict the date printed in its own table row.
    expect(outflowsOn(withOneOff, "2026-01-03").get("Holiday")).toBe(120_000);
  });
});

describe("seasonality", () => {
  const decemberIsDouble = makeForecast({
    seasonalCostPercent: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 200],
    recurringItems: [
      recurring(100_000, "OUTFLOW", "Housing"),
      recurring(50_000, "OUTFLOW", "Savings"),
      recurring(30_000, "OUTFLOW", "Tax"),
      recurring(20_000, "INFLOW", "Salary"),
    ],
  });

  it("scales a running cost in the month it names", () => {
    expect(outflowsOn(decemberIsDouble, "2026-12-01").get("Housing")).toBe(200_000);
    expect(outflowsOn(decemberIsDouble, "2026-11-01").get("Housing")).toBe(100_000);
  });

  it("leaves a transfer, tax and income alone", () => {
    // A transfer is not a cost, tax is not the user's to vary, and an invoice is
    // income — seasonality is about the level of routine spending, nothing else.
    const december = outflowsOn(decemberIsDouble, "2026-12-01");
    expect(december.get("Savings")).toBe(50_000);
    expect(december.get("Tax")).toBe(30_000);

    const ledger = buildLedger(decemberIsDouble, "2026-01-01", "2026-12-31");
    expect(ledger.get("2026-12-01")?.inflows[0]?.amountCents).toBe(20_000);
  });

  it("is a no-op when every month is normal", () => {
    const neutral = makeForecast({
      seasonalCostPercent: Array.from({ length: 12 }, () => 100),
      recurringItems: [recurring(100_000, "OUTFLOW", "Housing")],
    });
    const absent = makeForecast({
      recurringItems: [recurring(100_000, "OUTFLOW", "Housing")],
    });

    for (const date of ["2026-01-01", "2026-07-01", "2026-12-01"]) {
      expect(outflowsOn(neutral, date).get("Housing")).toBe(
        outflowsOn(absent, date).get("Housing"),
      );
    }
  });

  it("keeps the scaled amount a whole number of cents", () => {
    const odd = makeForecast({
      seasonalCostPercent: [100, 100, 100, 100, 100, 100, 150, 100, 100, 100, 100, 100],
      recurringItems: [recurring(33_333, "OUTFLOW", "Housing")],
    });

    // 33_333 × 150% is 49_999.5 cents, which is not a number the ledger can hold.
    const amounts = [...outflowsOn(odd, "2026-07-01").values()];
    expect(amounts).toHaveLength(1);
    expect(Number.isInteger(amounts[0])).toBe(true);
    // Every amount in every bucket, not only the one deliberately chosen.
    const everyEntry = runProjection(odd).days.flatMap((day) => day.entries);
    for (const entry of everyEntry) {
      expect(Number.isInteger(entry.amountCents)).toBe(true);
    }
  });
});
