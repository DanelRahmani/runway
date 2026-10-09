import { isTransferCategory } from "@/lib/categories";
import { roundToCents } from "@/lib/money";
import type { Account, AccountKind, Forecast, IsoDate, Projection } from "@/types/forecast";

/**
 * Account balances, derived from the ledger rather than stored in it.
 *
 * This is a view, not a second engine. `runProjection` still produces the single
 * day-by-day ledger of entries it always did; these functions route each entry to
 * the pot it belongs in. Keeping it that way means the cash-flow table, the
 * charts, the savings summary and the goal progress all keep working unchanged,
 * and the spending-account balance is still exactly the balance the dashboard has
 * always led with.
 */

/** The derived spending account. Never stored, because the forecast owns its balance. */
export const SPENDING_ACCOUNT_ID = "spending";

const BASIS_POINTS_PER_UNIT = 10_000;
const MONTHS_PER_YEAR = 12;

/** The spending account, synthesised from the forecast's own starting balance. */
export function spendingAccount(forecast: Forecast): Account {
  return {
    id: SPENDING_ACCOUNT_ID,
    name: "Spending",
    kind: "CASH",
    startingBalanceCents: forecast.startingBalanceCents,
  };
}

/** The spending account followed by any pots the user has configured. */
export function accountsFor(forecast: Forecast): Account[] {
  return [spendingAccount(forecast), ...(forecast.accounts ?? [])];
}

export interface AccountSummary {
  account: Account;
  startingCents: number;
  closingCents: number;
  /** Interest or investment growth credited over the horizon. */
  growthCents: number;
  /** Everything that moved in or out, excluding growth. */
  netFlowCents: number;
}

export interface AccountSeriesPoint {
  date: IsoDate;
  /** Closing balance for every account id, including the spending account. */
  cents: Record<string, number>;
}

export interface AccountProjection {
  accounts: AccountSummary[];
  series: AccountSeriesPoint[];
  /** Closing balance of every spending account — the money you can actually use. */
  spendableClosingCents: number;
  /** Every pot together, so savings are not invisible. */
  totalClosingCents: number;
  /** Growth credited across all accounts over the horizon. */
  growthCents: number;
  /** True when no pots are configured, so any rate-based figure would be empty. */
  hasGrowth: boolean;
}

/** Where each transfer's money is headed, keyed by `source:id`. */
function transferRoutes(forecast: Forecast): Map<string, string> {
  const routes = new Map<string, string>();

  for (const item of forecast.recurringItems) {
    if (item.accountId !== undefined) routes.set(`recurring:${item.id}`, item.accountId);
  }
  for (const item of forecast.oneOffItems) {
    if (item.accountId !== undefined) routes.set(`one-off:${item.id}`, item.accountId);
  }

  return routes;
}

function applyRate(
  balances: Map<string, number>,
  growth: Map<string, number>,
  accounts: readonly Account[],
): void {
  for (const account of accounts) {
    const bps = account.annualRateBps ?? 0;
    if (bps === 0) continue;

    const balance = balances.get(account.id) ?? 0;
    /*
     * Compounded on the closing balance and rounded to whole cents every month,
     * so the balance never holds a fraction. Rounding goes through the money
     * module rather than `Math.round` so there is one definition of what a whole
     * cent is.
     *
     * Note this is a *smooth* average: it cannot represent a bad early year, which
     * hurts more than the average implies. Any surface showing growth must say so.
     */
    const credit = roundToCents((balance * bps) / BASIS_POINTS_PER_UNIT / MONTHS_PER_YEAR);
    balances.set(account.id, balance + credit);
    growth.set(account.id, (growth.get(account.id) ?? 0) + credit);
  }
}

/**
 * Walks the ledger once, maintaining a balance per account.
 *
 * A transfer that names a pot is **two-sided**: it leaves the spending account and
 * arrives in the pot, so total wealth is unchanged and the money stops looking
 * spent. A transfer with no pot named — which is every transfer on a forecast
 * without accounts — simply leaves the spending account and lands nowhere, which
 * is exactly what Runway has always done and what its "kept, not spent" wording
 * has always implied.
 */
export function accountProjection(forecast: Forecast, projection: Projection): AccountProjection {
  const accounts = accountsFor(forecast);
  const known = new Set(accounts.map((account) => account.id));
  const routes = transferRoutes(forecast);

  const balances = new Map<string, number>();
  const growth = new Map<string, number>();
  const starting = new Map<string, number>();
  for (const account of accounts) {
    balances.set(account.id, account.startingBalanceCents);
    starting.set(account.id, account.startingBalanceCents);
    growth.set(account.id, 0);
  }

  const series: AccountSeriesPoint[] = [];
  let currentMonth = "";

  for (const day of projection.days) {
    const month = day.date.slice(0, 7);

    // Credit at the turn of the month, on the balance carried out of the last one.
    if (currentMonth !== "" && month !== currentMonth) {
      applyRate(balances, growth, accounts);
    }
    currentMonth = month;

    for (const entry of day.entries) {
      const destination = routes.get(`${entry.source}:${entry.id}`);
      const isTransfer = isTransferCategory(entry.category);
      const target = destination !== undefined && known.has(destination) ? destination : undefined;

      if (isTransfer && target !== undefined && target !== SPENDING_ACCOUNT_ID) {
        balances.set(SPENDING_ACCOUNT_ID, (balances.get(SPENDING_ACCOUNT_ID) ?? 0) - entry.amountCents);
        balances.set(target, (balances.get(target) ?? 0) + entry.amountCents);
        continue;
      }

      // Everything else — including an unassigned transfer — hits the spending
      // account. An invoice never names a pot.
      const signed =
        entry.direction === "INFLOW" ? entry.amountCents : -entry.amountCents;
      balances.set(SPENDING_ACCOUNT_ID, (balances.get(SPENDING_ACCOUNT_ID) ?? 0) + signed);
    }

    series.push({ date: day.date, cents: Object.fromEntries(balances) });
  }

  const summaries: AccountSummary[] = accounts.map((account) => {
    const start = starting.get(account.id) ?? 0;
    const credited = growth.get(account.id) ?? 0;
    const close = balances.get(account.id) ?? 0;

    return {
      account,
      startingCents: start,
      closingCents: close,
      growthCents: credited,
      netFlowCents: close - start - credited,
    };
  });

  const spendable = summaries
    .filter((summary) => summary.account.kind === "CASH")
    .reduce((total, summary) => total + summary.closingCents, 0);

  const total = summaries.reduce((sum, summary) => sum + summary.closingCents, 0);

  return {
    accounts: summaries,
    series,
    spendableClosingCents: spendable,
    totalClosingCents: total,
    growthCents: summaries.reduce((sum, summary) => sum + summary.growthCents, 0),
    hasGrowth: summaries.some((summary) => summary.growthCents !== 0),
  };
}

export function accountKindLabel(kind: AccountKind): string {
  switch (kind) {
    case "CASH":
      return "Cash";
    case "SAVINGS":
      return "Savings";
    case "INVESTMENT":
      return "Investment";
    case "DEBT":
      return "Debt";
  }
}
