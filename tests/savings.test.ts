import { describe, expect, it } from "vitest";

import { foldToDonutSlices } from "@/lib/donut";
import { runProjection } from "@/lib/forecast/engine";
import {
  compositionSeries,
  goalProgress,
  keptCurve,
  savingsSummary,
} from "@/lib/forecast/savings";
import type {
  Forecast,
  IsoDate,
  OneOffItem,
  RecurringItem,
} from "@/types/forecast";

function makeForecast(overrides: Partial<Forecast> = {}): Forecast {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: "forecast",
    name: "Test",
    currency: "EUR",
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

function recurring(
  amountCents: number,
  category: string,
  overrides: Partial<RecurringItem> = {},
): RecurringItem {
  return {
    id: overrides.id ?? `r-${category}-${amountCents}`,
    name: category,
    direction: overrides.direction ?? "OUTFLOW",
    amountCents,
    frequency: overrides.frequency ?? "MONTHLY",
    startDate: overrides.startDate ?? "2026-01-01",
    category,
    isActive: overrides.isActive ?? true,
  };
}

function oneOff(amountCents: number, category: string, date: IsoDate): OneOffItem {
  return {
    id: `o-${category}-${amountCents}`,
    name: category,
    direction: "OUTFLOW",
    amountCents,
    date,
    category,
  };
}

describe("savings summary", () => {
  const household = makeForecast({
    recurringItems: [
      recurring(300_000, "Salary", { direction: "INFLOW" }),
      recurring(100_000, "Housing"),
      recurring(50_000, "Savings"),
      recurring(25_000, "Investing"),
      recurring(40_000, "Tax"),
    ],
  });

  it("partitions outflow into kept, tax and spending", () => {
    const summary = savingsSummary(runProjection(household));

    expect(summary.keptCents).toBeGreaterThan(0);
    expect(summary.taxCents).toBeGreaterThan(0);
    expect(summary.spendingCents).toBeGreaterThan(0);
    // A partition: the three must reconstruct every outflow exactly.
    expect(summary.keptCents + summary.taxCents + summary.spendingCents).toBe(summary.outflowCents);
  });

  it("keeps tax out of spending", () => {
    const projection = runProjection(household);
    const summary = savingsSummary(projection);
    // Housing is the only genuine spending category, so spending must equal it.
    const housing = summary.keptByCategory.find((total) => total.category === "Housing");
    expect(housing).toBeUndefined();
    expect(summary.spendingCents).toBeGreaterThan(0);
    expect(summary.spendingCents).toBeLessThan(summary.outflowCents);
  });

  it("counts savings and investing as kept, largest first", () => {
    const summary = savingsSummary(runProjection(household));

    expect(summary.keptByCategory.map((total) => total.category)).toEqual(["Savings", "Investing"]);
    expect(summary.keptCents).toBe(
      summary.keptByCategory.reduce((sum, total) => sum + total.totalCents, 0),
    );
  });

  it("derives the savings rate from income", () => {
    const summary = savingsSummary(runProjection(household));

    expect(summary.inflowCents).toBeGreaterThan(0);
    expect(summary.savingsRate).toBeCloseTo(summary.keptCents / summary.inflowCents, 10);
  });

  it("reports an unknown rate rather than zero when there is no income", () => {
    const noIncome = makeForecast({ recurringItems: [recurring(10_000, "Housing")] });
    const summary = savingsSummary(runProjection(noIncome));

    expect(summary.inflowCents).toBe(0);
    // Null, not 0: "you kept none of nothing" would be a misleading zero.
    expect(summary.savingsRate).toBeNull();
  });

  it("turns the horizon into a monthly pace", () => {
    const single = makeForecast({ oneOffItems: [oneOff(60_000, "Savings", "2026-01-02")] });
    const summary = savingsSummary(runProjection(single));

    expect(summary.keptCents).toBe(60_000);
    // Thirteen weeks is a shade under three months, so the pace is about a third.
    expect(summary.monthlyKeptCents).toBeGreaterThan(19_000);
    expect(summary.monthlyKeptCents).toBeLessThan(21_000);
  });

  it("reports nothing set aside for a spending-only forecast", () => {
    const spending = makeForecast({ recurringItems: [recurring(10_000, "Housing")] });
    const summary = savingsSummary(runProjection(spending));

    expect(summary.keptCents).toBe(0);
    expect(summary.keptByCategory).toEqual([]);
    expect(summary.monthlyKeptCents).toBe(0);
  });

  it("ignores inactive items", () => {
    const paused = makeForecast({
      recurringItems: [recurring(50_000, "Savings", { isActive: false })],
    });

    expect(savingsSummary(runProjection(paused)).keptCents).toBe(0);
  });
});

describe("donut slices", () => {
  const slice = (label: string, cents: number) => ({ key: label, label, cents });

  it("drops empty slices", () => {
    const folded = foldToDonutSlices([slice("Spending", 100), slice("Tax", 0)]);

    expect(folded.map((entry) => entry.label)).toEqual(["Spending"]);
  });

  it("leaves a list within the cap alone", () => {
    const slices = Array.from({ length: 6 }, (_, index) => slice(`c${index}`, 10 - index));
    const folded = foldToDonutSlices(slices);

    expect(folded).toHaveLength(6);
    expect(folded.some((entry) => entry.label.startsWith("Other"))).toBe(false);
  });

  it("folds the tail into one Other slice without losing money", () => {
    const slices = Array.from({ length: 20 }, (_, index) => slice(`c${index}`, 100 - index));
    const folded = foldToDonutSlices(slices);

    expect(folded).toHaveLength(6);
    expect(folded[5]?.label).toBe("Other (15)");
    const total = (entries: readonly { cents: number }[]) =>
      entries.reduce((sum, entry) => sum + entry.cents, 0);
    expect(total(folded)).toBe(total(slices));
  });

  it("keeps the largest slices and folds the smallest", () => {
    const slices = [slice("big", 1000), slice("mid", 500), slice("tiny", 1)];
    const folded = foldToDonutSlices(slices, 2);

    expect(folded).toEqual([slice("big", 1000), { key: "other", label: "Other (2)", cents: 501 }]);
  });
});

describe("kept curve and goals", () => {
  const saver = makeForecast({ recurringItems: [recurring(50_000, "Savings")] });

  it("accumulates kept money without ever going down", () => {
    const values = keptCurve(runProjection(saver)).map((point) => point.cumulativeCents);

    expect(values.length).toBeGreaterThan(1);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(values.at(-1) ?? 0).toBeGreaterThan(0);
  });

  it("agrees with the savings summary on the total", () => {
    const projection = runProjection(saver);

    expect(keptCurve(projection).at(-1)?.cumulativeCents).toBe(savingsSummary(projection).keptCents);
  });

  it("counts only transfers, not spending", () => {
    // One-off items, so the totals are exactly what is written here. A recurring
    // item would fire several times across the horizon and make the assertion a
    // restatement of the recurrence rules rather than of this function.
    const withSpending = makeForecast({
      oneOffItems: [
        oneOff(50_000, "Housing", "2026-01-05"),
        oneOff(10_000, "Savings", "2026-01-05"),
      ],
    });
    const curve = keptCurve(runProjection(withSpending));

    expect(curve.at(-1)?.cumulativeCents).toBe(10_000);
  });

  it("reaches the target before its date when the plan allows", () => {
    const progress = goalProgress(runProjection(saver), {
      label: "Japan",
      targetCents: 50_000,
      targetDate: "2026-03-31",
    });

    expect(progress.onTrack).toBe(true);
    expect(progress.reachedDate).not.toBeNull();
    expect((progress.reachedDate ?? "") <= "2026-03-31").toBe(true);
    expect(progress.shortfallCents).toBe(0);
    expect(progress.fraction).toBe(1);
  });

  it("treats reaching the target after the deadline as late, not on track", () => {
    const progress = goalProgress(runProjection(saver), {
      label: "Japan",
      targetCents: 50_000,
      // Deliberately before the forecast starts, so nothing can land in time.
      targetDate: "2025-12-31",
    });

    expect(progress.reachedDate).not.toBeNull();
    expect(progress.onTrack).toBe(false);
  });

  it("refuses to claim on track when the date is beyond the horizon", () => {
    const progress = goalProgress(runProjection(saver), {
      label: "Deposit",
      targetCents: 10_000_000,
      targetDate: "2030-01-01",
    });

    expect(progress.inconclusive).toBe(true);
    expect(progress.onTrack).toBe(false);
    expect(progress.reachedDate).toBeNull();
    expect(progress.shortfallCents).toBeGreaterThan(0);
    expect(progress.fraction).toBeLessThan(1);
  });

  it("reports a goal the plan misses inside the horizon as simply not on track", () => {
    const progress = goalProgress(runProjection(saver), {
      label: "Deposit",
      targetCents: 10_000_000,
      targetDate: "2026-02-01",
    });

    expect(progress.inconclusive).toBe(false);
    expect(progress.onTrack).toBe(false);
    expect(progress.shortfallCents).toBe(10_000_000 - progress.keptCents);
  });
});

describe("composition over time", () => {
  const mixed = makeForecast({
    oneOffItems: [
      oneOff(50_000, "Housing", "2026-01-05"),
      oneOff(30_000, "Savings", "2026-01-06"),
      oneOff(20_000, "Tax", "2026-01-07"),
      oneOff(70_000, "Groceries", "2026-02-05"),
      oneOff(10_000, "Savings", "2026-02-06"),
    ],
  });

  it("splits each period into spending, kept and tax", () => {
    const january = compositionSeries(runProjection(mixed), "monthly").find(
      (period) => period.startDate === "2026-01-01",
    );

    expect(january?.spendingCents).toBe(50_000);
    expect(january?.keptCents).toBe(30_000);
    expect(january?.taxCents).toBe(20_000);
  });

  it("keeps periods apart instead of collapsing them into one total", () => {
    // This is the whole point of the chart: January and February must not merge.
    const february = compositionSeries(runProjection(mixed), "monthly").find(
      (period) => period.startDate === "2026-02-01",
    );

    expect(february?.spendingCents).toBe(70_000);
    expect(february?.keptCents).toBe(10_000);
    expect(february?.taxCents).toBe(0);
  });

  it("adds back up to the same totals as the flat summary", () => {
    const projection = runProjection(mixed);
    const periods = compositionSeries(projection, "monthly");
    const summary = savingsSummary(projection);
    const total = (pick: (period: (typeof periods)[number]) => number) =>
      periods.reduce((sum, period) => sum + pick(period), 0);

    expect(total((period) => period.spendingCents)).toBe(summary.spendingCents);
    expect(total((period) => period.keptCents)).toBe(summary.keptCents);
    expect(total((period) => period.taxCents)).toBe(summary.taxCents);
  });

  it("produces finer columns at finer granularity", () => {
    const projection = runProjection(mixed);
    const weekly = compositionSeries(projection, "weekly");
    const monthly = compositionSeries(projection, "monthly");

    expect(monthly.length).toBeGreaterThan(1);
    expect(weekly.length).toBeGreaterThan(monthly.length);
    expect(compositionSeries(projection, "daily")).toHaveLength(projection.days.length);
  });

  it("leaves periods with no outflows empty rather than negative", () => {
    const quiet = makeForecast({ oneOffItems: [oneOff(10_000, "Housing", "2026-03-05")] });
    const periods = compositionSeries(runProjection(quiet), "monthly");

    for (const period of periods) {
      expect(period.spendingCents).toBeGreaterThanOrEqual(0);
      expect(period.keptCents).toBeGreaterThanOrEqual(0);
      expect(period.taxCents).toBeGreaterThanOrEqual(0);
    }
  });
});
