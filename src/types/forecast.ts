/**
 * Core domain types for Runway.
 *
 * Money rule: every monetary value in this codebase is an integer number of
 * minor units ("cents") of the forecast currency. Nothing else is ever stored
 * or passed around, so no floating-point rounding can creep into a balance.
 */

/**
 * Supported currencies.
 *
 * Declared once as a tuple so the union type, the picker and the validator all
 * derive from the same list — adding a currency here is the only edit needed.
 * (It previously lived in three places and would have drifted the moment one
 * was changed.)
 */
export const CURRENCIES = [
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "CZK",
  "CAD",
  "AUD",
  "JPY",
] as const;

export type Currency = (typeof CURRENCIES)[number];

export type Direction = "INFLOW" | "OUTFLOW";

export type Frequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";

/**
 * How a monthly-style entry picks its day.
 *
 * `DAY` keeps the anchor's day number — the 15th stays the 15th. `MONTH_END`
 * always lands on the last day of the period, which is how salaries, rent and
 * most direct debits actually behave. Month lengths differ, so month-end is
 * recomputed for every period rather than stored once.
 */
export type RecurrenceAnchor = "DAY" | "MONTH_END";

export type Horizon = "THIRTEEN_WEEKS" | "SIX_MONTHS" | "TWELVE_MONTHS";

export type InvoiceStatus = "EXPECTED" | "PAID" | "CANCELLED";

export type InvoiceRecurrence = "NONE" | "MONTHLY" | "QUARTERLY";

/**
 * Whether a forecast describes personal or business money.
 *
 * Purely a label that shapes the defaults, the starter items and how the list
 * is grouped — it changes nothing about the maths. Optional because forecasts
 * exported before this field existed must still import.
 */
export type ForecastKind = "PERSONAL" | "BUSINESS";

/** Calendar date as `YYYY-MM-DD`. Always interpreted as a wall-clock date, never as a UTC instant. */
export type IsoDate = string;

export interface RecurringItem {
  id: string;
  name: string;
  direction: Direction;
  amountCents: number;
  frequency: Frequency;
  startDate: IsoDate;
  /**
   * Defaults to `DAY`. Ignored for weekly cadences, which have no month end.
   * Optional so items saved before this existed keep their anchor day.
   */
  anchor?: RecurrenceAnchor;
  endDate?: string;
  category?: string;
  note?: string;
  isActive: boolean;
}

export interface OneOffItem {
  id: string;
  name: string;
  direction: Direction;
  amountCents: number;
  date: IsoDate;
  category?: string;
  note?: string;
}

export interface Invoice {
  id: string;
  clientName: string;
  amountCents: number;
  issueDate: IsoDate;
  expectedPaymentDate: IsoDate;
  paymentDelayDays: number;
  status: InvoiceStatus;
  recurrence: InvoiceRecurrence;
}

/**
 * A named target the forecast is working towards.
 *
 * Stored on the forecast rather than in its own table: a goal only has meaning
 * against one set of assumptions, and a scenario should be free to chase a
 * different one.
 */
export interface ForecastGoal {
  label: string;
  targetCents: number;
  targetDate: IsoDate;
}

export interface Forecast {
  id: string;
  name: string;
  /**
   * Personal or business. Undefined means unspecified, which is how forecasts
   * created before this field existed (or imported from an old export) appear.
   */
  forecastKind?: ForecastKind;
  currency: Currency;
  startingBalanceCents: number;
  startDate: IsoDate;
  horizon: Horizon;
  notes?: string;
  /** Optional savings target. Absent means this forecast is not chasing one. */
  goal?: ForecastGoal;
  recurringItems: RecurringItem[];
  oneOffItems: OneOffItem[];
  invoices: Invoice[];
  createdAt: string;
  updatedAt: string;
  /**
 * Scenarios are ordinary forecasts that point at the forecast they were
 * duplicated from. `baseForecastId` is undefined for a base forecast.
 */
  baseForecastId?: string;
  scenarioLabel?: string;
  archived?: boolean;
}

/* ------------------------------------------------------------------ engine -- */

export interface ProjectionEntry {
  source: "recurring" | "one-off" | "invoice";
  id: string;
  label: string;
  direction: Direction;
  amountCents: number;
  /**
   * Carried through so the breakdown can be computed from the projection rather
   * than from the raw items. That matters: an item's `amountCents` is one
   * occurrence, so summing items would report a monthly rent as a single month
   * instead of the whole horizon.
   */
  category: string;
}

/** A category's total movement across the whole projection. */
export interface CategoryTotal {
  category: string;
  direction: Direction;
  totalCents: number;
}

/** How much one item or invoice actually costs or earns across the horizon. */
export interface ItemImpact {
  source: ProjectionEntry["source"];
  id: string;
  label: string;
  direction: Direction;
  category: string;
  /** The per-occurrence amount. */
  amountCents: number;
  /** `amountCents × occurrences`. */
  totalCents: number;
  occurrences: number;
  firstDate: IsoDate;
  lastDate: IsoDate;
}

export interface ProjectionDay {
  date: IsoDate;
  openingCents: number;
  inflowCents: number;
  outflowCents: number;
  /** `inflowCents - outflowCents`. Never a float: both operands are integers. */
  netCents: number;
  closingCents: number;
  entries: ProjectionEntry[];
}

export type Granularity = "daily" | "weekly" | "monthly";

/** Display labels for the granularity steps, kept beside the type so they agree. */
export const GRANULARITY_LABELS: Record<Granularity, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export interface ProjectionPeriod {
  /** Stable key for React lists: the period start date. */
  key: IsoDate;
  label: string;
  startDate: IsoDate;
  endDate: IsoDate;
  openingCents: number;
  inflowCents: number;
  outflowCents: number;
  netCents: number;
  closingCents: number;
}

export interface ProjectionSummary {
  startingBalanceCents: number;
  endingBalanceCents: number;
  endingDate: IsoDate;
  minimumBalanceCents: number;
  minimumBalanceDate: IsoDate;
  /** First date the closing balance is strictly negative, or null if it never is. */
  cashOutDate: IsoDate | null;
  totalInflowCents: number;
  totalOutflowCents: number;
  /** Number of days the closing balance is negative. */
  shortfallDays: number;
}

export interface Projection {
  currency: Currency;
  startDate: IsoDate;
  endDate: IsoDate;
  horizon: Horizon;
  days: ProjectionDay[];
  summary: ProjectionSummary;
}

/** Row shape handed to the comparison chart: one calendar date, two series. */
export interface ChartPoint {
  date: IsoDate;
  label: string;
  baseCents: number | null;
  scenarioCents: number | null;
}

export interface ScenarioDiff {
  baseName: string;
  scenarioName: string;
  /** Full summaries for both sides, so a table can show Base | Scenario | Difference. */
  baseSummary: ProjectionSummary;
  scenarioSummary: ProjectionSummary;
  endingDeltaCents: number;
  minimumDeltaCents: number;
  totalInflowDeltaCents: number;
  totalOutflowDeltaCents: number;
  /** Positive means the scenario runs out of cash that many days later. Null when either side never runs out. */
  cashOutDeltaDays: number | null;
  /** Date of the largest absolute difference in closing balance. */
  maxDivergenceDate: IsoDate | null;
  maxDivergenceCents: number;
}
