import type { Currency } from "@/types/forecast";

/**
 * Every currency here stores 100 minor units per major unit.
 *
 * `ponytail:` JPY has no real sub-unit, so ¥1,500 is stored as `150000` and
 * displayed by dividing by 100. Keeping the scale uniform across currencies
 * means the arithmetic, the scenario presets and the import/export format never
 * need currency-specific branches. The ceiling is that JPY inputs with more
 * than two decimals would round — irrelevant for a planning tool.
 */
export const MINOR_UNITS_PER_MAJOR = 100;

/** Guard rail for `parseDecimalToCents`: keeps `intPart * 100` inside Number.MAX_SAFE_INTEGER. */
const MAX_INTEGER_DIGITS = 12;

export const CURRENCIES: readonly Currency[] = ["EUR", "USD", "JPY"];

const DECIMAL_RE = /^-?\d{1,12}(?:[.,]\d{1,6})?$/;

/** True when `value` is a whole number of minor units. */
export function isIntegerCents(value: number): boolean {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value);
}

/**
 * Throws when a value is not a whole number of minor units.
 *
 * This is the tripwire that stops floating-point money from entering the ledger:
 * every entry point (parsing, importing, form submit) runs through it, so a
 * `12.34` that should have been `1234` fails loudly in development instead of
 * quietly producing a balance that is off by a cent.
 */
export function assertIntegerCents(value: number, label = "amount"): number {
  if (!isIntegerCents(value)) {
    throw new TypeError(`Runway: ${label} must be an integer number of cents, received ${value}`);
  }
  return value;
}

/** Integer-safe sum. Every operand is validated as whole cents first. */
export function sumCents(...values: readonly number[]): number {
  let total = 0;
  for (const value of values) {
    total += assertIntegerCents(value);
  }
  return total;
}

export function addCents(a: number, b: number): number {
  return assertIntegerCents(a) + assertIntegerCents(b);
}

export function subtractCents(a: number, b: number): number {
  return assertIntegerCents(a) - assertIntegerCents(b);
}

export function absCents(value: number): number {
  return Math.abs(assertIntegerCents(value));
}

export function compareCents(a: number, b: number): number {
  return assertIntegerCents(a) - assertIntegerCents(b);
}

/**
 * Parses user input into whole cents without ever touching a float.
 *
 * Accepts `1500`, `1500.5`, `1500.55`, `1500,55` and `-20`. The third decimal
 * decides rounding, computed on the digit itself rather than through
 * `Number(x) * 100` (which loses a cent on inputs such as `19.99`).
 *
 * @returns whole cents, or `null` when the input is not a valid amount.
 */
export function parseDecimalToCents(raw: string): number | null {
  const trimmed = raw.trim().replace(/\s/g, "");
  if (trimmed === "") return null;
  if (!DECIMAL_RE.test(trimmed)) return null;

  const negative = trimmed.startsWith("-");
  const body = negative ? trimmed.slice(1) : trimmed;
  const [intPart = "0", fracPartRaw = ""] = body.split(/[.,]/);
  if (intPart.length > MAX_INTEGER_DIGITS) return null;

  // Pad to three digits so the third digit can drive half-up rounding.
  const frac = fracPartRaw.padEnd(3, "0");
  const kept = frac.slice(0, 2);
  const roundDigit = frac.charCodeAt(2) - 48;

  let cents = Number(intPart) * MINOR_UNITS_PER_MAJOR + Number(kept);
  if (roundDigit >= 5) cents += 1;

  return negative ? -cents : cents;
}

/** Inverse of {@link parseDecimalToCents}, for re-populating a money input field. */
export function centsToDecimalString(cents: number, currency: Currency): string {
  assertIntegerCents(cents);
  const negative = cents < 0;
  const magnitude = Math.abs(cents);
  const major = Math.floor(magnitude / MINOR_UNITS_PER_MAJOR);
  const minor = magnitude % MINOR_UNITS_PER_MAJOR;
  const sign = negative ? "-" : "";
  if (currency === "JPY") return `${sign}${major}`;
  return `${sign}${major}.${String(minor).padStart(2, "0")}`;
}

export interface FormatOptions {
  /** Override the browser locale. Tests pin this so expectations are stable. */
  locale?: string;
  /** Force a leading `+` on positive values, useful in delta tables. */
  signed?: boolean;
  /** Drop the currency symbol, useful inside an input's adornment. */
  bare?: boolean;
}

/**
 * Formats whole cents for display.
 *
 * `ponytail:` this divides by 100 purely to feed `Intl.NumberFormat`; that is
 * presentation, not accounting. Balances themselves are only ever added and
 * subtracted as integers.
 */
export function formatCents(cents: number, currency: Currency, options: FormatOptions = {}): string {
  assertIntegerCents(cents);
  const { locale, signed = false, bare = false } = options;
  const zeroDecimal = currency === "JPY";

  const formatter = new Intl.NumberFormat(locale, {
    style: bare ? "decimal" : "currency",
    currency,
    minimumFractionDigits: zeroDecimal ? 0 : 2,
    maximumFractionDigits: zeroDecimal ? 0 : 2,
    signDisplay: signed ? "exceptZero" : "auto",
  });

  return formatter.format(cents / MINOR_UNITS_PER_MAJOR);
}

/** Compact form for chart axes and KPI cards where space is tight. */
export function formatCentsCompact(cents: number, currency: Currency, locale?: string): string {
  assertIntegerCents(cents);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(cents / MINOR_UNITS_PER_MAJOR);
}

/** Plural-safe currency label, e.g. `EUR` → `euros`. Used in prose, not tables. */
export function currencyName(currency: Currency): string {
  switch (currency) {
    case "EUR":
      return "euros";
    case "USD":
      return "US dollars";
    case "JPY":
      return "yen";
  }
}
