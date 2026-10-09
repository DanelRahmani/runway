import {
  daysBetween,
  endOfMonth,
  formatIsoDate,
  formatMonthKey,
  startOfMonth,
  startOfWeek,
} from "@/lib/dates";
import type { Granularity, IsoDate, ProjectionDay, ProjectionPeriod } from "@/types/forecast";

/**
 * Folds daily projection output into weekly or monthly periods.
 *
 * Periods are contiguous and inclusive on both ends: `openingCents` is the
 * opening balance of the first day in the bucket and `closingCents` is the
 * closing balance of the last, so a period's net change always reconciles to
 * `closing - opening` without any rounding step.
 */

/** Monday-based ISO week key for a date. */
function bucketStart(date: IsoDate, granularity: Granularity): IsoDate {
  switch (granularity) {
    case "daily":
      return date;
    case "weekly":
      return startOfWeek(date);
    case "monthly":
      return startOfMonth(date);
  }
}

export function aggregate(
  days: readonly ProjectionDay[],
  granularity: Granularity,
  locale?: string,
): ProjectionPeriod[] {
  if (days.length === 0) return [];
  if (granularity === "daily") {
    return days.map((day) => ({
      key: day.date,
      label: formatIsoDate(day.date, locale, false),
      startDate: day.date,
      endDate: day.date,
      openingCents: day.openingCents,
      inflowCents: day.inflowCents,
      outflowCents: day.outflowCents,
      netCents: day.netCents,
      closingCents: day.closingCents,
    }));
  }

  const periods: ProjectionPeriod[] = [];
  let current: ProjectionPeriod | null = null;

  for (const day of days) {
    const key = bucketStart(day.date, granularity);
    if (current === null || current.key !== key) {
      if (current !== null) periods.push(current);
      current = {
        key,
        label:
          granularity === "weekly"
            ? `${formatIsoDate(key, locale, false)} – ${formatIsoDate(day.date, locale)}`
            : formatMonthKey(key, locale),
        startDate: day.date,
        endDate: day.date,
        openingCents: day.openingCents,
        inflowCents: 0,
        outflowCents: 0,
        netCents: 0,
        closingCents: day.closingCents,
      };
    }

    current.endDate = day.date;
    current.inflowCents += day.inflowCents;
    current.outflowCents += day.outflowCents;
    current.netCents += day.netCents;
    current.closingCents = day.closingCents;
  }

  if (current !== null) periods.push(current);
  return periods;
}

/**
 * Aligns two projections by date for charting.
 *
 * Comparison runs over the union of both ranges so a scenario that was extended
 * or shortened still lines up; missing dates report `null` rather than zero, and
 * the chart renders a gap instead of a cliff to the axis.
 */
export function alignSeries(
  base: readonly ProjectionDay[],
  scenario: readonly ProjectionDay[],
  locale?: string,
): Array<{ date: IsoDate; label: string; baseCents: number | null; scenarioCents: number | null }> {
  const baseByDate = new Map(base.map((day) => [day.date, day.closingCents]));
  const scenarioByDate = new Map(scenario.map((day) => [day.date, day.closingCents]));

  const dates = [...new Set([...baseByDate.keys(), ...scenarioByDate.keys()])].sort();

  return dates.map((date) => ({
    date,
    label: formatIsoDate(date, locale, false),
    baseCents: baseByDate.get(date) ?? null,
    scenarioCents: scenarioByDate.get(date) ?? null,
  }));
}

/** Days in a full ISO week, for spotting a period that covers less than one. */
const DAYS_PER_WEEK = 7;

/** How many days a period actually covers, inclusive of both ends. */
export function periodDayCount(period: ProjectionPeriod): number {
  return daysBetween(period.startDate, period.endDate) + 1;
}

/**
 * True when a period covers less than a whole week or month.
 *
 * The first and last periods of a horizon usually do: a twelve-month forecast
 * starting on the 10th opens with a three-week October and closes with a nine-day
 * one. Their totals are real money, but they are not comparable with a full
 * period's — and a nine-day October that reports no salary at all reads as a bug
 * until the row says it is nine days long.
 */
export function isPartialPeriod(period: ProjectionPeriod, granularity: Granularity): boolean {
  switch (granularity) {
    case "daily":
      return false;
    case "weekly":
      return periodDayCount(period) !== DAYS_PER_WEEK;
    case "monthly":
      return (
        period.startDate !== startOfMonth(period.startDate) ||
        period.endDate !== endOfMonth(period.endDate)
      );
  }
}