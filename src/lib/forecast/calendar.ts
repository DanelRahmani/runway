import { daysBetween, formatMonthKey, splitIsoDate, startOfWeek } from "@/lib/dates";
import type { IsoDate, ProjectionDay } from "@/types/forecast";

export interface CalendarCell {
  date: IsoDate;
  dayOfMonth: number;
  inflowCents: number;
  outflowCents: number;
  closingCents: number;
}

/** A Monday-based week row. `null` pads the first and last week of a month. */
export type CalendarWeek = readonly (CalendarCell | null)[];

export interface CalendarMonth {
  /** `YYYY-MM` of the month this grid shows. */
  key: string;
  /** `Mar 2026`. */
  label: string;
  weeks: readonly CalendarWeek[];
}

const WEEK_LENGTH = 7;

/**
 * The horizon laid out as month grids, Monday first.
 *
 * Only days inside the projection appear. A month the horizon enters part-way
 * through is drawn from that day onwards and its leading cells are empty, which
 * is why a cell is `null` — an absent day, not a day with nothing on it. The two
 * read very differently, and a calendar that conflated them would put a payday in
 * the wrong column.
 */
export function calendarMonths(
  days: readonly ProjectionDay[],
  locale?: string,
): CalendarMonth[] {
  const months: CalendarMonth[] = [];
  let cells: CalendarCell[] = [];
  let key = "";

  const flush = (): void => {
    const first = cells[0];
    if (first === undefined) return;

    // Pad by the first day's own weekday, then out to whole weeks.
    const offset = daysBetween(startOfWeek(first.date), first.date);
    const padded: (CalendarCell | null)[] = [];
    for (let index = 0; index < offset; index += 1) padded.push(null);
    padded.push(...cells);
    while (padded.length % WEEK_LENGTH !== 0) padded.push(null);

    const weeks: CalendarWeek[] = [];
    for (let index = 0; index < padded.length; index += WEEK_LENGTH) {
      weeks.push(padded.slice(index, index + WEEK_LENGTH));
    }

    months.push({ key, label: formatMonthKey(`${key}-01`, locale), weeks });
    cells = [];
  };

  for (const day of days) {
    const monthKey = day.date.slice(0, 7);
    if (monthKey !== key) {
      flush();
      key = monthKey;
    }

    const [, , dayOfMonth = 1] = splitIsoDate(day.date);
    cells.push({
      date: day.date,
      dayOfMonth,
      inflowCents: day.inflowCents,
      outflowCents: day.outflowCents,
      closingCents: day.closingCents,
    });
  }

  flush();
  return months;
}
