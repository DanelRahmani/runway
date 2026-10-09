export interface DonutSlice {
  key: string;
  label: string;
  cents: number;
}

/**
 * The most slices a donut can carry before it stops being readable.
 *
 * Matches the length of the categorical colour scale. Past this the wedges get
 * too thin to compare and the colours stop being tellable apart, so the shape
 * stops carrying information — which is why the full category lists stay as bars.
 */
export const MAX_DONUT_SLICES = 6;

/**
 * Trims a list of slices to what a donut can actually show, folding the tail into
 * a single "Other".
 *
 * Assumes the input is already ordered largest first, which is how
 * `categoryTotals` returns it, so the head is the part worth showing.
 */
export function foldToDonutSlices(
  slices: readonly DonutSlice[],
  max: number = MAX_DONUT_SLICES,
): DonutSlice[] {
  const present = slices.filter((slice) => slice.cents > 0);

  if (present.length <= max) return present;

  const head = present.slice(0, max - 1);
  const tail = present.slice(max - 1);
  const otherCents = tail.reduce((sum, slice) => sum + slice.cents, 0);

  return [...head, { key: "other", label: `Other (${tail.length})`, cents: otherCents }];
}
