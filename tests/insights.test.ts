import { describe, expect, it } from "vitest";

import { runProjection } from "@/lib/forecast/engine";
import { insights, staleness } from "@/lib/forecast/insights";
import { formatCents } from "@/lib/money";
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
  overrides: Partial<RecurringItem> = {},
): RecurringItem {
  return {
    id: overrides.id ?? `r-${category}-${amountCents}`,
    name: overrides.name ?? category,
    direction,
    amountCents,
    frequency: overrides.frequency ?? "MONTHLY",
    startDate: overrides.startDate ?? "2026-01-01",
    category,
    isActive: overrides.isActive ?? true,
  };
}

const comfortable = makeForecast({
  startingBalanceCents: 900_000,
  recurringItems: [
    recurring(300_000, "INFLOW", "Salary"),
    recurring(100_000, "OUTFLOW", "Housing"),
  ],
});

const squeezed = makeForecast({
  startingBalanceCents: 50_000,
  recurringItems: [
    recurring(100_000, "INFLOW", "Salary"),
    recurring(150_000, "OUTFLOW", "Housing"),
  ],
});

describe("insights", () => {
  it("says when cash runs out, and how long for", () => {
    const found = insights(squeezed, runProjection(squeezed));
    const line = found.find((insight) => insight.id === "cash-out");

    expect(line).toBeDefined();
    expect(line?.tone).toBe("negative");
    expect(line?.text).toContain("below zero");
  });

  it("says when nothing runs out, and names the thinnest day", () => {
    const projection = runProjection(comfortable);
    const found = insights(comfortable, projection);
    const line = found.find((insight) => insight.id === "no-cash-out");

    expect(line?.tone).toBe("positive");
    expect(found.some((insight) => insight.id === "cash-out")).toBe(false);
    // The figure quoted is the engine's own, not a second opinion about it.
    expect(line?.text).toContain(formatCents(projection.summary.minimumBalanceCents, "EUR"));
  });

  it("names the thinnest month once there is more than one to compare", () => {
    const found = insights(comfortable, runProjection(comfortable));

    expect(found.some((insight) => insight.id === "thinnest-month")).toBe(true);
  });

  it("reports no savings rate when there is no income to divide by", () => {
    const spendingOnly = makeForecast({
      recurringItems: [recurring(50_000, "OUTFLOW", "Housing")],
    });
    const found = insights(spendingOnly, runProjection(spendingOnly));

    expect(found.some((insight) => insight.id === "no-income")).toBe(true);
    expect(found.some((insight) => insight.id === "savings-rate")).toBe(false);
  });

  it("reports the savings rate when there is one", () => {
    const saver = makeForecast({
      recurringItems: [
        recurring(300_000, "INFLOW", "Salary"),
        recurring(60_000, "OUTFLOW", "Savings"),
      ],
    });
    const found = insights(saver, runProjection(saver));
    const line = found.find((insight) => insight.id === "savings-rate");

    expect(line?.tone).toBe("positive");
  });

  it("flags an active item that never lands in the horizon", () => {
    // The mistake this catches is silent: the item is ticked, it looks real in the
    // table, and it changes nothing.
    const withFutureItem = makeForecast({
      startingBalanceCents: 900_000,
      recurringItems: [
        recurring(300_000, "INFLOW", "Salary"),
        recurring(20_000, "OUTFLOW", "Gym", { id: "gym", startDate: "2027-06-01" }),
      ],
    });
    const line = insights(withFutureItem, runProjection(withFutureItem)).find(
      (insight) => insight.id === "silent-items",
    );

    expect(line).toBeDefined();
    expect(line?.text).toContain("One active item");
    expect(line?.text).toContain("Gym");
  });

  it("ignores items that are switched off", () => {
    const inactive = makeForecast({
      startingBalanceCents: 900_000,
      recurringItems: [
        recurring(300_000, "INFLOW", "Salary"),
        recurring(20_000, "OUTFLOW", "Gym", { id: "gym", startDate: "2027-06-01", isActive: false }),
      ],
    });

    expect(
      insights(inactive, runProjection(inactive)).some((insight) => insight.id === "silent-items"),
    ).toBe(false);
  });

  it("says the same thing twice, because it is arithmetic and not a guess", () => {
    const projection = runProjection(comfortable);

    expect(insights(comfortable, projection)).toEqual(insights(comfortable, projection));
  });

  it("always has something to say", () => {
    const bare = makeForecast({ recurringItems: [] });

    expect(insights(bare, runProjection(bare)).length).toBeGreaterThan(0);
  });
});

describe("staleness", () => {
  const forecast = makeForecast({ updatedAt: "2026-01-01T09:30:00.000Z" });

  it("stays quiet while the forecast is recent", () => {
    expect(staleness(forecast, "2026-01-20")).toBeNull();
  });

  it("speaks up once it has sat long enough, and says how long", () => {
    const line = staleness(forecast, "2026-03-01");

    expect(line).not.toBeNull();
    expect(line?.text).toContain("59 days");
  });

  it("is quiet on the last day under the threshold and speaks on the thirtieth", () => {
    // Off by one here means a nudge that arrives a day early or never at all.
    expect(staleness(forecast, "2026-01-30")).toBeNull();
    expect(staleness(forecast, "2026-01-31")).not.toBeNull();
  });
});
