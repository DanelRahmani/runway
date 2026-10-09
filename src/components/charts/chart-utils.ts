/**
 * Chart helpers.
 *
 * Note on numbers: values reach the chart as integer cents and are only divided
 * by 100 inside a tick or tooltip formatter. Recharts does its own floating-point
 * work to place pixels — that is rendering, not accounting, and the numbers the
 * user reads always come from `formatCents`.
 */

/**
 * Fraction of the vertical span that sits above zero.
 *
 * Drives the split gradient so the area below the zero line is painted red and
 * everything above it is green, without needing two stacked series.
 */
export function computeGradientOffset(minCents: number, maxCents: number): number {
  if (maxCents <= 0) return 0;
  if (minCents >= 0) return 1;
  return maxCents / (maxCents - minCents);
}

export interface SeriesBounds {
  min: number;
  max: number;
}

export function boundsOf(values: readonly (number | null | undefined)[]): SeriesBounds {
  const present = values.filter((value): value is number => typeof value === "number");
  if (present.length === 0) return { min: 0, max: 0 };
  return { min: Math.min(...present), max: Math.max(...present) };
}

/** Pads the axis so the zero line and the minimum point are never flush with the edge. */
export function paddedDomain(bounds: SeriesBounds): [number, number] {
  const { min, max } = bounds;
  if (min === 0 && max === 0) return [-100, 100];
  const span = max - min;
  const pad = span === 0 ? Math.abs(max) * 0.2 || 100 : span * 0.08;
  /*
   * Rounded outwards to whole cents. A cent is the smallest amount that exists
   * here, so an axis bound of 54320.16 is not a number the app can mean — and an
   * explicit domain makes the charting library pin ticks to its own endpoints,
   * which then comes back as fractional tick labels for a money axis to format.
   * Floor and ceil rather than round, so the padding is never reduced away.
   */
  return [Math.floor(min - pad), Math.ceil(max + pad)];
}

/**
 * Stable colour pair for the charts.
 *
 * These read the same CSS custom properties the rest of the app uses, so the
 * charts follow the theme automatically instead of hard-coding a palette.
 */
export const CHART_COLORS = {
  positive: "var(--positive)",
  negative: "var(--negative)",
  balance: "var(--chart-balance)",
  scenario: "var(--chart-scenario)",
  grid: "var(--border)",
  muted: "var(--muted-foreground)",
} as const;

/**
 * Cycled palette for charts with more than one series.
 *
 * The theme colour ramp, in the order it is meant to be read.
 *
 * ponytail: wraps rather than generating hues. The ceiling is six visually
 * distinct series — past six, lines repeat a colour and only the legend and the
 * tooltip tell them apart. Upgrade path is a perceptual ramp (for example the
 * Okabe-Ito set) if a chart ever routinely exceeds six series.
 */
export const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
] as const;

/** Colour for the nth series, cycling once the ramp runs out. */
export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length] ?? "var(--chart-1)";
}
