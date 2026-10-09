import { dateFormat } from "@/lib/intl";
import type { Horizon, IsoDate } from "@/types/forecast";

/**
 * All calendar maths in Runway happens on `YYYY-MM-DD` strings.
 *
 * The one rule that keeps forecasts from drifting: dates are only ever
 * materialised through `Date.UTC`, and are only ever read back through
 * `getUTC*`. A `new Date("2026-03-29")` or a local `getDate()` would shift the
 * day under a non-UTC timezone and silently move a rent payment by 24 hours.
 */

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const DAY_MS = 86_400_000;

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** True when `value` is a real calendar date in `YYYY-MM-DD` form (rejects 2026-02-30). */
export function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

/** Days in a 1-indexed month, leap years included. */
export function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one — handles leap years.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function makeIsoDate(year: number, month: number, day: number): IsoDate {
  return `${String(year).padStart(4, "0")}-${pad2(month)}-${pad2(day)}`;
}

/** Midnight UTC for the given calendar date. Safe to convert back with `toIsoDate`. */
export function parseIsoDate(value: IsoDate): Date {
  const match = ISO_DATE_RE.exec(value);
  if (!match) throw new RangeError(`Runway: "${value}" is not a valid ISO date`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function toIsoDate(date: Date): IsoDate {
  return makeIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** Today in the browser's local calendar, which is the day the user actually sees. */
export function todayIso(): IsoDate {
  const now = new Date();
  return makeIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function addDays(value: IsoDate, days: number): IsoDate {
  const date = parseIsoDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

/**
 * Adds calendar months, clamping to the last day when the target day does not
 * exist (Jan 31 + 1 month → Feb 28/29).
 *
 * Always add from a fixed anchor, never from the previous result: chaining
 * would let Jan 31 drift to Feb 28 and then to Mar 28, losing the 31st forever.
 */
export function addMonths(value: IsoDate, months: number): IsoDate {
  const [year = 0, month = 1, day = 1] = splitIsoDate(value);
  const totalMonths = month - 1 + months;
  const targetYear = year + Math.floor(totalMonths / 12);
  const targetMonth = (((totalMonths % 12) + 12) % 12) + 1;
  return makeIsoDate(targetYear, targetMonth, Math.min(day, daysInMonth(targetYear, targetMonth)));
}

export function addYears(value: IsoDate, years: number): IsoDate {
  return addMonths(value, years * 12);
}

export function splitIsoDate(value: IsoDate): [number, number, number] {
  const match = ISO_DATE_RE.exec(value);
  if (!match) throw new RangeError(`Runway: "${value}" is not a valid ISO date`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Whole days from `from` to `to`. Negative when `to` is earlier. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / DAY_MS);
}

/** Lexicographic compare is correct for zero-padded ISO dates. */
export function compareIsoDate(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minIsoDate(a: IsoDate, b: IsoDate): IsoDate {
  return a <= b ? a : b;
}

export function maxIsoDate(a: IsoDate, b: IsoDate): IsoDate {
  return a >= b ? a : b;
}

export function isWithinRange(value: IsoDate, start: IsoDate, end: IsoDate): boolean {
  return value >= start && value <= end;
}

/** Monday-based start of the ISO week. */
export function startOfWeek(value: IsoDate): IsoDate {
  const date = parseIsoDate(value);
  const weekday = date.getUTCDay(); // 0 = Sunday
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return addDays(value, offset);
}

export function startOfMonth(value: IsoDate): IsoDate {
  const [year = 0, month = 1] = splitIsoDate(value);
  return makeIsoDate(year, month, 1);
}

export function endOfMonth(value: IsoDate): IsoDate {
  const [year = 0, month = 1] = splitIsoDate(value);
  return makeIsoDate(year, month, daysInMonth(year, month));
}

/** Inclusive list of every date from `start` to `end`. */
export function eachDay(start: IsoDate, end: IsoDate): IsoDate[] {
  const dates: IsoDate[] = [];
  const total = daysBetween(start, end);
  for (let index = 0; index <= total; index += 1) {
    dates.push(addDays(start, index));
  }
  return dates;
}

export const HORIZON_LABELS: Record<Horizon, string> = {
  THIRTEEN_WEEKS: "13 weeks",
  SIX_MONTHS: "6 months",
  TWELVE_MONTHS: "12 months",
};

export const HORIZONS: readonly Horizon[] = ["THIRTEEN_WEEKS", "SIX_MONTHS", "TWELVE_MONTHS"];

/**
 * Last day included in the projection.
 *
 * The horizon is inclusive, so 13 weeks means 91 projected days.
 *
 * For the month-based horizons the anniversary is one day past the end, except
 * when `addMonths` had to clamp: starting on 29 Feb 2024, the twelve-month
 * anniversary clamps to 28 Feb 2025, and that clamped date is already the last
 * day of the final month. Subtracting a day there would drop 28 February from
 * the horizon entirely.
 */
export function horizonEndDate(startDate: IsoDate, horizon: Horizon): IsoDate {
  switch (horizon) {
    case "THIRTEEN_WEEKS":
      return addDays(startDate, 13 * 7 - 1);
    case "SIX_MONTHS":
      return monthsHorizonEnd(startDate, 6);
    case "TWELVE_MONTHS":
      return monthsHorizonEnd(startDate, 12);
  }
}

function monthsHorizonEnd(startDate: IsoDate, months: number): IsoDate {
  const anniversary = addMonths(startDate, months);
  const [, , startDay] = splitIsoDate(startDate);
  const [, , anniversaryDay] = splitIsoDate(anniversary);
  if (anniversaryDay < startDay) return anniversary;
  return addDays(anniversary, -1);
}

export function horizonDayCount(horizon: Horizon): number {
  switch (horizon) {
    case "THIRTEEN_WEEKS":
      return 13 * 7;
    case "SIX_MONTHS":
      return 183;
    case "TWELVE_MONTHS":
      return 366;
  }
}

/** `2026-03-29` → `29 Mar 2026`. Locale-aware but timezone-free. */
export function formatIsoDate(value: IsoDate, locale?: string, withYear = true): string {
  const [year = 0, month = 1, day = 1] = splitIsoDate(value);
  const monthLabel = MONTH_LABELS[month - 1] ?? "";
  if (!withYear) return `${day} ${monthLabel}`;
  // Assemble manually: `toLocaleDateString` would reintroduce timezone risk.
  const localised = dateFormat(`iso|${locale ?? ""}`, locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseIsoDate(value));
  return localised === "Invalid Date" ? `${day} ${monthLabel} ${year}` : localised;
}

export function formatIsoDateRange(start: IsoDate, end: IsoDate, locale?: string): string {
  return `${formatIsoDate(start, locale, false)} – ${formatIsoDate(end, locale)}`;
}

/** `2026-03` → `Mar 2026`. */
export function formatMonthKey(value: IsoDate, locale?: string): string {
  return dateFormat(`month|${locale ?? ""}`, locale, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseIsoDate(value));
}
