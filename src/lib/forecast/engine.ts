import { isRunningCostCategory } from "@/lib/categories";
import { daysBetween, eachDay, horizonEndDate, nextWorkingDay } from "@/lib/dates";
import { assertIntegerCents } from "@/lib/money";
import { invoiceOccurrences, recurringOccurrences } from "@/lib/forecast/recurrence";
import type {
  CategoryTotal,
  Forecast,
  IsoDate,
  ItemImpact,
  Projection,
  ProjectionDay,
  ProjectionEntry,
  ProjectionSummary,
  RecurringItem,
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

/** Bucket label for entries with no category of their own. */
export const UNCATEGORISED = "Uncategorised";

/** Invoices have a client rather than a category; this is how they appear in breakdowns. */
export const INVOICE_CATEGORY = "Client income";

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

  const seasonal = normalisedSeasonality(forecast.seasonalCostPercent);
  const shiftWeekends = forecast.weekendShifting === true;
  // Applied to recurring items and invoices — the entries whose date comes from a
  // schedule. A one-off is a date the user typed, so moving it would silently
  // contradict the date shown in its own table row.
  const onTime = (date: IsoDate): IsoDate =>
    shiftWeekends ? nextWorkingDay(date) : date;

  for (const item of forecast.recurringItems) {
    if (!item.isActive) continue;
    assertIntegerCents(item.amountCents, `recurring item "${item.name}"`);
    if (item.amountCents === 0) continue;

    const occurrences = recurringOccurrences(item.startDate, item.frequency, {
      ...range,
      endDate: item.endDate,
      anchor: item.anchor,
    });

    for (const date of occurrences) {
      const landed = onTime(date);
      pushEntry(ledger, landed, {
        source: "recurring",
        id: item.id,
        label: item.name,
        direction: item.direction,
        amountCents: seasonalAmount(item, landed, seasonal),
        category: item.category ?? UNCATEGORISED,
      });
    }
  }

  // No `onTime` or seasonality here on purpose: a one-off is an exact date the user
  // chose for a specific event, not a schedule to be interpreted.
  for (const item of forecast.oneOffItems) {
    assertIntegerCents(item.amountCents, `one-off item "${item.name}"`);
    if (item.amountCents === 0) continue;

    pushEntry(ledger, item.date, {
      source: "one-off",
      id: item.id,
      label: item.name,
      direction: item.direction,
      amountCents: item.amountCents,
      category: item.category ?? UNCATEGORISED,
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
      pushEntry(ledger, onTime(date), {
        source: "invoice",
        id: invoice.id,
        label: invoice.clientName,
        direction: "INFLOW",
        amountCents: invoice.amountCents,
        // Invoices carry a client, not a category. Labelling them here keeps the
        // category breakdown a complete picture of inbound money.
        category: INVOICE_CATEGORY,
      });
    }
  }

  return ledger;
}

/**
 * The seasonality factors, or `undefined` when there is nothing to apply.
 *
 * Returning `undefined` rather than a list of 100s keeps the ordinary case out of
 * the arithmetic altogether, so a forecast that never touched seasonality takes
 * exactly the code path it always did.
 */
function normalisedSeasonality(
  percent: readonly number[] | undefined,
): readonly number[] | undefined {
  if (percent === undefined) return undefined;
  if (percent.every((value) => value === 100)) return undefined;
  return percent;
}

/**
 * A recurring amount for the month it lands in.
 *
 * Seasonality applies to running costs only. A transfer is not a cost, tax is not
 * the user's to vary, an invoice is income, and a one-off already carries a chosen
 * date — scaling any of those would answer a question nobody asked. A month at 100
 * is left alone rather than multiplied by one.
 */
function seasonalAmount(
  item: RecurringItem,
  date: IsoDate,
  percent: readonly number[] | undefined,
): number {
  if (percent === undefined) return item.amountCents;
  if (item.direction !== "OUTFLOW") return item.amountCents;
  if (!isRunningCostCategory(item.category)) return item.amountCents;

  const factor = percent[Number(date.slice(5, 7)) - 1];
  if (factor === undefined || factor === 100) return item.amountCents;

  // Rounded to whole cents: a percentage of an amount is not itself a whole number
  // of them, and the ledger holds nothing else.
  return Math.round((item.amountCents * factor) / 100);
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

/**
 * Total movement per category across the **whole horizon**, largest first.
 *
 * Derived from the projection rather than the raw items, so a monthly cost is
 * counted every month it fires. Summing item amounts instead would report a
 * year of rent as a single month.
 */
export function categoryTotals(projection: Projection): CategoryTotal[] {
  const totals = new Map<string, CategoryTotal>();

  for (const day of projection.days) {
    for (const entry of day.entries) {
      const key = `${entry.direction}:${entry.category}`;
      const existing = totals.get(key);
      if (existing === undefined) {
        totals.set(key, {
          category: entry.category,
          direction: entry.direction,
          totalCents: entry.amountCents,
        });
      } else {
        existing.totalCents += entry.amountCents;
      }
    }
  }

  return [...totals.values()].sort((a, b) => b.totalCents - a.totalCents);
}

/**
 * What each individual item or invoice actually does to the forecast.
 *
 * Keyed by `source:id` so a table row can look up its own impact. This is where
 * the occurrence count lives, which is what makes "12 occurrences, €16,200"
 * possible for a monthly item.
 */
export function itemImpact(projection: Projection): Map<string, ItemImpact> {
  const impacts = new Map<string, ItemImpact>();

  for (const day of projection.days) {
    for (const entry of day.entries) {
      const key = `${entry.source}:${entry.id}`;
      const existing = impacts.get(key);
      if (existing === undefined) {
        impacts.set(key, {
          source: entry.source,
          id: entry.id,
          label: entry.label,
          direction: entry.direction,
          category: entry.category,
          amountCents: entry.amountCents,
          totalCents: entry.amountCents,
          occurrences: 1,
          firstDate: day.date,
          lastDate: day.date,
        });
      } else {
        existing.totalCents += entry.amountCents;
        existing.occurrences += 1;
        existing.lastDate = day.date;
      }
    }
  }

  return impacts;
}

/** Impact for one entry, or `null` when it never fires inside the horizon. */
export function impactFor(
  impacts: Map<string, ItemImpact>,
  source: ItemImpact["source"],
  id: string,
): ItemImpact | null {
  return impacts.get(`${source}:${id}`) ?? null;
}

/** Days of runway from the start date, or `null` when cash never runs out. */
export function runwayDays(projection: Projection): number | null {
  const { cashOutDate } = projection.summary;
  if (cashOutDate === null) return null;
  return daysBetween(projection.startDate, cashOutDate);
}
