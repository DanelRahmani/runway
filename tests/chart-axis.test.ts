import { describe, expect, it } from "vitest";

import { HEAT_LEVELS, boundsOf, heatLevel, paddedDomain } from "@/components/charts/chart-utils";
import { formatCentsCompact, formatCentsTick } from "@/lib/money";

/*
 * A money chart once took the whole page down: the axis asked for tick labels at
 * values like 54320.16, `formatCentsCompact` asserted that a tick is whole cents,
 * and the throw surfaced as an error screen. Two things had to be true at once —
 * a fractional axis domain, and a tick formatter that treated a coordinate as an
 * amount — so both are pinned here.
 */
describe("money axes", () => {
  it("gives the axis whole-cent bounds, padded outwards", () => {
    const cases: readonly (readonly number[])[] = [
      [70_000, 100_000],
      [0, 500_000],
      [1_999, 2_000],
      [5, 7],
      [123_456, 987_654],
      [-20_000, 40_000],
      [0, 0],
    ];

    for (const values of cases) {
      const [min, max] = paddedDomain(boundsOf(values));

      expect(Number.isInteger(min), `min ${min} for ${JSON.stringify(values)}`).toBe(true);
      expect(Number.isInteger(max), `max ${max} for ${JSON.stringify(values)}`).toBe(true);
      // Padding outwards, never inwards: the data has to stay inside the axis.
      expect(min).toBeLessThanOrEqual(Math.min(...values));
      expect(max).toBeGreaterThanOrEqual(Math.max(...values));
    }
  });

  it("formats fractional ticks without throwing", () => {
    // Values a charting library can hand a tick formatter; a real amount would be
    // a bug here, but a tick is a coordinate and this is the guard that says so.
    for (const tick of [54_320.16, -1_998.92, 0.5, 1_999.999, -0.4]) {
      expect(() => formatCentsTick(tick, "EUR")).not.toThrow();
    }

    expect(formatCentsTick(54_320.16, "EUR")).toBe(formatCentsCompact(54_320, "EUR"));
  });

  it("still refuses a fractional amount, which is a real bug", () => {
    // The guard is the point of formatCents; loosening it for ticks must not
    // loosen it for money.
    expect(() => formatCentsCompact(1_234.5, "EUR")).toThrow(/integer number of cents/);
  });
});

describe("annual heat levels", () => {
  it("puts zero on the dullest step and the bound on the brightest", () => {
    expect(heatLevel(0, 1_000)).toBe(0);
    expect(heatLevel(1_000, 1_000)).toBe(HEAT_LEVELS - 1);
  });

  it("reads a loss as strongly as a gain of the same size", () => {
    // The caller colours by sign; intensity is about magnitude, because a bad
    // month is exactly as worth finding as a good one.
    expect(heatLevel(-1_000, 1_000)).toBe(heatLevel(1_000, 1_000));
  });

  it("never leaves the range, however far past the bound a value goes", () => {
    for (const value of [0, 1, 500, 1_000, 5_000, 1_000_000, -1_000_000]) {
      const level = heatLevel(value, 1_000);
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(HEAT_LEVELS - 1);
    }
  });

  it("steps up rather than rounding a real movement away", () => {
    // Any movement at all has to leave the dullest step, or a small but genuine
    // month looks identical to a month with nothing in it.
    expect(heatLevel(1, 1_000)).toBeGreaterThan(0);
  });

  it("survives a bound of zero instead of dividing by it", () => {
    expect(heatLevel(0, 0)).toBe(0);
    expect(heatLevel(500, 0)).toBe(0);
  });
});
