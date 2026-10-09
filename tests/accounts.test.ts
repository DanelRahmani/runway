import { describe, expect, it } from "vitest";

import { accountProjection, accountsFor, SPENDING_ACCOUNT_ID } from "@/lib/forecast/accounts";
import { runProjection } from "@/lib/forecast/engine";
import type { Account, Forecast, IsoDate, OneOffItem, RecurringItem } from "@/types/forecast";

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
    ...(overrides.accountId === undefined ? {} : { accountId: overrides.accountId }),
  };
}

function oneOff(
  amountCents: number,
  category: string,
  date: IsoDate,
  accountId?: string,
): OneOffItem {
  return {
    id: `o-${category}-${amountCents}-${date}`,
    name: category,
    direction: "OUTFLOW",
    amountCents,
    date,
    category,
    ...(accountId === undefined ? {} : { accountId }),
  };
}

function pot(overrides: Partial<Account> = {}): Account {
  return {
    id: "savings",
    name: "Savings",
    kind: "SAVINGS",
    startingBalanceCents: 0,
    ...overrides,
  };
}

describe("account projection", () => {
  it("keeps the spending balance identical to the plain projection when no pots exist", () => {
    /*
     * The compatibility guarantee. Every forecast saved before accounts existed
     * has no pots, so the balance the dashboard leads with must not move by a
     * single cent. This is what makes the whole feature additive.
     */
    const forecast = makeForecast({
      recurringItems: [recurring(300_000, "Salary", { direction: "INFLOW" }), recurring(90_000, "Housing")],
    });
    const projection = runProjection(forecast);
    const { accounts } = accountProjection(forecast, projection);
    const spending = accounts.find((summary) => summary.account.id === SPENDING_ACCOUNT_ID);

    expect(accounts).toHaveLength(1);
    expect(spending?.closingCents).toBe(projection.summary.endingBalanceCents);
  });

  it("moves an assigned transfer into its pot instead of spending it", () => {
    const forecast = makeForecast({
      accounts: [pot()],
      oneOffItems: [oneOff(30_000, "Savings", "2026-01-05", "savings")],
    });
    const projection = accountProjection(forecast, runProjection(forecast));
    const spending = projection.accounts.find((s) => s.account.id === SPENDING_ACCOUNT_ID);
    const savings = projection.accounts.find((s) => s.account.id === "savings");

    expect(spending?.closingCents).toBe(70_000);
    expect(savings?.closingCents).toBe(30_000);
    expect(projection.spendableClosingCents).toBe(70_000);
    // The headline: wealth is unchanged, the money just moved.
    expect(projection.totalClosingCents).toBe(100_000);
  });

  it("leaves an unassigned transfer landing nowhere, exactly as before", () => {
    const forecast = makeForecast({
      oneOffItems: [oneOff(30_000, "Savings", "2026-01-05")],
    });
    const projection = accountProjection(forecast, runProjection(forecast));

    expect(projection.accounts).toHaveLength(1);
    expect(projection.spendableClosingCents).toBe(70_000);
    // Nothing to move it into, so total wealth does fall. Runway does not invent
    // a pot to hold money it has not been told about.
    expect(projection.totalClosingCents).toBe(70_000);
  });

  it("ignores a pot that no longer exists rather than throwing", () => {
    const forecast = makeForecast({
      oneOffItems: [oneOff(10_000, "Savings", "2026-01-05", "deleted-pot")],
    });
    const projection = accountProjection(forecast, runProjection(forecast));

    expect(projection.accounts).toHaveLength(1);
    expect(projection.spendableClosingCents).toBe(90_000);
  });

  it("routes a recurring transfer every month it fires", () => {
    const forecast = makeForecast({
      accounts: [pot()],
      recurringItems: [recurring(5_000, "Investing", { accountId: "savings" })],
    });
    const projection = accountProjection(forecast, runProjection(forecast));
    const savings = projection.accounts.find((s) => s.account.id === "savings");

    // Three or four monthly occurrences inside thirteen weeks; the point is that
    // every one of them landed in the pot and none was treated as spending.
    expect(savings?.closingCents).toBeGreaterThan(5_000);
    expect(savings?.netFlowCents).toBe(savings?.closingCents);
  });

  it("compounds growth monthly rather than paying simple interest", () => {
    const forecast = makeForecast({
      accounts: [pot({ startingBalanceCents: 120_000, annualRateBps: 1_200 })],
    });
    const projection = accountProjection(forecast, runProjection(forecast));
    const savings = projection.accounts.find((s) => s.account.id === "savings");
    const growth = savings?.growthCents ?? 0;

    expect(growth).toBeGreaterThan(0);
    // 1% a month over the month-turns in a thirteen-week horizon, paid flat,
    // would be this much. Compounding has to beat it.
    const simple = Math.round((120_000 * 1_200) / 10_000 / 12) * 3;
    expect(growth).toBeGreaterThan(simple);
    expect(savings?.closingCents).toBe(120_000 + growth);
  });

  it("pays no interest on a pot with no rate", () => {
    const forecast = makeForecast({ accounts: [pot({ startingBalanceCents: 50_000 })] });
    const projection = accountProjection(forecast, runProjection(forecast));

    expect(projection.growthCents).toBe(0);
    expect(projection.hasGrowth).toBe(false);
  });

  it("grows a debt when a positive rate is applied to it", () => {
    const forecast = makeForecast({
      accounts: [
        pot({ id: "loan", name: "Loan", kind: "DEBT", startingBalanceCents: -200_000, annualRateBps: 600 }),
      ],
    });
    const projection = accountProjection(forecast, runProjection(forecast));
    const loan = projection.accounts.find((s) => s.account.id === "loan");

    // Owing more over time is correct: the rate accrues against a negative balance.
    expect(loan?.closingCents).toBeLessThan(-200_000);
    expect(loan?.growthCents).toBeLessThan(0);
  });

  it("reports one series point per day, ending on the closing balances", () => {
    const forecast = makeForecast({
      accounts: [pot()],
      oneOffItems: [oneOff(30_000, "Savings", "2026-01-05", "savings")],
    });
    const dayCount = runProjection(forecast).days.length;
    const projection = accountProjection(forecast, runProjection(forecast));

    expect(projection.series).toHaveLength(dayCount);
    expect(projection.series.at(-1)?.cents[SPENDING_ACCOUNT_ID]).toBe(70_000);
    expect(projection.series.at(-1)?.cents["savings"]).toBe(30_000);
  });

  it("counts an extra cash pot as spendable", () => {
    const forecast = makeForecast({
      accounts: [pot({ id: "second", name: "Second current", kind: "CASH", startingBalanceCents: 40_000 })],
    });
    const projection = accountProjection(forecast, runProjection(forecast));

    expect(projection.spendableClosingCents).toBe(140_000);
    expect(accountsFor(forecast)).toHaveLength(2);
  });
});
