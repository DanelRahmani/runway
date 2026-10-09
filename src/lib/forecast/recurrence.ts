import { addDays, addMonths, compareIsoDate, minIsoDate } from "@/lib/dates";
import type { Frequency, InvoiceRecurrence, IsoDate } from "@/types/forecast";

/**
 * Occurrence generation for recurring entries.
 *
 * Every generator steps from a fixed anchor (`k * period`) rather than advancing
 * from the previous occurrence. That is what keeps a monthly item anchored to
 * the 31st landing on 28 Feb, then 31 Mar, then 30 Apr — instead of clamping to
 * the 28th once and staying there.
 */

/**
 * `ponytail:` occurrences are found by stepping forward until the range ends.
 * Bounded at 1000 iterations, which covers a yearly item across ~1000 years.
 * If a range ever needed more, generate the count arithmetically instead.
 */
const MAX_OCCURRENCES = 1000;

export interface OccurrenceOptions {
  /** First date the caller cares about. Occurrences before it are discarded. */
  rangeStart: IsoDate;
  /** Last date the caller cares about, inclusive. */
  rangeEnd: IsoDate;
  /** Optional end of the recurrence itself, inclusive. */
  endDate?: IsoDate | undefined;
}

/** The anchor date shifted by `count` periods. */
export function shiftByFrequency(anchor: IsoDate, frequency: Frequency, count: number): IsoDate {
  switch (frequency) {
    case "WEEKLY":
      return addDays(anchor, 7 * count);
    case "BIWEEKLY":
      return addDays(anchor, 14 * count);
    case "MONTHLY":
      return addMonths(anchor, count);
    case "QUARTERLY":
      return addMonths(anchor, 3 * count);
    case "YEARLY":
      return addMonths(anchor, 12 * count);
  }
}

/**
 * Every date a recurring entry fires on inside `[rangeStart, rangeEnd]`.
 *
 * Occurrences earlier than the forecast are skipped, not accumulated: an item
 * that started three years ago must not inject cash on day one.
 */
export function recurringOccurrences(
  anchor: IsoDate,
  frequency: Frequency,
  options: OccurrenceOptions,
): IsoDate[] {
  const { rangeStart, rangeEnd, endDate } = options;
  if (compareIsoDate(anchor, rangeEnd) > 0) return [];
  if (endDate !== undefined && compareIsoDate(endDate, rangeStart) < 0) return [];

  const hardEnd = endDate !== undefined ? minIsoDate(endDate, rangeEnd) : rangeEnd;

  const occurrences: IsoDate[] = [];
  for (let count = 0; count < MAX_OCCURRENCES; count += 1) {
    const date = shiftByFrequency(anchor, frequency, count);
    if (compareIsoDate(date, hardEnd) > 0) break;
    if (compareIsoDate(date, rangeStart) >= 0) occurrences.push(date);
  }
  return occurrences;
}

export function invoiceRecurrenceToFrequency(recurrence: InvoiceRecurrence): Frequency | null {
  switch (recurrence) {
    case "NONE":
      return null;
    case "MONTHLY":
      return "MONTHLY";
    case "QUARTERLY":
      return "QUARTERLY";
  }
}

/**
 * Dates an invoice is expected to be paid on: `expectedPaymentDate` plus the
 * delay allowance, repeated per its recurrence.
 *
 * The issue date is deliberately ignored — what matters for cash flow is when
 * the money lands, not when the paperwork was raised.
 */
export function invoiceOccurrences(
  expectedPaymentDate: IsoDate,
  paymentDelayDays: number,
  recurrence: InvoiceRecurrence,
  options: OccurrenceOptions,
): IsoDate[] {
  const effectiveDate = addDays(expectedPaymentDate, paymentDelayDays);
  const frequency = invoiceRecurrenceToFrequency(recurrence);
  if (frequency === null) {
    if (compareIsoDate(effectiveDate, options.rangeStart) < 0) return [];
    if (compareIsoDate(effectiveDate, options.rangeEnd) > 0) return [];
    if (options.endDate !== undefined && compareIsoDate(effectiveDate, options.endDate) > 0) return [];
    return [effectiveDate];
  }
  return recurringOccurrences(effectiveDate, frequency, options);
}
