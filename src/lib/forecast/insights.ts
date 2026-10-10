import { daysBetween, formatIsoDate } from "@/lib/dates";
import { aggregate } from "@/lib/forecast/aggregate";
import { categoryTotals, impactFor, itemImpact } from "@/lib/forecast/engine";
import { savingsSummary } from "@/lib/forecast/savings";
import { formatCents } from "@/lib/money";
import { formatPercent } from "@/lib/utils";
import type { Forecast, IsoDate, Projection } from "@/types/forecast";

/**
 * Things worth saying out loud.
 *
 * Every line here is a comparison the charts already contain but that nobody can
 * read off them — which month is thinnest, whether the plan leans on one income,
 * which items never fire. Nothing is generated, guessed or generated-by-a-model:
 * each sentence is arithmetic over the projection, so it can be asserted in a test
 * and will say the same thing twice.
 */

export interface Insight {
  id: string;
  tone: "neutral" | "positive" | "negative";
  text: string;
}

/** How long a forecast can sit untouched before it is worth mentioning. */
export const STALE_AFTER_DAYS = 30;

/** How many silent items to name before summarising the rest. */
const MAX_NAMES = 3;

export function insights(forecast: Forecast, projection: Projection): Insight[] {
  const currency = forecast.currency;
  const { summary } = projection;
  const money = (cents: number): string => formatCents(cents, currency);
  const found: Insight[] = [];

  if (summary.cashOutDate !== null) {
    const days = summary.shortfallDays;
    found.push({
      id: "cash-out",
      tone: "negative",
      text: `The balance first closes below zero on ${formatIsoDate(summary.cashOutDate)}, and spends ${days} ${days === 1 ? "day" : "days"} under it.`,
    });
  } else {
    found.push({
      id: "no-cash-out",
      tone: "positive",
      text: `Nothing goes negative in this horizon. The thinnest day is ${formatIsoDate(summary.minimumBalanceDate)}, at ${money(summary.minimumBalanceCents)}.`,
    });
  }

  const months = aggregate(projection.days, "monthly");
  const firstMonth = months[0];
  if (months.length > 1 && firstMonth !== undefined) {
    let thinnest = firstMonth;
    for (const period of months) {
      if (period.closingCents < thinnest.closingCents) thinnest = period;
    }

    found.push({
      id: "thinnest-month",
      tone: thinnest.closingCents < 0 ? "negative" : "neutral",
      text: `${thinnest.label} is the thinnest month, closing at ${money(thinnest.closingCents)}.`,
    });
  }

  const savings = savingsSummary(projection);
  if (savings.savingsRate === null) {
    found.push({
      id: "no-income",
      tone: "neutral",
      text: "There is no income in this horizon, so there is no savings rate to report.",
    });
  } else {
    found.push({
      id: "savings-rate",
      tone: savings.savingsRate >= 0.1 ? "positive" : "neutral",
      text: `You set aside ${formatPercent(savings.savingsRate)} of income — about ${money(savings.monthlyKeptCents)} a month.`,
    });
  }

  const outflows = categoryTotals(projection).filter((total) => total.direction === "OUTFLOW");
  const largest = outflows[0];
  if (largest !== undefined && savings.outflowCents > 0) {
    found.push({
      id: "largest-cost",
      tone: "neutral",
      text: `${largest.category} is the largest cost: ${money(largest.totalCents)} over the horizon, ${formatPercent(largest.totalCents / savings.outflowCents)} of everything going out.`,
    });
  }

  const inflows = categoryTotals(projection).filter((total) => total.direction === "INFLOW");
  const topIncome = inflows[0];
  if (topIncome !== undefined && summary.totalInflowCents > 0) {
    const share = topIncome.totalCents / summary.totalInflowCents;
    // Only worth saying when it is a concentration rather than a description:
    // most forecasts have one main income, and repeating that is noise.
    if (share >= 0.8 && inflows.length > 1) {
      found.push({
        id: "income-concentration",
        tone: "negative",
        text: `${topIncome.category} is ${formatPercent(share)} of income — the plan leans on that one source.`,
      });
    }
  }

  const impacts = itemImpact(projection);
  const silent = forecast.recurringItems.filter(
    (item) => item.isActive && impactFor(impacts, "recurring", item.id) === null,
  );
  if (silent.length > 0) {
    const names = silent
      .slice(0, MAX_NAMES)
      .map((item) => item.name)
      .join(", ");
    const rest = silent.length - Math.min(silent.length, MAX_NAMES);
    const suffix = rest > 0 ? `, and ${rest} more` : "";
    found.push({
      id: "silent-items",
      tone: "neutral",
      text:
        silent.length === 1
          ? `One active item never lands in this horizon: ${names}. Check its dates or its frequency.`
          : `${silent.length} active items never land in this horizon: ${names}${suffix}.`,
    });
  }

  return found;
}

/**
 * Whether the forecast has gone stale.
 *
 * `today` is passed in rather than read, so this stays a pure function of its
 * arguments and can be tested without a clock.
 */
export function staleness(forecast: Forecast, today: IsoDate): Insight | null {
  const updated = forecast.updatedAt.slice(0, 10);
  if (updated === "") return null;

  const days = daysBetween(updated, today);
  if (days < STALE_AFTER_DAYS) return null;

  return {
    id: "stale",
    tone: "neutral",
    text: `Not changed for ${days} days. A forecast is only as good as the assumptions under it — worth a look.`,
  };
}
