import { daysBetween, eachDay, horizonEndDate } from "@/lib/dates";
import { assertIntegerCents } from "@/lib/money";
import { invoiceOccurrences, recurringOccurrences } from "@/lib/forecast/recurrence";
import type {
  Forecast,
  IsoDate,
  Projection,
  ProjectionDay,
  ProjectionEntry,
  ProjectionSummary,
} from "@/types/forecast";

/**
 * The Runway forecasting engine.
 *
 * Pure by contract: it takes a {@link Forecast} and returns a {@link Projection}.
 * No React, no Dexie, no browser APIs, no clock reads, no randomness. The same
 * forecast always produces the same projection, which is what makes scenario
 * comparison meaningful.
 *
 * Money is only ever added or subtracted as integer cents. The running balance
 * starts from `startingBalanceCents` and every mutation is an integer add.
 */

/** Entry dates bucketed by day, built once per projection. */
interface DayLedger {
  inflows: ProjectionEntry[];
  outflows: ProjectionEntry[];
}

function emptyLedgerByDate(dates: readonly IsoDate[]): Map<IsoDate, DayLedger> {
  const ledger = new Map<IsoDate, DayLedger>();
  for (const date of dates) {
    ledger.set(date, { inflows: [], outflows: [] });
  }
  return ledger;
}

function pushEntry(
  ledger: Map<IsoDate, DayLedger>,
  date: IsoDate,
  entry: ProjectionEntry,
): void {
  const bucket = ledger.get(date);
  // Dates outside the horizon are dropped rather than clamped: a rent payment
  // after the forecast ends is not part of this projection.
  if (bucket === undefined) return;
  if (entry.direction === "INFLOW") bucket.inflows.push(entry);
  else bucket.outflows.push(entry);
}

/**
 * Expands a forecast into a per-day ledger of dated entries.
 *
 * Exported because the drill-down UI and the tests both want the raw dated
 * entries without recomputing balances.
 */
export function buildLedger(forecast: Forecast, startDate: IsoDate, endDate: IsoDate): Map<IsoDate, DayLedger> {
  const dates = eachDay(startDate, endDate);
  const ledger = emptyLedgerByDate(dates);
  const range = { rangeStart: startDate, rangeEnd: endDate, endDate: undefined } as const;

  for (const item of forecast.recurringItems) {
    if (!item.isActive) continue;
    assertIntegerCents(item.amountCents, `recurring item "${item.name}"`);
    if (item.amountCents === 0) continue;

    const occurrences = recurringOccurrences(item.startDate, item.frequency, {
      ...range,
      endDate: item.endDate,
    });

    for (const date of occurrences) {
      pushEntry(ledger, date, {
        source: "recurring",
        id: item.id,
        label: item.name,
        direction: item.direction,
        amountCents: item.amountCents,
      });
    }
  }

  for (const item of forecast.oneOffItems) {
    assertIntegerCents(item.amountCents, `one-off item "${item.name}"`);
    if (item.amountCents === 0) continue;

    pushEntry(ledger, item.date, {
      source: "one-off",
      id: item.id,
      label: item.name,
      direction: item.direction,
      amountCents: item.amountCents,
    });
  }

  for (const invoice of forecast.invoices) {
    // A cancelled invoice will never pay; a paid one has already landed in the
    // starting balance. Only expected invoices are projected forward.
    if (invoice.status !== "EXPECTED") continue;
    assertIntegerCents(invoice.amountCents, `invoice for "${invoice.clientName}"`);
    if (invoice.amountCents === 0) continue;

    const occurrences = invoiceOccurrences(
      invoice.expectedPaymentDate,
      invoice.paymentDelayDays,
      invoice.recurrence,
      range,
    );

    for (const date of occurrences) {
      pushEntry(ledger, date, {
        source: "invoice",
        id: invoice.id,
        label: invoice.clientName,
        direction: "INFLOW",
        amountCents: invoice.amountCents,
      });
    }
  }

  return ledger;
}

/** Aggregates a ledger into a running balance, day by day. */
export function projectDays(
  startingBalanceCents: number,
  dates: readonly IsoDate[],
  ledger: Map<IsoDate, DayLedger>,
): ProjectionDay[] {
  assertIntegerCents(startingBalanceCents, "starting balance");

  const days: ProjectionDay[] = [];
  let balance = startingBalanceCents;

  for (const date of dates) {
    const bucket = ledger.get(date) ?? { inflows: [], outflows: [] };
    const openingCents = balance;

    let inflowCents = 0;
    for (const entry of bucket.inflows) inflowCents += entry.amountCents;

    let outflowCents = 0;
    for (const entry of bucket.outflows) outflowCents += entry.amountCents;

    const netCents = inflowCents - outflowCents;
    balance += netCents;

    days.push({
      date,
      openingCents,
      inflowCents,
      outflowCents,
      netCents,
      closingCents: balance,
      entries: [...bucket.inflows, ...bucket.outflows],
    });
  }

  return days;
}

/** Headline figures for the dashboard KPI cards. */
export function summarise(startingBalanceCents: number, days: readonly ProjectionDay[]): ProjectionSummary {
  assertIntegerCents(startingBalanceCents, "starting balance");

  const last = days[days.length - 1];
  const endingBalanceCents = last === undefined ? startingBalanceCents : last.closingCents;
  const endingDate = last === undefined ? "" : last.date;

  let minimumBalanceCents = startingBalanceCents;
  let minimumBalanceDate = days[0]?.date ?? endingDate;
  let cashOutDate: IsoDate | null = null;
  let totalInflowCents = 0;
  let totalOutflowCents = 0;
  let shortfallDays = 0;

  for (const day of days) {
    totalInflowCents += day.inflowCents;
    totalOutflowCents += day.outflowCents;

    if (day.closingCents < minimumBalanceCents) {
      minimumBalanceCents = day.closingCents;
      minimumBalanceDate = day.date;
    }

    if (day.closingCents < 0) {
      shortfallDays += 1;
      if (cashOutDate === null) cashOutDate = day.date;
    }
  }

  return {
    startingBalanceCents,
    endingBalanceCents,
    endingDate,
    minimumBalanceCents,
    minimumBalanceDate,
    cashOutDate,
    totalInflowCents,
    totalOutflowCents,
    shortfallDays,
  };
}

export interface RunProjectionOptions {
  /** Overrides the horizon end date. Used by scenario comparison to align two ranges. */
  endDate?: IsoDate;
}

/** Runs a forecast end to end. The single entry point for every projection in the app. */
export function runProjection(forecast: Forecast, options: RunProjectionOptions = {}): Projection {
  assertIntegerCents(forecast.startingBalanceCents, "starting balance");

  const startDate = forecast.startDate;
  const endDate = options.endDate ?? horizonEndDate(startDate, forecast.horizon);
  const dates = eachDay(startDate, endDate);
  const ledger = buildLedger(forecast, startDate, endDate);
  const days = projectDays(forecast.startingBalanceCents, dates, ledger);

  return {
    currency: forecast.currency,
    startDate,
    endDate,
    horizon: forecast.horizon,
    days,
    summary: summarise(forecast.startingBalanceCents, days),
  };
}

/** Closing balance on a specific date, or `null` when the date is outside the projection. */
export function balanceOn(projection: Projection, date: IsoDate): number | null {
  const day = projection.days.find((candidate) => candidate.date === date);
  return day === undefined ? null : day.closingCents;
}

/** Net cash movement attributed to a named category, largest first. Used by the insight strip. */
export function categoryTotals(
  forecast: Forecast,
): Array<{ category: string; direction: "INFLOW" | "OUTFLOW"; totalCents: number }> {
  const totals = new Map<string, { direction: "INFLOW" | "OUTFLOW"; totalCents: number }>();

  const record = (
    category: string | undefined,
    direction: "INFLOW" | "OUTFLOW",
    amountCents: number,
  ): void => {
    const key = `${direction}:${category ?? "Uncategorised"}`;
    const existing = totals.get(key);
    if (existing === undefined) {
      totals.set(key, { direction, totalCents: amountCents });
    } else {
      existing.totalCents += amountCents;
    }
  };

  for (const item of forecast.recurringItems) {
    if (!item.isActive) continue;
    record(item.category, item.direction, item.amountCents);
  }
  for (const item of forecast.oneOffItems) {
    record(item.category, item.direction, item.amountCents);
  }

  return [...totals.entries()]
    .map(([key, value]) => ({ category: key.split(":").slice(1).join(":"), ...value }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

/** Days of runway from the start date, or `null` when cash never runs out. */
export function runwayDays(projection: Projection): number | null {
  const { cashOutDate } = projection.summary;
  if (cashOutDate === null) return null;
  return daysBetween(projection.startDate, cashOutDate);
}
