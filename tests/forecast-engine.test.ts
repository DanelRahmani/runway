import { describe, expect, it } from "vitest";

import { addMonths, daysBetween, eachDay, horizonEndDate } from "@/lib/dates";
import { aggregate } from "@/lib/forecast/aggregate";
import {
  categoryTotals,
  impactFor,
  itemImpact,
  runProjection,
  INVOICE_CATEGORY,
  UNCATEGORISED,
} from "@/lib/forecast/engine";
import { recurringOccurrences } from "@/lib/forecast/recurrence";
import { compareProjections, describeScenarioImpact } from "@/lib/forecast/scenarios";
import {
  assertIntegerCents,
  centsToDecimalString,
  formatCents,
  parseDecimalToCents,
  sumCents,
} from "@/lib/money";
import { createStarterForecast, defaultForecastName } from "@/lib/sample";
import { validateForecast } from "@/lib/validation";
import type { Forecast, Frequency, RecurringItem } from "@/types/forecast";

function makeForecast(overrides: Partial<Forecast> = {}): Forecast {
  return {
    id: "forecast-1",
    name: "Test forecast",
    currency: "EUR",
    startingBalanceCents: 200_000,
    startDate: "2026-01-01",
    horizon: "THIRTEEN_WEEKS",
    recurringItems: [],
    oneOffItems: [],
    invoices: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeRecurring(overrides: Partial<RecurringItem> = {}): RecurringItem {
  return {
    id: "item-1",
    name: "Item",
    direction: "OUTFLOW",
    amountCents: 10_000,
    frequency: "MONTHLY",
    startDate: "2026-01-01",
    isActive: true,
    ...overrides,
  };
}

function occurrences(frequency: Frequency, anchor: string, end: string, endDate?: string): string[] {
  return recurringOccurrences(anchor, frequency, {
    rangeStart: anchor,
    rangeEnd: end,
    endDate,
  });
}

/* ------------------------------------------------------------- recurrence -- */

describe("weekly recurrence", () => {
  it("fires every seven days from the anchor", () => {
    expect(occurrences("WEEKLY", "2026-01-01", "2026-01-29")).toEqual([
      "2026-01-01",
      "2026-01-08",
      "2026-01-15",
      "2026-01-22",
      "2026-01-29",
    ]);
  });

  it("stops at the end date when one is given", () => {
    expect(occurrences("WEEKLY", "2026-01-01", "2026-03-01", "2026-01-15")).toEqual([
      "2026-01-01",
      "2026-01-08",
      "2026-01-15",
    ]);
  });
});

describe("biweekly recurrence", () => {
  it("fires every fourteen days", () => {
    expect(occurrences("BIWEEKLY", "2026-01-01", "2026-02-12")).toEqual([
      "2026-01-01",
      "2026-01-15",
      "2026-01-29",
      "2026-02-12",
    ]);
  });

  it("does not drift into a weekly rhythm over a long horizon", () => {
    const dates = occurrences("BIWEEKLY", "2026-01-01", "2026-12-31");
    expect(dates).toHaveLength(27);
    // Every consecutive pair is exactly 14 days apart.
    for (let index = 1; index < dates.length; index += 1) {
      expect(daysBetween(dates[index - 1] ?? "", dates[index] ?? "")).toBe(14);
    }
  });
});

describe("monthly recurrence across month lengths", () => {
  it("keeps the 31st and clamps to the last day of short months", () => {
    const dates = occurrences("MONTHLY", "2026-01-31", "2026-12-31");

    expect(dates).toEqual([
      "2026-01-31",
      "2026-02-28", // 2026 is not a leap year
      "2026-03-31", // and back to the 31st, not stuck on the 28th
      "2026-04-30",
      "2026-05-31",
      "2026-06-30",
      "2026-07-31",
      "2026-08-31",
      "2026-09-30",
      "2026-10-31",
      "2026-11-30",
      "2026-12-31",
    ]);
  });

  it("uses 29 February in a leap year", () => {
    expect(occurrences("MONTHLY", "2024-01-31", "2024-03-31")).toEqual([
      "2024-01-31",
      "2024-02-29",
      "2024-03-31",
    ]);
  });

  it("handles a 30th anchor without spilling into the next month", () => {
    expect(occurrences("MONTHLY", "2026-01-30", "2026-04-30")).toEqual([
      "2026-01-30",
      "2026-02-28",
      "2026-03-30",
      "2026-04-30",
    ]);
  });
});

describe("quarterly recurrence", () => {
  it("fires every three months on the anchor day", () => {
    expect(occurrences("QUARTERLY", "2026-01-15", "2026-12-31")).toEqual([
      "2026-01-15",
      "2026-04-15",
      "2026-07-15",
      "2026-10-15",
    ]);
  });
});

describe("yearly recurrence", () => {
  it("fires once a year", () => {
    expect(occurrences("YEARLY", "2026-03-01", "2027-12-31")).toEqual([
      "2026-03-01",
      "2027-03-01",
    ]);
  });

  it("clamps a 29 February anchor to 28 February in a non-leap year", () => {
    expect(occurrences("YEARLY", "2024-02-29", "2025-12-31")).toEqual([
      "2024-02-29",
      "2025-02-28",
    ]);
  });
});

describe("recurrence range handling", () => {
  it("ignores occurrences before the forecast starts rather than banking them", () => {
    const item = makeRecurring({ frequency: "MONTHLY", startDate: "2024-01-01" });
    const projection = runProjection(makeForecast({ recurringItems: [item] }));

    // The item has been running for two years, but only the four occurrences
    // inside the 91-day horizon count: 1 Jan, 1 Feb, 1 Mar, 1 Apr 2026.
    expect(projection.summary.totalOutflowCents).toBe(40_000);
    const chargedDays = projection.days.filter((day) => day.outflowCents > 0);
    expect(chargedDays.map((day) => day.date)).toEqual([
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
      "2026-04-01",
    ]);
  });

  it("counts nothing when the item starts after the horizon ends", () => {
    const item = makeRecurring({ startDate: "2030-01-01" });
    const projection = runProjection(makeForecast({ recurringItems: [item] }));
    expect(projection.summary.totalOutflowCents).toBe(0);
  });

  it("skips inactive items entirely", () => {
    const item = makeRecurring({ isActive: false });
    const projection = runProjection(makeForecast({ recurringItems: [item] }));
    expect(projection.summary.totalOutflowCents).toBe(0);
  });
});

describe("addMonths month-end clamping", () => {
  it("clamps rather than overflowing", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2026-03-31", 1)).toBe("2026-04-30");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-15");
  });
});

/* ---------------------------------------------------------------- horizon -- */

describe("horizon length", () => {
  it("covers 91 inclusive days for thirteen weeks", () => {
    const end = horizonEndDate("2026-01-01", "THIRTEEN_WEEKS");
    expect(end).toBe("2026-04-01");
    expect(eachDay("2026-01-01", end)).toHaveLength(91);
  });

  it("covers a full six months inclusive", () => {
    expect(horizonEndDate("2026-01-01", "SIX_MONTHS")).toBe("2026-06-30");
  });

  it("covers a full twelve months inclusive", () => {
    expect(horizonEndDate("2026-01-01", "TWELVE_MONTHS")).toBe("2026-12-31");
  });

  it("keeps the last day of the final month when the anniversary clamps", () => {
    // 29 Feb 2024 + 12 months clamps to 28 Feb 2025, which IS the last day of
    // that month — the horizon must not lose it.
    expect(horizonEndDate("2024-02-29", "TWELVE_MONTHS")).toBe("2025-02-28");
    expect(horizonEndDate("2024-08-31", "SIX_MONTHS")).toBe("2025-02-28");
  });
});

/* -------------------------------------------------------- running balance -- */

describe("running balance", () => {
  it("carries opening to closing across every day and reconciles to the summary", () => {
    const forecast = makeForecast({
      startingBalanceCents: 100_000,
      recurringItems: [makeRecurring({ amountCents: 25_000, frequency: "MONTHLY" })],
    });
    const projection = runProjection(forecast);

    expect(projection.days).toHaveLength(91);
    expect(projection.days[0]?.openingCents).toBe(100_000);
    expect(projection.days[0]?.closingCents).toBe(75_000);

    for (let index = 1; index < projection.days.length; index += 1) {
      const previous = projection.days[index - 1];
      const current = projection.days[index];
      // Each day opens exactly where the previous one closed.
      expect(current?.openingCents).toBe(previous?.closingCents);
      expect(current?.netCents).toBe((current?.inflowCents ?? 0) - (current?.outflowCents ?? 0));
      expect(current?.closingCents).toBe((current?.openingCents ?? 0) + (current?.netCents ?? 0));
    }

    const first = projection.days[0];
    expect(projection.summary.endingBalanceCents).toBe(
      projection.days[projection.days.length - 1]?.closingCents,
    );
    // A monthly €250 charge fires on 1 Jan, 1 Feb, 1 Mar and 1 Apr.
    expect(projection.summary.totalOutflowCents).toBe(100_000);
    expect(first?.openingCents).toBe(projection.summary.startingBalanceCents);
  });

  it("applies a one-off item on its exact date", () => {
    const forecast = makeForecast({
      oneOffItems: [
        {
          id: "one-1",
          name: "Laptop",
          direction: "OUTFLOW",
          amountCents: 200_000,
          date: "2026-01-10",
        },
      ],
    });
    const projection = runProjection(forecast);

    const onDate = projection.days.find((day) => day.date === "2026-01-10");
    expect(onDate?.outflowCents).toBe(200_000);
    expect(onDate?.closingCents).toBe(0);

    // Nothing before it, and the balance is flat afterwards.
    expect(projection.days.find((day) => day.date === "2026-01-09")?.closingCents).toBe(200_000);
    expect(projection.days.find((day) => day.date === "2026-01-11")?.closingCents).toBe(0);
  });

  it("drops one-off items outside the horizon", () => {
    const forecast = makeForecast({
      oneOffItems: [
        {
          id: "one-1",
          name: "Too late",
          direction: "OUTFLOW",
          amountCents: 200_000,
          date: "2027-06-01",
        },
      ],
    });
    expect(runProjection(forecast).summary.totalOutflowCents).toBe(0);
  });
});

/* ------------------------------------------------------- negative balance -- */

describe("negative balance detection", () => {
  it("reports the first date the balance goes below zero", () => {
    // €2,000 opening, €600 out on the 1st of each month.
    // Jan 1 → 1,400 · Feb 1 → 800 · Mar 1 → 200 · Apr 1 → −400
    const forecast = makeForecast({
      startingBalanceCents: 200_000,
      recurringItems: [makeRecurring({ amountCents: 60_000, frequency: "MONTHLY" })],
    });
    const { summary } = runProjection(forecast);

    expect(summary.cashOutDate).toBe("2026-04-01");
    expect(summary.minimumBalanceCents).toBe(-40_000);
    expect(summary.minimumBalanceDate).toBe("2026-04-01");
    expect(summary.endingBalanceCents).toBe(-40_000);
    expect(summary.shortfallDays).toBe(1);
  });

  it("reports no shortfall when the balance never dips below zero", () => {
    const forecast = makeForecast({
      startingBalanceCents: 1_000_000,
      recurringItems: [makeRecurring({ amountCents: 10_000 })],
    });
    const { summary } = runProjection(forecast);

    expect(summary.cashOutDate).toBeNull();
    expect(summary.shortfallDays).toBe(0);
    expect(summary.minimumBalanceCents).toBeGreaterThan(0);
  });

  it("treats a balance of exactly zero as not yet out of cash", () => {
    const forecast = makeForecast({
      startingBalanceCents: 10_000,
      oneOffItems: [
        {
          id: "one-1",
          name: "Exactly everything",
          direction: "OUTFLOW",
          amountCents: 10_000,
          date: "2026-01-05",
        },
      ],
    });
    const { summary } = runProjection(forecast);

    expect(summary.minimumBalanceCents).toBe(0);
    expect(summary.cashOutDate).toBeNull();
  });

  it("finds the minimum across the whole horizon, not just the end", () => {
    // Monthly €1,000 in, with a €4,800 one-off hit in February.
    // 1 Jan → 6,000 · 1 Feb → 2,200 · 1 Mar → 3,200 · 1 Apr → 4,200
    const forecast = makeForecast({
      startingBalanceCents: 500_000,
      oneOffItems: [
        {
          id: "one-1",
          name: "Big hit",
          direction: "OUTFLOW",
          amountCents: 480_000,
          date: "2026-02-01",
        },
      ],
      recurringItems: [
        makeRecurring({ amountCents: 100_000, frequency: "MONTHLY", direction: "INFLOW" }),
      ],
    });
    const { summary } = runProjection(forecast);

    expect(summary.minimumBalanceDate).toBe("2026-02-01");
    expect(summary.minimumBalanceCents).toBe(220_000);
    // The trough is mid-horizon, so the ending balance is higher than the minimum.
    expect(summary.endingBalanceCents).toBe(420_000);
    expect(summary.endingBalanceCents).toBeGreaterThan(summary.minimumBalanceCents);
    expect(summary.cashOutDate).toBeNull();
  });
});

/* ------------------------------------------------------------- invoices -- */

describe("invoice payment delay", () => {
  it("projects on expected payment date plus the delay", () => {
    const forecast = makeForecast({
      startDate: "2026-01-01",
      horizon: "SIX_MONTHS",
      invoices: [
        {
          id: "inv-1",
          clientName: "Northwind",
          amountCents: 300_000,
          issueDate: "2026-01-01",
          expectedPaymentDate: "2026-02-10",
          paymentDelayDays: 30,
          status: "EXPECTED",
          recurrence: "NONE",
        },
      ],
    });
    const projection = runProjection(forecast);

    expect(projection.summary.totalInflowCents).toBe(300_000);
    // 2026-02-10 + 30 days = 2026-03-12, NOT the issue date and NOT the expected date.
    expect(projection.days.find((day) => day.date === "2026-03-12")?.inflowCents).toBe(300_000);
    expect(projection.days.find((day) => day.date === "2026-02-10")?.inflowCents).toBe(0);
    expect(projection.days.find((day) => day.date === "2026-01-01")?.inflowCents).toBe(0);
  });

  it("uses the expected date itself when the delay is zero", () => {
    const forecast = makeForecast({
      horizon: "SIX_MONTHS",
      invoices: [
        {
          id: "inv-1",
          clientName: "Acme",
          amountCents: 100_000,
          issueDate: "2026-01-01",
          expectedPaymentDate: "2026-02-10",
          paymentDelayDays: 0,
          status: "EXPECTED",
          recurrence: "NONE",
        },
      ],
    });
    const projection = runProjection(forecast);
    expect(projection.days.find((day) => day.date === "2026-02-10")?.inflowCents).toBe(100_000);
  });

  it("keeps a late invoice from rescuing the month it slips past", () => {
    const invoice = {
      id: "inv-1",
      clientName: "Northwind",
      amountCents: 150_000,
      issueDate: "2026-01-01",
      expectedPaymentDate: "2026-02-01",
      paymentDelayDays: 0,
      status: "EXPECTED",
      recurrence: "NONE",
    } as const;

    // €2,500 opening, €1,000 out every month: without the invoice, cash runs
    // out on 1 March. An on-time €1,500 on 1 Feb bridges the February dip and
    // the balance never goes negative at all.
    const onTime = makeForecast({
      startingBalanceCents: 250_000,
      recurringItems: [makeRecurring({ amountCents: 100_000, frequency: "MONTHLY" })],
      invoices: [invoice],
    });
    const late = makeForecast({
      startingBalanceCents: 250_000,
      recurringItems: [makeRecurring({ amountCents: 100_000, frequency: "MONTHLY" })],
      invoices: [{ ...invoice, paymentDelayDays: 30 }],
    });

    const onTimeSummary = runProjection(onTime).summary;
    const lateSummary = runProjection(late).summary;

    expect(onTimeSummary.cashOutDate).toBeNull();
    expect(lateSummary.cashOutDate).toBe("2026-03-01");
    // The late payment arrives on 3 March, so 1 and 2 March are spent overdrawn
    // before it lands. The month recovers, but the dip was real.
    expect(lateSummary.shortfallDays).toBe(2);
    expect(lateSummary.minimumBalanceCents).toBe(-50_000);
    expect(lateSummary.minimumBalanceDate).toBe("2026-03-01");
    expect(lateSummary.endingBalanceCents).toBe(0);
  });

  it("ignores paid and cancelled invoices", () => {
    const base = {
      clientName: "Acme",
      amountCents: 100_000,
      issueDate: "2026-01-01",
      expectedPaymentDate: "2026-02-10",
      paymentDelayDays: 0,
      recurrence: "NONE" as const,
    };

    const forecast = makeForecast({
      horizon: "SIX_MONTHS",
      invoices: [
        { id: "inv-1", ...base, status: "PAID" },
        { id: "inv-2", ...base, status: "CANCELLED" },
      ],
    });

    expect(runProjection(forecast).summary.totalInflowCents).toBe(0);
  });

  it("repeats a recurring invoice on its own schedule", () => {
    const forecast = makeForecast({
      startDate: "2026-01-01",
      horizon: "SIX_MONTHS",
      invoices: [
        {
          id: "inv-1",
          clientName: "Retainer",
          amountCents: 50_000,
          issueDate: "2026-01-01",
          expectedPaymentDate: "2026-01-15",
          paymentDelayDays: 0,
          status: "EXPECTED",
          recurrence: "MONTHLY",
        },
      ],
    });
    const { summary } = runProjection(forecast);
    // Jan, Feb, Mar, Apr, May, Jun → six payments inside a six-month horizon.
    expect(summary.totalInflowCents).toBe(300_000);
  });
});

/* ---------------------------------------------------------------- mixing -- */

describe("mixed inflow and outflow", () => {
  it("nets income and expenses on the same day", () => {
    const forecast = makeForecast({
      startingBalanceCents: 100_000,
      recurringItems: [
        makeRecurring({ id: "in", name: "Retainer", direction: "INFLOW", amountCents: 250_000 }),
        makeRecurring({ id: "out", name: "Rent", direction: "OUTFLOW", amountCents: 135_000 }),
      ],
    });
    const projection = runProjection(forecast);
    const jan1 = projection.days[0];

    expect(jan1?.inflowCents).toBe(250_000);
    expect(jan1?.outflowCents).toBe(135_000);
    expect(jan1?.netCents).toBe(115_000);
    expect(jan1?.closingCents).toBe(215_000);
    expect(projection.summary.cashOutDate).toBeNull();
  });

  it("is deterministic: the same forecast always yields the same projection", () => {
    const forecast = makeForecast({
      recurringItems: [makeRecurring({ frequency: "BIWEEKLY", amountCents: 12_345 })],
      invoices: [
        {
          id: "inv-1",
          clientName: "Acme",
          amountCents: 99_999,
          issueDate: "2026-01-01",
          expectedPaymentDate: "2026-02-01",
          paymentDelayDays: 17,
          status: "EXPECTED",
          recurrence: "QUARTERLY",
        },
      ],
    });

    expect(JSON.stringify(runProjection(forecast))).toEqual(JSON.stringify(runProjection(forecast)));
  });
});

/* ------------------------------------------------------------- scenarios -- */

describe("scenario comparison", () => {
  const base = makeForecast({
    startingBalanceCents: 300_000,
    recurringItems: [
      makeRecurring({ id: "rent", name: "Rent", amountCents: 135_000, frequency: "MONTHLY" }),
    ],
  });

  it("reports a negative ending delta when the scenario adds an expense", () => {
    const scenario: Forecast = {
      ...base,
      recurringItems: [
        ...base.recurringItems,
        makeRecurring({
          id: "hire",
          name: "New hire",
          amountCents: 150_000,
          frequency: "MONTHLY",
        }),
      ],
    };

    const diff = compareProjections(base, scenario);

    expect(diff.totalOutflowDeltaCents).toBeGreaterThan(0);
    expect(diff.endingDeltaCents).toBeLessThan(0);
    expect(diff.minimumDeltaCents).toBeLessThan(0);
    // The extra €1,500/month brings the shortfall forward.
    expect(diff.cashOutDeltaDays).not.toBeNull();
    expect(diff.cashOutDeltaDays ?? 0).toBeLessThan(0);
  });

  it("reports zero delta when comparing a forecast with itself", () => {
    const diff = compareProjections(base, base);

    expect(diff.endingDeltaCents).toBe(0);
    expect(diff.minimumDeltaCents).toBe(0);
    expect(diff.totalInflowDeltaCents).toBe(0);
    expect(diff.totalOutflowDeltaCents).toBe(0);
    expect(diff.maxDivergenceCents).toBe(0);
  });

  it("reports the shortfall a late payer causes, and that pulling payment forward avoids it", () => {
    const late: Forecast = {
      ...base,
      startingBalanceCents: 250_000,
      recurringItems: [makeRecurring({ amountCents: 100_000, frequency: "MONTHLY" })],
      invoices: [
        {
          id: "inv-1",
          clientName: "Northwind",
          amountCents: 150_000,
          issueDate: "2026-01-01",
          expectedPaymentDate: "2026-02-01",
          paymentDelayDays: 30,
          status: "EXPECTED",
          recurrence: "NONE",
        },
      ],
    };
    const firstInvoice = late.invoices[0];
    expect(firstInvoice).toBeDefined();
    if (firstInvoice === undefined) return;

    const onTime: Forecast = {
      ...late,
      invoices: [{ ...firstInvoice, paymentDelayDays: 0 }],
    };

    const diff = compareProjections(late, onTime);

    expect(diff.baseSummary.cashOutDate).toBe("2026-03-01");
    expect(diff.scenarioSummary.cashOutDate).toBeNull();
    // One side never runs out, so a day-count delta is meaningless here.
    expect(diff.cashOutDeltaDays).toBeNull();
    expect(diff.maxDivergenceDate).not.toBeNull();
    expect(describeScenarioImpact(diff)).toBe(
      "This scenario avoids the shortfall the base case runs into.",
    );
  });
});

/* -------------------------------------------------------- aggregation ----- */

describe("aggregation", () => {
  it("folds days into contiguous weekly periods that reconcile to the daily total", () => {
    const forecast = makeForecast({
      startDate: "2026-01-01",
      recurringItems: [makeRecurring({ amountCents: 10_000, frequency: "WEEKLY" })],
    });
    const projection = runProjection(forecast);
    const weeks = aggregate(projection.days, "weekly");

    const summedOutflow = weeks.reduce((total, week) => total + week.outflowCents, 0);
    expect(summedOutflow).toBe(projection.summary.totalOutflowCents);

    for (const week of weeks) {
      expect(week.netCents).toBe(week.inflowCents - week.outflowCents);
      expect(week.closingCents - week.openingCents).toBe(week.netCents);
    }

    // Periods never overlap.
    for (let index = 1; index < weeks.length; index += 1) {
      expect(daysBetween(weeks[index - 1]?.endDate ?? "", weeks[index]?.startDate ?? "")).toBe(1);
    }
  });

  it("folds days into monthly periods that reconcile to the daily total", () => {
    const projection = runProjection(makeForecast({ horizon: "TWELVE_MONTHS" }));
    const months = aggregate(projection.days, "monthly");

    expect(months).toHaveLength(12);
    expect(months.reduce((total, month) => total + month.netCents, 0)).toBe(
      projection.summary.endingBalanceCents - projection.summary.startingBalanceCents,
    );
  });

  it("returns one period per day at daily granularity", () => {
    const projection = runProjection(makeForecast());
    expect(aggregate(projection.days, "daily")).toHaveLength(projection.days.length);
  });
});

/* ------------------------------------------------- personal / business kind -- */

describe("starter forecasts", () => {
  const start = "2026-01-01";

  it("labels each starter with its kind and a matching default name", () => {
    const personal = createStarterForecast("PERSONAL", start);
    const business = createStarterForecast("BUSINESS", start);

    expect(personal.forecastKind).toBe("PERSONAL");
    expect(business.forecastKind).toBe("BUSINESS");
    expect(personal.name).not.toBe(business.name);
    expect(defaultForecastName("PERSONAL")).toBe(personal.name);
    expect(defaultForecastName("BUSINESS")).toBe(business.name);
  });

  it("gives the personal starter no invoices and the business starter some", () => {
    // A household does not raise client invoices; that is the clearest split.
    expect(createStarterForecast("PERSONAL", start).invoices).toHaveLength(0);
    expect(createStarterForecast("BUSINESS", start).invoices.length).toBeGreaterThan(0);
  });

  it("gives the personal starter a brief dip that it recovers from", () => {
    const { summary } = runProjection(createStarterForecast("PERSONAL", start));

    // A car repair takes a thin buffer under for a fortnight, then the salary
    // arrives and clears it. Pinned so a tweak to the starter cannot quietly
    // remove the very thing the product is for.
    expect(summary.cashOutDate).toBe("2026-03-19");
    expect(summary.minimumBalanceCents).toBe(-14_000);
    expect(summary.shortfallDays).toBe(13);
    expect(summary.endingBalanceCents).toBeGreaterThan(0);
    expect(summary.endingBalanceCents).toBeGreaterThan(summary.minimumBalanceCents);
  });

  it("gives the business starter a permanent shortfall, which is the honest outcome", () => {
    const { summary } = runProjection(createStarterForecast("BUSINESS", start));

    // The under-provisioned tax bill lands in July and the balance never
    // recovers inside the horizon.
    expect(summary.cashOutDate).toBe("2026-07-30");
    expect(summary.minimumBalanceCents).toBeLessThan(0);
    expect(summary.endingBalanceCents).toBeLessThan(0);
    expect(summary.shortfallDays).toBeGreaterThan(100);
  });

  it("uses only integer cents and valid dates in every starter item", () => {
    for (const kind of ["PERSONAL", "BUSINESS"] as const) {
      const forecast = createStarterForecast(kind, start);
      expect(() => runProjection(forecast)).not.toThrow();

      for (const item of [...forecast.recurringItems, ...forecast.oneOffItems]) {
        expect(Number.isInteger(item.amountCents)).toBe(true);
        expect(item.amountCents).toBeGreaterThan(0);
      }
      for (const invoice of forecast.invoices) {
        expect(Number.isInteger(invoice.amountCents)).toBe(true);
        expect(Number.isInteger(invoice.paymentDelayDays)).toBe(true);
      }
    }
  });

  it("validates against the persisted schema", () => {
    expect(validateForecast(createStarterForecast("PERSONAL", start)).ok).toBe(true);
    expect(validateForecast(createStarterForecast("BUSINESS", start)).ok).toBe(true);
  });
});

/* ------------------------------------------------- categories and impact -- */

describe("category totals", () => {
  it("counts the whole horizon, not one occurrence", () => {
    // The bug this guards: summing item amounts would report a year of €100 rent
    // as €100 rather than €1,200.
    const forecast = makeForecast({
      horizon: "TWELVE_MONTHS",
      recurringItems: [makeRecurring({ amountCents: 10_000, category: "Housing" })],
    });
    const totals = categoryTotals(runProjection(forecast));

    expect(totals).toHaveLength(1);
    expect(totals[0]?.category).toBe("Housing");
    expect(totals[0]?.totalCents).toBe(120_000);
  });

  it("groups by direction so income and expense never merge", () => {
    const forecast = makeForecast({
      horizon: "THIRTEEN_WEEKS",
      recurringItems: [
        makeRecurring({ id: "in", direction: "INFLOW", amountCents: 50_000, category: "Tax" }),
        makeRecurring({ id: "out", direction: "OUTFLOW", amountCents: 20_000, category: "Tax" }),
      ],
    });
    const totals = categoryTotals(runProjection(forecast));

    expect(totals).toHaveLength(2);
    const inflow = totals.find((total) => total.direction === "INFLOW");
    const outflow = totals.find((total) => total.direction === "OUTFLOW");
    expect(inflow?.totalCents).toBe(200_000);
    expect(outflow?.totalCents).toBe(80_000);
  });

  it("files invoices under client income so inbound money is complete", () => {
    const forecast = makeForecast({
      horizon: "SIX_MONTHS",
      invoices: [
        {
          id: "inv-1",
          clientName: "Acme",
          amountCents: 100_000,
          issueDate: "2026-01-01",
          expectedPaymentDate: "2026-02-01",
          paymentDelayDays: 0,
          status: "EXPECTED",
          recurrence: "NONE",
        },
      ],
    });
    const totals = categoryTotals(runProjection(forecast));

    expect(totals).toHaveLength(1);
    expect(totals[0]?.category).toBe(INVOICE_CATEGORY);
    expect(totals[0]?.direction).toBe("INFLOW");
    expect(totals[0]?.totalCents).toBe(100_000);
  });

  it("buckets uncategorised items rather than dropping them", () => {
    const forecast = makeForecast({
      oneOffItems: [
        {
          id: "one-1",
          name: "Mystery",
          direction: "OUTFLOW",
          amountCents: 5_000,
          date: "2026-01-05",
        },
      ],
    });
    const totals = categoryTotals(runProjection(forecast));

    expect(totals[0]?.category).toBe(UNCATEGORISED);
    expect(totals[0]?.totalCents).toBe(5_000);
  });

  it("sorts largest first and skips inactive items", () => {
    const forecast = makeForecast({
      recurringItems: [
        makeRecurring({ id: "small", amountCents: 1_000, category: "Small" }),
        makeRecurring({ id: "big", amountCents: 90_000, category: "Big" }),
        makeRecurring({ id: "off", amountCents: 999_000, category: "Off", isActive: false }),
      ],
    });
    const totals = categoryTotals(runProjection(forecast));

    expect(totals.map((total) => total.category)).toEqual(["Big", "Small"]);
  });

  it("returns an empty list for a forecast with no movement", () => {
    expect(categoryTotals(runProjection(makeForecast()))).toEqual([]);
  });
});

describe("item impact", () => {
  it("counts occurrences and multiplies out over the horizon", () => {
    const forecast = makeForecast({
      horizon: "TWELVE_MONTHS",
      recurringItems: [makeRecurring({ amountCents: 13_500 })],
    });
    const impact = impactFor(itemImpact(runProjection(forecast)), "recurring", "item-1");

    expect(impact).not.toBeNull();
    expect(impact?.occurrences).toBe(12);
    expect(impact?.amountCents).toBe(13_500);
    expect(impact?.totalCents).toBe(162_000);
    expect(impact?.firstDate).toBe("2026-01-01");
    expect(impact?.lastDate).toBe("2026-12-01");
  });

  it("reports a single occurrence for a one-off item", () => {
    const forecast = makeForecast({
      oneOffItems: [
        {
          id: "one-1",
          name: "Laptop",
          direction: "OUTFLOW",
          amountCents: 200_000,
          date: "2026-02-10",
        },
      ],
    });
    const impact = impactFor(itemImpact(runProjection(forecast)), "one-off", "one-1");

    expect(impact?.occurrences).toBe(1);
    expect(impact?.totalCents).toBe(200_000);
    expect(impact?.firstDate).toBe("2026-02-10");
  });

  it("gives an inactive item no impact, since it is not projected", () => {
    const forecast = makeForecast({ recurringItems: [makeRecurring({ isActive: false })] });
    expect(impactFor(itemImpact(runProjection(forecast)), "recurring", "item-1")).toBeNull();
  });

  it("gives an item outside the horizon no impact", () => {
    const forecast = makeForecast({
      oneOffItems: [
        {
          id: "one-1",
          name: "Far future",
          direction: "OUTFLOW",
          amountCents: 200_000,
          date: "2030-02-10",
        },
      ],
    });
    expect(impactFor(itemImpact(runProjection(forecast)), "one-off", "one-1")).toBeNull();
  });

  it("counts a repeating invoice every time it fires", () => {
    const forecast = makeForecast({
      horizon: "SIX_MONTHS",
      invoices: [
        {
          id: "inv-1",
          clientName: "Retainer",
          amountCents: 50_000,
          issueDate: "2026-01-01",
          expectedPaymentDate: "2026-01-15",
          paymentDelayDays: 0,
          status: "EXPECTED",
          recurrence: "MONTHLY",
        },
      ],
    });
    const impact = impactFor(itemImpact(runProjection(forecast)), "invoice", "inv-1");

    expect(impact?.occurrences).toBe(6);
    expect(impact?.totalCents).toBe(300_000);
  });

  it("keeps every total a whole number of cents", () => {
    const forecast = makeForecast({
      horizon: "TWELVE_MONTHS",
      recurringItems: [
        makeRecurring({ id: "w", frequency: "WEEKLY", amountCents: 12_345, category: "Weekly" }),
        makeRecurring({ id: "q", frequency: "QUARTERLY", amountCents: 9_999, category: "Quarterly" }),
      ],
    });
    const projection = runProjection(forecast);

    for (const total of categoryTotals(projection)) {
      expect(Number.isInteger(total.totalCents)).toBe(true);
    }
    for (const impact of itemImpact(projection).values()) {
      expect(Number.isInteger(impact.totalCents)).toBe(true);
      expect(impact.totalCents).toBe(impact.amountCents * impact.occurrences);
    }
  });

  it("reconciles to the projection's own inflow and outflow totals", () => {
    const projection = runProjection(createStarterForecast("BUSINESS", "2026-01-01"));
    const totals = categoryTotals(projection);

    const income = totals
      .filter((total) => total.direction === "INFLOW")
      .reduce((sum, total) => sum + total.totalCents, 0);
    const expense = totals
      .filter((total) => total.direction === "OUTFLOW")
      .reduce((sum, total) => sum + total.totalCents, 0);

    expect(income).toBe(projection.summary.totalInflowCents);
    expect(expense).toBe(projection.summary.totalOutflowCents);
  });
});

/* --------------------------------------------------- currency-safe money -- */

describe("currency-safe integer-cent arithmetic", () => {
  it("parses decimals without floating-point drift", () => {
    // The canonical trap: Number("19.99") * 100 === 1998.9999999999998
    expect(parseDecimalToCents("19.99")).toBe(1999);
    expect(parseDecimalToCents("0.1")).toBe(10);
    expect(parseDecimalToCents("0.07")).toBe(7);
    expect(parseDecimalToCents("1234.56")).toBe(123_456);
    expect(parseDecimalToCents("1500")).toBe(150_000);
    expect(parseDecimalToCents("1500,55")).toBe(150_055);
    expect(parseDecimalToCents("-20.5")).toBe(-2050);
    expect(parseDecimalToCents("0")).toBe(0);
  });

  it("rounds half up on a third decimal", () => {
    expect(parseDecimalToCents("1.005")).toBe(101);
    expect(parseDecimalToCents("1.004")).toBe(100);
    expect(parseDecimalToCents("1.999")).toBe(200);
  });

  it("rejects input that is not a plain amount", () => {
    expect(parseDecimalToCents("")).toBeNull();
    expect(parseDecimalToCents("abc")).toBeNull();
    expect(parseDecimalToCents("1.2.3")).toBeNull();
    expect(parseDecimalToCents("€12")).toBeNull();
    expect(parseDecimalToCents("1e3")).toBeNull();
    expect(parseDecimalToCents("1234567890123456")).toBeNull();
  });

  it("sums cents exactly where floats would not", () => {
    const a = parseDecimalToCents("0.1") ?? 0;
    const b = parseDecimalToCents("0.2") ?? 0;

    expect(sumCents(a, b)).toBe(30);
    // The float version of the same sum is famously not 0.3.
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(centsToDecimalString(sumCents(a, b), "EUR")).toBe("0.30");
  });

  it("round-trips between text and cents", () => {
    for (const value of ["0.00", "0.01", "19.99", "1500.00", "-42.50"]) {
      const cents = parseDecimalToCents(value);
      expect(cents).not.toBeNull();
      expect(parseDecimalToCents(centsToDecimalString(cents ?? 0, "EUR"))).toBe(cents);
    }
  });

  it("refuses fractional cents at the trust boundary", () => {
    expect(() => assertIntegerCents(12.34)).toThrow(TypeError);
    expect(() => assertIntegerCents(Number.NaN)).toThrow(TypeError);
    expect(() => assertIntegerCents(Number.POSITIVE_INFINITY)).toThrow(TypeError);
    expect(assertIntegerCents(1234)).toBe(1234);
  });

  it("throws when a forecast carries a fractional amount", () => {
    const forecast = makeForecast({
      // Simulates a bad import or hand-edited record reaching the engine.
      recurringItems: [makeRecurring({ amountCents: 10.5 })],
    });
    expect(() => runProjection(forecast)).toThrow(TypeError);
  });

  it("formats each supported currency with the right precision", () => {
    expect(formatCents(150_000, "EUR", { locale: "en-GB" })).toBe("€1,500.00");
    expect(formatCents(150_000, "USD", { locale: "en-US" })).toBe("$1,500.00");
    // Yen has no minor unit, so it is displayed whole.
    expect(formatCents(150_000, "JPY", { locale: "en-US" })).toBe("¥1,500");
    expect(formatCents(-150_000, "EUR", { locale: "en-GB" })).toBe("-€1,500.00");
    expect(formatCents(150_000, "EUR", { locale: "en-GB", signed: true })).toBe("+€1,500.00");
  });

  it("keeps a long run of additions exact", () => {
    // €0.01 added 10,000 times must land on exactly €100.00.
    let total = 0;
    for (let index = 0; index < 10_000; index += 1) {
      total += 1;
    }
    expect(total).toBe(10_000);
    expect(centsToDecimalString(total, "EUR")).toBe("100.00");
  });
});
