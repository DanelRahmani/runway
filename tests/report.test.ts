import { describe, expect, it } from "vitest";

import { CATEGORY_COLUMNS, categoryTotalsToCsv } from "@/lib/csv";
import { describeDays } from "@/lib/dates";
import { aggregate } from "@/lib/forecast/aggregate";
import { categoryTotals, runProjection, runwayDays } from "@/lib/forecast/engine";
import { PRINT_COLUMNS, buildPrintSummary } from "@/lib/report/printSummary";
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
): RecurringItem {
  return {
    id: `r-${direction}-${amountCents}`,
    name: category,
    direction,
    amountCents,
    frequency: "MONTHLY",
    startDate: "2026-01-01",
    category,
    isActive: true,
  };
}

describe("printable summary", () => {
  it("does not name a runway length when nothing runs out", () => {
    const forecast = makeForecast({
      startingBalanceCents: 5_000_000,
      recurringItems: [recurring(200_000, "INFLOW", "Salary")],
    });
    const summary = buildPrintSummary(forecast, runProjection(forecast));

    const cashOut = summary.lines.find((line) => line.label === "Cash-out date");
    expect(cashOut?.value).toBe("No projected shortfall");
    expect(summary.lines.some((line) => line.label === "Runway from the start")).toBe(false);
  });

  it("quotes exactly the runway length the engine computes", () => {
    const forecast = makeForecast({
      startingBalanceCents: 100_000,
      recurringItems: [
        recurring(100_000, "INFLOW", "Salary"),
        recurring(400_000, "OUTFLOW", "Housing"),
      ],
    });
    const projection = runProjection(forecast);
    const runway = runwayDays(projection);
    const summary = buildPrintSummary(forecast, projection);

    expect(runway).not.toBeNull();
    const line = summary.lines.find((candidate) => candidate.label === "Runway from the start");
    // Derived from the same helper the KPI card uses, so the two cannot drift apart.
    expect(line?.value).toBe(describeDays(runway ?? 0));
  });

  it("keeps the monthly table in step with the aggregation", () => {
    const forecast = makeForecast({
      recurringItems: [
        recurring(300_000, "INFLOW", "Salary"),
        recurring(120_000, "OUTFLOW", "Housing"),
      ],
    });
    const projection = runProjection(forecast);
    const summary = buildPrintSummary(forecast, projection);

    expect(summary.columns).toEqual([...PRINT_COLUMNS]);
    expect(summary.rows).toHaveLength(aggregate(projection.days, "monthly").length);
    expect(summary.rows.every((row) => Object.keys(row).length === PRINT_COLUMNS.length)).toBe(true);
  });

  it("adds the goal line when a goal is set", () => {
    const forecast = makeForecast({
      goal: { label: "Japan", targetCents: 900_000, targetDate: "2026-06-01" },
    });
    const summary = buildPrintSummary(forecast, runProjection(forecast));

    expect(summary.lines.some((line) => line.label === "Goal — Japan")).toBe(true);
  });
});

describe("category totals export", () => {
  it("writes one row per total, with the direction spelled out rather than signed", () => {
    const forecast = makeForecast({
      oneOffItems: [
        {
          id: "in",
          name: "Salary",
          direction: "INFLOW",
          amountCents: 300_000,
          date: "2026-01-05",
          category: "Salary",
        },
        {
          id: "out",
          name: "Rent",
          direction: "OUTFLOW",
          amountCents: 100_000,
          date: "2026-01-06",
          category: "Housing",
        },
      ],
    });
    const totals = categoryTotals(runProjection(forecast));
    const lines = categoryTotalsToCsv(totals, "EUR").split("\r\n");

    expect(lines[0]).toBe(CATEGORY_COLUMNS.join(","));
    expect(lines).toHaveLength(totals.length + 1);

    // The amount field is quoted (it carries a thousands separator) and so contains
    // its own commas; the direction is the second field either way.
    const directions = lines.slice(1).map((line) => line.split(",")[1]);
    expect(directions).toContain("Inflow");
    expect(directions).toContain("Outflow");
  });
});
