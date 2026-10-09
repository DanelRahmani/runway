import { numberFormat } from "@/lib/intl";
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

/** Guard rail for parsing: keeps `intPart * 100` inside Number.MAX_SAFE_INTEGER. */
const MAX_INTEGER_DIGITS = 12;

/**
 * Symbols stripped before parsing.
 *
 * Letter codes such as "CHF" or "kr" are deliberately not stripped: removing
 * letters from an amount risks quietly changing what the user typed.
 */
const CURRENCY_SYMBOLS = /[€$¥£₣]/g;

/**
 * Currencies conventionally written without decimals.
 *
 * They still store 100 minor units internally — only the display differs — so
 * the arithmetic never needs a currency-specific branch.
 */
const ZERO_DECIMAL: ReadonlySet<Currency> = new Set<Currency>(["JPY"]);

export function isZeroDecimal(currency: Currency): boolean {
  return ZERO_DECIMAL.has(currency);
}

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

/**
 * Which character is the decimal point, and which groups thousands, in a locale.
 *
 * Derived from `Intl` rather than a hardcoded table so it follows the user's own
 * locale. For nl-NL that is `,` and `.`; for en-US the other way round.
 */
function localeSeparators(locale?: string): { decimal: string; group: string } {
  const parts = numberFormat(`sep|${locale ?? ""}`, locale, {}).formatToParts(12_345.6);
  return {
    decimal: parts.find((part) => part.type === "decimal")?.value ?? ".",
    group: parts.find((part) => part.type === "group")?.value ?? ",",
  };
}

/**
 * True when `text` is well-formed thousands grouping with `separator`.
 *
 * Guards against reading nonsense as a number: `1.234.567` groups correctly,
 * `1.2.3` does not and should be refused rather than silently becoming 123.
 */
function isValidGrouping(text: string, separator: string): boolean {
  const groups = text.split(separator);
  const [first, ...rest] = groups;
  if (first === undefined || rest.length === 0) return false;
  if (!/^\d{1,3}$/.test(first)) return false;
  return rest.every((group) => /^\d{3}$/.test(group));
}

export interface ParseOptions {
  /** Overrides the locale used to interpret separators. Mostly for tests. */
  locale?: string;
}

export interface ParsedAmount {
  cents: number;
  /**
   * True when the typed value could not be represented exactly in cents and was
   * rounded. The UI uses this to tell the user what was stored.
   */
  rounded: boolean;
}

/**
 * Parses typed money into whole cents, tolerating how people actually write it.
 *
 * Accepts `1500`, `1500.5`, `1500,50`, `€ 1.500,50`, `1,234.56`, `1 234,56`,
 * `12.` and `.5`. Separators are resolved using the locale: when both a dot and
 * a comma appear, the rightmost is the decimal point and the other groups
 * thousands; a lone separator repeated more than once always groups.
 *
 * Values with more than two decimals are rounded half-up on the digit itself —
 * never via `Number(x) * 100`, which loses a cent on inputs like `19.99`.
 *
 * Returns `null` only when the input genuinely is not a number.
 */
export function parseAmount(raw: string, options: ParseOptions = {}): ParsedAmount | null {
  let text = raw
    .trim()
    .replace(CURRENCY_SYMBOLS, "")
    .replace(/[\s\u00A0\u202F]/g, "");

  if (text === "") return null;

  let negative = false;
  if (text.startsWith("-") || text.startsWith("(")) {
    negative = true;
    text = text.replace(/^[-(\s]+/, "");
  }
  text = text.replace(/^\+/, "").replace(/\)$/, "");

  // Anything left that is not a digit or a separator means this is not an amount.
  if (text === "" || !/^[\d.,]+$/.test(text)) return null;

  const { decimal, group } = localeSeparators(options.locale);
  /*
   * The character to treat as a grouping separator. Some locales group with a
   * space, which has already been stripped, so fall back to whichever of the two
   * familiar separators is not the decimal point.
   */
  const other = group === "." || group === "," ? group : decimal === "." ? "," : ".";

  let integerPart = text;
  let fractionPart = "";

  const lastDecimal = text.lastIndexOf(decimal);
  const lastOther = text.lastIndexOf(other);

  if (lastDecimal !== -1 && lastOther !== -1) {
    // Both kinds present, so the rightmost one is the decimal point.
    if (lastDecimal > lastOther) {
      integerPart = text.slice(0, lastDecimal).split(other).join("");
      fractionPart = text.slice(lastDecimal + 1);
    } else {
      integerPart = text.slice(0, lastOther).split(decimal).join("");
      fractionPart = text.slice(lastOther + 1);
    }
  } else if (lastDecimal !== -1) {
    const occurrences = text.split(decimal).length - 1;
    if (occurrences > 1) {
      // Repeated separators can only be grouping, and only if the groups are valid.
      if (!isValidGrouping(text, decimal)) return null;
      integerPart = text.split(decimal).join("");
    } else {
      integerPart = text.slice(0, lastDecimal);
      fractionPart = text.slice(lastDecimal + 1);
    }
  } else if (lastOther !== -1) {
    const occurrences = text.split(other).length - 1;
    if (occurrences > 1) {
      if (!isValidGrouping(text, other)) return null;
      integerPart = text.split(other).join("");
    } else {
      const digitsAfter = text.length - lastOther - 1;
      const digitsBefore = text.slice(0, lastOther).length;
      /*
       * A lone separator that is not this locale's decimal point. Three trailing
       * digits after a short group reads as grouping ("1,500" in en-US → 1500);
       * anything else is treated as a decimal point the user typed out of habit.
       */
      if (digitsAfter === 3 && digitsBefore >= 1 && digitsBefore <= 3) {
        integerPart = text.split(other).join("");
      } else {
        integerPart = text.slice(0, lastOther);
        fractionPart = text.slice(lastOther + 1);
      }
    }
  }

  integerPart = integerPart.replace(/\D/g, "");
  fractionPart = fractionPart.replace(/\D/g, "");

  if (integerPart.length > MAX_INTEGER_DIGITS) return null;
  // A trailing separator is someone mid-keystroke, not an error.
  if (integerPart === "" && fractionPart === "") return null;

  const spaced = fractionPart.slice(0, 3).padEnd(3, "0");
  const kept = spaced.slice(0, 2);
  const roundDigit = spaced.charCodeAt(2) - 48;

  let cents = Number(integerPart === "" ? "0" : integerPart) * MINOR_UNITS_PER_MAJOR + Number(kept);
  if (roundDigit >= 5) cents += 1;

  const rounded = fractionPart.slice(2).replace(/0+$/, "") !== "";

  return { cents: negative ? -cents : cents, rounded };
}

/**
 * Convenience wrapper returning just the cents.
 *
 * @returns whole cents, or `null` when the input is not a valid amount.
 */
export function parseDecimalToCents(raw: string, options: ParseOptions = {}): number | null {
  return parseAmount(raw, options)?.cents ?? null;
}

/**
 * Rounds any value to whole cents.
 *
 * Only for values that arrive from outside the ledger — a form field, an import,
 * or a future compounding calculation. Money inside the engine is never a float,
 * and `assertIntegerCents` remains the tripwire if one ever gets there.
 */
export function roundToCents(value: number): number {
  if (!Number.isFinite(value)) {
    throw new TypeError(`Runway: cannot round ${value} to cents`);
  }
  return Math.sign(value) * Math.round(Math.abs(value));
}

/** Inverse of {@link parseDecimalToCents}, for re-populating a money input field. */
export function centsToDecimalString(cents: number, currency: Currency): string {
  assertIntegerCents(cents);
  const negative = cents < 0;
  const magnitude = Math.abs(cents);
  const major = Math.floor(magnitude / MINOR_UNITS_PER_MAJOR);
  const minor = magnitude % MINOR_UNITS_PER_MAJOR;
  const sign = negative ? "-" : "";
  if (isZeroDecimal(currency)) return `${sign}${major}`;
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
  const zeroDecimal = isZeroDecimal(currency);

  const formatter = numberFormat(
    `cents|${locale ?? ""}|${currency}|${signed}|${bare}`,
    locale,
    {
      style: bare ? "decimal" : "currency",
      currency,
      minimumFractionDigits: zeroDecimal ? 0 : 2,
      maximumFractionDigits: zeroDecimal ? 0 : 2,
      signDisplay: signed ? "exceptZero" : "auto",
    },
  );

  return formatter.format(cents / MINOR_UNITS_PER_MAJOR);
}

/** Compact form for chart axes and KPI cards where space is tight. */
export function formatCentsCompact(cents: number, currency: Currency, locale?: string): string {
  assertIntegerCents(cents);
  return numberFormat(`compact|${locale ?? ""}|${currency}`, locale, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(cents / MINOR_UNITS_PER_MAJOR);
}

/**
 * Compact money for an axis tick.
 *
 * A tick is a **coordinate, not an amount**. It comes out of the charting
 * library's own tick algorithm, and that algorithm is free to land between whole
 * cents — it does so whenever the plotted range is narrow, because an explicit
 * axis domain pins ticks to its own endpoints. Handing such a value to
 * `formatCentsCompact` threw, which took the whole chart down over a rounded
 * label.
 *
 * So this rounds first, and `formatCents` and `formatCentsCompact` keep the assert
 * that still guards real money. If an amount reaches those with a fraction, that
 * is a bug worth failing on; a label two thirds of a cent below its tick is not.
 */
export function formatCentsTick(cents: number, currency: Currency, locale?: string): string {
  return formatCentsCompact(Number.isFinite(cents) ? Math.round(cents) : 0, currency, locale);
}

/**
 * The currency's symbol, for compact pickers where the code alone is ambiguous.
 *
 * Falls back to the code when a locale has no symbol for it — the point is to be
 * clearer than the bare code, never to render an empty space.
 */
export function currencySymbol(currency: Currency, locale?: string): string {
  const parts = numberFormat(`symbol|${locale ?? ""}|${currency}`, locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).formatToParts(0);

  return parts.find((part) => part.type === "currency")?.value ?? currency;
}

/**
 * Label for a currency picker: `"€ EUR"`, or just the code when there is no symbol.
 *
 * Some currencies genuinely have no symbol — English locales render CHF as the
 * letters "CHF" — and printing "CHF CHF" would read as a bug.
 */
export function currencyOptionLabel(currency: Currency, locale?: string): string {
  const symbol = currencySymbol(currency, locale);
  return symbol === currency ? currency : `${symbol} ${currency}`;
}

/**
 * Plural-safe currency label, e.g. `EUR` → `euros`. Used in prose, not tables.
 *
 * A `Record` rather than a `switch` so an added currency is a compile error here
 * rather than a silently missing case.
 */
const CURRENCY_NAMES: Record<Currency, string> = {
  EUR: "euros",
  USD: "US dollars",
  GBP: "pounds sterling",
  CHF: "Swiss francs",
  SEK: "Swedish kronor",
  NOK: "Norwegian kroner",
  DKK: "Danish kroner",
  PLN: "Polish zloty",
  CZK: "Czech koruna",
  CAD: "Canadian dollars",
  AUD: "Australian dollars",
  JPY: "yen",
};

export function currencyName(currency: Currency): string {
  return CURRENCY_NAMES[currency];
}
