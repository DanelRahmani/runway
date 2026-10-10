import { describe, expect, it } from "vitest";

import { runProjection } from "@/lib/forecast/engine";
import { calendarMonths, type CalendarCell } from "@/lib/forecast/calendar";
import type { Forecast, RecurringItem } from "@/types/forecast";

function makeForecast(overrides: Partial<Forecast> = {}): Forecast {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: "forecast",
    name: "Household",
    currency: "EUR",
    startingBalanceCents: 300_000,
    // Mid-month on purpose: the first month is partial, which is the case that
    // gets a calendar's leading padding wrong.
    startDate: "2026-01-10",
    horizon: "SIX_MONTHS",
    recurringItems: [],
    oneOffItems: [],
    invoices: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function recurring(amountCents: number, direction: "INFLOW" | "OUTFLOW"): RecurringItem {
  return {
    id: `r-${direction}-${amountCents}`,
    name: direction,
    direction,
    amountCents,
    frequency: "MONTHLY",
    startDate: "2026-01-10",
    isActive: true,
  };
}

const days = runProjection(
  makeForecast({
    recurringItems: [recurring(280_000, "INFLOW"), recurring(115_000, "OUTFLOW")],
  }),
).days;

/** The days actually drawn, with the padding dropped. */
function drawnCells(): CalendarCell[] {
  return calendarMonths(days)
    .flatMap((month) => month.weeks.flat())
    .filter((cell): cell is CalendarCell => cell !== null);
}

describe("cash-flow calendar", () => {
  it("draws every day of the horizon exactly once, in order", () => {
    expect(drawnCells().map((cell) => cell.date)).toEqual(days.map((day) => day.date));
  });

  it("pads every week out to seven columns", () => {
    for (const month of calendarMonths(days)) {
      expect(month.weeks.length).toBeGreaterThan(0);
      for (const week of month.weeks) {
        expect(week).toHaveLength(7);
      }
    }
  });

  it("keeps each month's days inside that month", () => {
    for (const month of calendarMonths(days)) {
      for (const cell of month.weeks.flat()) {
        if (cell === null) continue;
        expect(cell.date.slice(0, 7)).toBe(month.key);
      }
    }
  });

  it("groups months in order, without repeating one", () => {
    const keys = calendarMonths(days).map((month) => month.key);

    expect(keys.length).toBeGreaterThan(1);
    expect(keys).toEqual([...keys].sort());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("labels every month", () => {
    for (const month of calendarMonths(days)) {
      expect(month.label).not.toBe("");
    }
  });

  it("handles an empty projection without inventing a month", () => {
    expect(calendarMonths([])).toEqual([]);
  });
});
