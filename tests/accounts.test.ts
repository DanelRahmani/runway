import { describe, expect, it } from "vitest";

import {
  accountProjection,
  accountsFor,
  breakdownSeries,
  growthRows,
  SPENDING_ACCOUNT_ID,
  spendableRunway,
} from "@/lib/forecast/accounts";
import { compareIsoDate } from "@/lib/dates";
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

/*
 * The growth chart draws one line per pot with `dataKey={account.id}`, which
 * recharts resolves against the top level of each row. The engine nests balances
 * under `cents`, so if the reshape ever stopped lifting them out, every line would
 * come out empty — axes drawn, no series, nothing thrown, and nothing in the build
 * to catch it. Hence a test on the shape itself rather than on the picture.
 */
describe("growth rows for the chart", () => {
  it("carries every account id as a top-level number key", () => {
    const forecast = makeForecast({
      accounts: [pot(), pot({ id: "broker", name: "Broker", kind: "INVESTMENT" })],
      oneOffItems: [oneOff(30_000, "Savings", "2026-01-05", "savings")],
    });
    const projection = accountProjection(forecast, runProjection(forecast));

    const rows = growthRows(projection.series);

    expect(rows).toHaveLength(projection.series.length);
    for (const row of rows) {
      for (const account of accountsFor(forecast)) {
        expect(typeof row[account.id], `${account.id} missing from row`).toBe("number");
      }
    }
  });

  it("starts on the opening balances and ends on the closing ones", () => {
    const forecast = makeForecast({
      accounts: [pot({ startingBalanceCents: 500_000, annualRateBps: 600 })],
    });
    const projection = accountProjection(forecast, runProjection(forecast));

    const rows = growthRows(projection.series);
    const last = rows.at(-1);

    expect(rows[0]?.["savings"]).toBe(500_000);
    expect(last?.["savings"]).toBe(
      projection.accounts.find((entry) => entry.account.id === "savings")?.closingCents,
    );

    // The last row has to sit above the first, or the rate is not reaching the chart.
    expect(last?.["savings"]).toBeGreaterThan(500_000);
  });
});

/*
 * The breakdown chart splits the change in a set of accounts into money the user
 * moved and money the rate moved. It is computed from the series' own growth
 * snapshot, while the summaries compute the same quantities from a second set of
 * running totals — so checking one against the other is a real cross-check rather
 * than a restatement of the formula.
 */
describe("contributions and growth breakdown", () => {
  it("agrees with the account summaries it is derived from", () => {
    const forecast = makeForecast({
      accounts: [pot({ startingBalanceCents: 500_000, annualRateBps: 600 })],
      recurringItems: [
        recurring(20_000, "Savings", { direction: "OUTFLOW", accountId: "savings" }),
      ],
    });
    const projection = accountProjection(forecast, runProjection(forecast));

    const last = breakdownSeries(projection.series, accountsFor(forecast)).at(-1);
    const credited = projection.accounts.reduce((sum, entry) => sum + entry.growthCents, 0);
    const flowed = projection.accounts.reduce((sum, entry) => sum + entry.netFlowCents, 0);

    expect(last?.growthCents).toBe(credited);
    expect(last?.contributionsCents).toBe(flowed);
    expect(last?.totalCents).toBe(credited + flowed);
  });

  it("nets a transfer between the user's own accounts out of the paid-in band", () => {
    const forecast = makeForecast({
      accounts: [pot({ startingBalanceCents: 300_000, annualRateBps: 1_200 })],
      oneOffItems: [oneOff(50_000, "Savings", "2026-01-05", "savings")],
    });
    const projection = accountProjection(forecast, runProjection(forecast));
    const savings = forecast.accounts?.[0];

    const all = breakdownSeries(projection.series, accountsFor(forecast));
    const alone = breakdownSeries(projection.series, savings === undefined ? [] : [savings]);

    // Opening balances are excluded, so day one is flat in both bands.
    expect(all[0]?.contributionsCents).toBe(0);
    expect(all[0]?.growthCents).toBe(0);

    /*
     * Across every account, moving 50,000 from spending into savings is not paying
     * anything in: the money never left the household. Only the rate can change
     * total wealth, so only the rate may move that band.
     */
    expect(all.at(-1)?.contributionsCents).toBe(0);
    expect(all.at(-1)?.growthCents).toBeGreaterThan(0);

    // Seen on its own, the pot did receive it — which is what isolating it is for.
    expect(alone.at(-1)?.contributionsCents).toBe(50_000);
    expect(alone.at(-1)?.growthCents).toBeGreaterThan(0);
  });

  it("narrows to one account when the chart isolates it", () => {
    const forecast = makeForecast({
      accounts: [
        pot({ id: "savings", startingBalanceCents: 100_000, annualRateBps: 600 }),
        pot({ id: "broker", name: "Broker", kind: "INVESTMENT", startingBalanceCents: 100_000 }),
      ],
      oneOffItems: [oneOff(25_000, "Savings", "2026-01-05", "savings")],
    });
    const projection = accountProjection(forecast, runProjection(forecast));
    const broker = forecast.accounts?.find((account) => account.id === "broker");

    const alone = breakdownSeries(projection.series, broker === undefined ? [] : [broker]).at(-1);

    // The broker has no rate and no payments, so isolating it is a flat nothing.
    expect(alone?.contributionsCents).toBe(0);
    expect(alone?.growthCents).toBe(0);
  });
});

/*
 * The spending account is where the ledger lands, but a household with two current
 * accounts can spend from both. The dashboard's cash-out date counts the spending
 * account alone, so on such a forecast it fires while there is still money to move
 * across — the pessimistic answer, and the one the README lists as a limitation.
 */
describe("cash-out across spendable accounts", () => {
  it("reproduces the dashboard figures when nothing else is spendable", () => {
    const forecast = makeForecast({ recurringItems: [recurring(40_000, "Housing")] });
    const projection = runProjection(forecast);
    const runway = spendableRunway(forecast, accountProjection(forecast, projection));

    // The property that makes this a view rather than a change: one spendable
    // account has to give back exactly what the app already led with.
    expect(runway.accountCount).toBe(1);
    expect(runway.cashOutDate).toBe(projection.summary.cashOutDate);
    expect(runway.minimumCents).toBe(projection.summary.minimumBalanceCents);
  });

  it("counts a second cash account as spendable and a savings pot as not", () => {
    const accounts: Account[] = [
      { id: "current", name: "Second current", kind: "CASH", startingBalanceCents: 200_000 },
      { id: "savings", name: "Savings", kind: "SAVINGS", startingBalanceCents: 500_000 },
    ];
    const forecast = makeForecast({ accounts, recurringItems: [recurring(40_000, "Housing")] });
    const runway = spendableRunway(
      forecast,
      accountProjection(forecast, runProjection(forecast)),
    );

    // Savings is money you hold, not money you can spend without moving it, so it
    // stays out of this count — the same split the panel's own totals make.
    expect(runway.accountCount).toBe(2);
  });

  it("pushes the cash-out date later when a transfer funds a second cash account", () => {
    const diverted = makeForecast({
      startingBalanceCents: 100_000,
      recurringItems: [recurring(40_000, "Housing")],
      // Two-sided: it leaves the spending account and arrives in the pot.
      oneOffItems: [oneOff(80_000, "Savings", "2026-01-05", "current")],
      accounts: [{ id: "current", name: "Second current", kind: "CASH", startingBalanceCents: 0 }],
    });
    const projection = runProjection(diverted);
    const runway = spendableRunway(diverted, accountProjection(diverted, projection));

    expect(projection.summary.cashOutDate).not.toBeNull();
    expect(runway.cashOutDate).not.toBeNull();
    expect(
      compareIsoDate(runway.cashOutDate ?? "", projection.summary.cashOutDate ?? ""),
    ).toBe(1);
    expect(runway.minimumCents).toBeGreaterThan(projection.summary.minimumBalanceCents);
  });
});
