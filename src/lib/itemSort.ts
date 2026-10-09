import type { IsoDate } from "@/types/forecast";

/**
 * Sorting and filtering for the item tables.
 *
 * Comparators are returned from small factories so each table can compose its
 * own options without reimplementing the direction handling. Text comparison
 * uses `localeCompare` with numeric collation, so "Retainer 2" sorts before
 * "Retainer 10" rather than after it.
 */

export type SortDirection = "asc" | "desc";

export interface SortChoice {
  value: string;
  label: string;
}

/** Case-insensitive; every whitespace-separated term must appear. */
export function matchesQuery(
  query: string,
  ...fields: readonly (string | undefined)[]
): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const haystack = fields
    .filter((field): field is string => field !== undefined && field !== "")
    .join(" ")
    .toLowerCase();

  return terms.every((term) => haystack.includes(term));
}

function sign(direction: SortDirection): number {
  return direction === "asc" ? 1 : -1;
}

export function byCents(direction: SortDirection): (a: number, b: number) => number {
  const factor = sign(direction);
  return (a, b) => (a - b) * factor;
}

export function byText(direction: SortDirection): (a: string, b: string) => number {
  const factor = sign(direction);
  return (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }) * factor;
}

export function byDate(direction: SortDirection): (a: IsoDate, b: IsoDate) => number {
  const factor = sign(direction);
  // ISO dates compare correctly as strings, so no parsing is needed.
  return (a, b) => (a < b ? -1 : a > b ? 1 : 0) * factor;
}

/** Distinct, alphabetically ordered categories present in a list. */
export function distinctCategories(
  items: readonly { category?: string | undefined }[],
): string[] {
  const seen = new Set<string>();
  for (const item of items) {
    const category = item.category?.trim();
    if (category !== undefined && category !== "") seen.add(category);
  }
  return [...seen].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/** Sentinel used by a filter dropdown to mean "no filtering on this dimension". */
export const ALL_FILTER = "";

/** Compares an item's value against the active filter. */
export function matchesFilter(value: string | undefined, filter: string): boolean {
  if (filter === ALL_FILTER) return true;
  return (value ?? "") === filter;
}
