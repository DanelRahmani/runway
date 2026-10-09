import { z } from "zod";

import { isValidIsoDate } from "@/lib/dates";
import { MINOR_UNITS_PER_MAJOR } from "@/lib/money";
import {
  CURRENCIES,
  type Forecast,
  type Horizon,
  type Invoice,
  type OneOffItem,
  type RecurringItem,
} from "@/types/forecast";

/**
 * Every mutation in Runway passes through one of these schemas: form submits,
 * JSON imports and the sample-data seeder. One definition of "valid forecast"
 * means the importer cannot accept something the form would have rejected.
 */

/** Upper bound on a single amount: 1 trillion major units, well inside safe-integer range. */
const MAX_AMOUNT_CENTS = 1_000_000_000_000 * MINOR_UNITS_PER_MAJOR;

/**
 * Rounds incoming numbers to whole units before validating.
 *
 * This is the tolerant edge of the ledger. A form field, a paste or an import may
 * legitimately carry a fraction — 19.999 is a real thing to type — and the user
 * asked for that to round rather than be refused. Money inside the engine is
 * still never a float; `assertIntegerCents` remains the tripwire that fires if a
 * fractional value ever reaches it, so leniency here does not weaken the core
 * invariant.
 */
const toWholeUnits = (value: unknown): unknown =>
  typeof value === "number" && Number.isFinite(value) ? Math.round(value) : value;

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .refine(isValidIsoDate, "That date does not exist");

export const currencySchema = z.enum(CURRENCIES);
export const forecastKindSchema = z.enum(["PERSONAL", "BUSINESS"]);
export const directionSchema = z.enum(["INFLOW", "OUTFLOW"]);
export const frequencySchema = z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]);
export const recurrenceAnchorSchema = z.enum(["DAY", "MONTH_END"]);
export const horizonSchema = z.enum(["THIRTEEN_WEEKS", "SIX_MONTHS", "TWELVE_MONTHS"]);
export const invoiceStatusSchema = z.enum(["EXPECTED", "PAID", "CANCELLED"]);
export const invoiceRecurrenceSchema = z.enum(["NONE", "MONTHLY", "QUARTERLY"]);

export const amountCentsSchema = z.preprocess(
  toWholeUnits,
  z
    .number({ error: "Enter an amount" })
    .int("Enter an amount")
    .min(-MAX_AMOUNT_CENTS, "Amount is too large")
    .max(MAX_AMOUNT_CENTS, "Amount is too large"),
);

export const positiveAmountCentsSchema = z.preprocess(
  toWholeUnits,
  z
    .number({ error: "Enter an amount" })
    .int("Enter an amount")
    .positive("Enter an amount greater than zero")
    .max(MAX_AMOUNT_CENTS, "Amount is too large"),
);

const trimmed = (max: number, message: string) => z.string().trim().max(max, message);
const requiredText = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max, message);

export const recurringItemSchema = z
  .object({
    id: z.string().min(1),
    name: requiredText(80, "Give this item a name"),
    direction: directionSchema,
    amountCents: positiveAmountCentsSchema,
    frequency: frequencySchema,
    startDate: isoDateSchema,
    // Optional so items saved before month-end anchoring existed still load.
    anchor: recurrenceAnchorSchema.optional(),
    /** Only meaningful on a transfer; ignored for ordinary spending. */
    accountId: trimmed(64, "Account reference is too long").optional(),
    endDate: isoDateSchema.optional(),
    category: trimmed(40, "Category is too long").optional(),
    note: trimmed(280, "Note is too long").optional(),
    isActive: z.boolean(),
  })
  .refine(
    (item) => item.endDate === undefined || item.endDate >= item.startDate,
    { message: "End date must be on or after the start date", path: ["endDate"] },
  );

export const oneOffItemSchema = z.object({
  id: z.string().min(1),
  name: requiredText(80, "Give this item a name"),
  direction: directionSchema,
  amountCents: positiveAmountCentsSchema,
  date: isoDateSchema,
  category: trimmed(40, "Category is too long").optional(),
  note: trimmed(280, "Note is too long").optional(),
  /** Only meaningful on a transfer; ignored for ordinary spending. */
  accountId: trimmed(64, "Account reference is too long").optional(),
});

export const invoiceSchema = z.object({
  id: z.string().min(1),
  clientName: requiredText(80, "Enter the client name"),
  amountCents: positiveAmountCentsSchema,
  issueDate: isoDateSchema,
  expectedPaymentDate: isoDateSchema,
  // Days are discrete, so a typed fraction rounds to the nearest whole day
  // rather than being refused with "must be a whole number".
  paymentDelayDays: z.preprocess(
    toWholeUnits,
    z
      .number({ error: "Enter a number of days" })
      .int("Enter a number of days")
      .min(0, "Delay cannot be negative")
      .max(3650, "Delay is unrealistically large"),
  ),
  status: invoiceStatusSchema,
  recurrence: invoiceRecurrenceSchema,
});

export const accountKindSchema = z.enum(["CASH", "SAVINGS", "INVESTMENT", "DEBT"]);

/**
 * A pot beyond the spending account.
 *
 * The rate is in basis points and defaults to 0 rather than to any guess: a
 * return is an assumption the user makes, not one Runway should make for them.
 * 2,000 bps (20%) is the ceiling — beyond that it is a typo, not a plan.
 */
export const accountSchema = z.object({
  id: z.string().min(1),
  name: requiredText(60, "Give this account a name"),
  kind: accountKindSchema,
  startingBalanceCents: amountCentsSchema,
  annualRateBps: z
    .preprocess(
      toWholeUnits,
      z
        .number({ error: "Enter a rate" })
        .int("Enter a whole number of basis points")
        .min(-2_000, "That rate is implausibly negative")
        .max(2_000, "That rate is implausibly high"),
    )
    .optional(),
});

export const forecastGoalSchema = z.object({
  label: requiredText(60, "Give the goal a name"),
  targetCents: positiveAmountCentsSchema,
  targetDate: isoDateSchema,
});

export const forecastSchema = z.object({
  id: z.string().min(1),
  name: requiredText(80, "Give your forecast a name"),
  // Optional so a backup exported before kinds existed still imports cleanly.
  forecastKind: forecastKindSchema.optional(),
  currency: currencySchema,
  startingBalanceCents: amountCentsSchema,
  startDate: isoDateSchema,
  horizon: horizonSchema,
  notes: trimmed(500, "Notes are too long").optional(),
  // Optional, so a forecast saved or exported before goals existed still loads.
  goal: forecastGoalSchema.optional(),
  // Likewise optional for accounts: a forecast without them still projects, with
  // the spending account synthesised from its starting balance.
  accounts: z.array(accountSchema).max(20, "Too many accounts").optional(),
  recurringItems: z.array(recurringItemSchema).max(200, "Too many recurring items"),
  oneOffItems: z.array(oneOffItemSchema).max(400, "Too many one-off items"),
  invoices: z.array(invoiceSchema).max(200, "Too many invoices"),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  baseForecastId: z.string().min(1).optional(),
  scenarioLabel: trimmed(80, "Label is too long").optional(),
  archived: z.boolean().optional(),
});

/* --------------------------------------------------------------- backup file */

export const BACKUP_SCHEMA_VERSION = 1;

export const backupForecastSchema = forecastSchema;

export const backupFileSchema = z.object({
  schemaVersion: z.number().int().min(1),
  exportedAt: z.string().min(1),
  app: z.literal("runway"),
  forecasts: z.array(backupForecastSchema).min(1, "The file contains no forecasts"),
});

export type BackupFile = z.infer<typeof backupFileSchema>;

/* ------------------------------------------------------------------ helpers */

export const DEFAULT_HORIZON: Horizon = "THIRTEEN_WEEKS";

export interface FieldErrors {
  [path: string]: string;
}

/** Flattens a Zod error into `{ "field.path": "message" }` for inline form display. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_form";
    if (errors[path] === undefined) errors[path] = issue.message;
  }
  return errors;
}

/** First message only — for a compact summary banner. */
export function firstErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Something in this forecast is not valid.";
}

export function validateForecast(value: unknown):
  | { ok: true; forecast: Forecast }
  | { ok: false; errors: FieldErrors } {
  const result = forecastSchema.safeParse(value);
  if (!result.success) return { ok: false, errors: toFieldErrors(result.error) };
  return { ok: true, forecast: result.data as Forecast };
}

export function validateRecurringItem(value: unknown):
  | { ok: true; item: RecurringItem }
  | { ok: false; errors: FieldErrors } {
  const result = recurringItemSchema.safeParse(value);
  if (!result.success) return { ok: false, errors: toFieldErrors(result.error) };
  return { ok: true, item: result.data };
}

export function validateOneOffItem(value: unknown):
  | { ok: true; item: OneOffItem }
  | { ok: false; errors: FieldErrors } {
  const result = oneOffItemSchema.safeParse(value);
  if (!result.success) return { ok: false, errors: toFieldErrors(result.error) };
  return { ok: true, item: result.data };
}

export function validateInvoice(value: unknown):
  | { ok: true; invoice: Invoice }
  | { ok: false; errors: FieldErrors } {
  const result = invoiceSchema.safeParse(value);
  if (!result.success) return { ok: false, errors: toFieldErrors(result.error) };
  return { ok: true, invoice: result.data };
}
