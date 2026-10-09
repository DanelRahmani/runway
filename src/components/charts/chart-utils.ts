import type { Currency } from "@/types/forecast";

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
  return [min - pad, max + pad];
}

/** Stable, themeable colour pair. Kept as literals because Recharts needs real values. */
export const CHART_COLORS = {
  positive: "var(--positive)",
  negative: "var(--negative)",
  balance: "var(--chart-balance)",
  scenario: "var(--chart-scenario)",
  grid: "var(--border)",
  muted: "var(--muted-foreground)",
} as const;

export function currencyAxisLabel(currency: Currency): string {
  return currency;
}
