/**
 * Cache for `Intl` formatters.
 *
 * Constructing one is not free: it resolves locale data every time. The cash-flow
 * table formats thousands of cells in a single render, so building a fresh
 * instance per cell was real, repeated work — and formatters are immutable once
 * built, so one instance can serve every caller.
 *
 * Keys are assembled by the caller from primitives rather than passed through
 * `JSON.stringify`, so the lookup stays cheaper than the construction it avoids.
 *
 * No eviction: the key space is bounded by a handful of locales times a handful of
 * option combinations, which is a few dozen entries at most.
 */

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

export function numberFormat(
  key: string,
  locale: string | undefined,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const hit = numberFormats.get(key);
  if (hit !== undefined) return hit;

  const created = new Intl.NumberFormat(locale, options);
  numberFormats.set(key, created);
  return created;
}

export function dateFormat(
  key: string,
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const hit = dateFormats.get(key);
  if (hit !== undefined) return hit;

  const created = new Intl.DateTimeFormat(locale, options);
  dateFormats.set(key, created);
  return created;
}
