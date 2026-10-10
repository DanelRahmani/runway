import { describe, expect, it } from "vitest";

import {
  SAFE_DAY_OF_MONTH_MAX,
  isWeekend,
  nextDayOfMonthOnOrAfter,
  nextWorkingDay,
} from "@/lib/dates";
import { ordinalDay } from "@/lib/utils";

describe("day-of-month anchoring", () => {
  it("stays inside the month when the day is still to come", () => {
    expect(nextDayOfMonthOnOrAfter("2026-01-03", 25)).toBe("2026-01-25");
  });

  it("keeps the date itself when the day already matches", () => {
    expect(nextDayOfMonthOnOrAfter("2026-03-25", 25)).toBe("2026-03-25");
  });

  it("rolls into the next month when the day has passed", () => {
    expect(nextDayOfMonthOnOrAfter("2026-01-28", 25)).toBe("2026-02-25");
  });

  it("rolls the year over from December", () => {
    expect(nextDayOfMonthOnOrAfter("2026-12-28", 25)).toBe("2027-01-25");
  });

  it("refuses a day that February cannot have", () => {
    // The guard is the point. A monthly item anchors to its start day, so clamping
    // "the 31st" to the 28th once would keep the 28th for the rest of the year —
    // a silent change of meaning rather than a bad date.
    expect(() => nextDayOfMonthOnOrAfter("2026-01-01", 31)).toThrow(/must be/);
    expect(() => nextDayOfMonthOnOrAfter("2026-01-01", 0)).toThrow(/must be/);
    expect(() => nextDayOfMonthOnOrAfter("2026-01-01", 1.5)).toThrow(/must be/);
  });

  it("claims only the days that every month has", () => {
    expect(SAFE_DAY_OF_MONTH_MAX).toBe(28);
  });
});

describe("working days", () => {
  it("knows a weekend when it sees one", () => {
    expect(isWeekend("2026-01-02")).toBe(false); // Friday
    expect(isWeekend("2026-01-03")).toBe(true); // Saturday
    expect(isWeekend("2026-01-04")).toBe(true); // Sunday
    expect(isWeekend("2026-01-05")).toBe(false); // Monday
  });

  it("moves a weekend date on to the Monday and leaves a weekday alone", () => {
    expect(nextWorkingDay("2026-01-03")).toBe("2026-01-05");
    expect(nextWorkingDay("2026-01-04")).toBe("2026-01-05");
    expect(nextWorkingDay("2026-01-05")).toBe("2026-01-05");
  });

  it("crosses a month boundary to reach one", () => {
    // 31 January 2026 is a Saturday, so the next working day is in February.
    expect(nextWorkingDay("2026-01-31")).toBe("2026-02-02");
  });
});

describe("ordinal day", () => {
  it("uses the right suffix for ordinary days", () => {
    expect(ordinalDay(1)).toBe("1st");
    expect(ordinalDay(2)).toBe("2nd");
    expect(ordinalDay(3)).toBe("3rd");
    expect(ordinalDay(4)).toBe("4th");
    expect(ordinalDay(21)).toBe("21st");
    expect(ordinalDay(22)).toBe("22nd");
    expect(ordinalDay(23)).toBe("23rd");
  });

  it("does not call the eleventh the 11st", () => {
    // The teens are exactly why this is a function rather than a suffix append —
    // the same class of bug as pluralising by adding an `s`.
    expect(ordinalDay(11)).toBe("11th");
    expect(ordinalDay(12)).toBe("12th");
    expect(ordinalDay(13)).toBe("13th");
  });

  it("gives every day in the safe range a real suffix", () => {
    for (let day = 1; day <= SAFE_DAY_OF_MONTH_MAX; day += 1) {
      expect(ordinalDay(day)).toMatch(/^\d+(st|nd|rd|th)$/);
    }
  });
});
