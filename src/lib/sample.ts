import { addDays, todayIso } from "@/lib/dates";
import { createId } from "@/lib/utils";
import type { Forecast, ForecastKind, IsoDate } from "@/types/forecast";

/**
 * Starter forecasts.
 *
 * Each one is a realistic, fully-editable forecast with *placeholder* amounts —
 * every figure is invented and the notes say so. They exist so the first thing a
 * new user sees is a working projection rather than an empty grid, and each one
 * deliberately contains a squeeze so the tool demonstrates the thing it is for.
 */

export const KIND_LABELS: Record<ForecastKind, string> = {
  PERSONAL: "Personal",
  BUSINESS: "Business",
};

export const KIND_DESCRIPTIONS: Record<ForecastKind, string> = {
  PERSONAL: "Salary, rent, groceries, savings — money in and out of a household.",
  BUSINESS: "Client income, invoices, tax provisions — money in and out of a business.",
};

/** Default forecast name for a kind. */
export function defaultForecastName(kind: ForecastKind): string {
  return kind === "PERSONAL" ? "Personal cash flow" : "Business cash flow";
}

export function createStarterForecast(kind: ForecastKind, startDate: IsoDate = todayIso()): Forecast {
  return kind === "PERSONAL" ? createPersonalStarter(startDate) : createBusinessStarter(startDate);
}

/**
 * A household forecast: salary in, living costs out, with a car repair that
 * briefly takes the balance below zero before it recovers.
 */
export function createPersonalStarter(startDate: IsoDate = todayIso()): Forecast {
  const now = new Date().toISOString();

  return {
    id: createId(),
    name: defaultForecastName("PERSONAL"),
    forecastKind: "PERSONAL",
    currency: "EUR",
    // A thin buffer on purpose: the car repair below takes this household under.
    startingBalanceCents: 25_000,
    startDate,
    horizon: "TWELVE_MONTHS",
    notes:
      "Starter items with placeholder amounts — replace them with your own figures. " +
      "Nothing here leaves your browser.",
    recurringItems: [
      {
        id: createId(),
        name: "Salary",
        direction: "INFLOW",
        amountCents: 280_000,
        frequency: "MONTHLY",
        startDate,
        category: "Income",
        note: "Net, paid on the 25th",
        isActive: true,
      },
      {
        id: createId(),
        name: "Rent",
        direction: "OUTFLOW",
        amountCents: 115_000,
        frequency: "MONTHLY",
        startDate,
        category: "Housing",
        isActive: true,
      },
      {
        id: createId(),
        name: "Groceries",
        direction: "OUTFLOW",
        amountCents: 8_500,
        frequency: "WEEKLY",
        startDate,
        category: "Living",
        isActive: true,
      },
      {
        id: createId(),
        name: "Utilities",
        direction: "OUTFLOW",
        amountCents: 14_000,
        frequency: "MONTHLY",
        startDate,
        category: "Housing",
        note: "Energy and water",
        isActive: true,
      },
      {
        id: createId(),
        name: "Phone and internet",
        direction: "OUTFLOW",
        amountCents: 4_500,
        frequency: "MONTHLY",
        startDate,
        category: "Living",
        isActive: true,
      },
      {
        id: createId(),
        name: "Subscriptions",
        direction: "OUTFLOW",
        amountCents: 3_200,
        frequency: "MONTHLY",
        startDate,
        category: "Living",
        isActive: true,
      },
      {
        id: createId(),
        name: "Transport",
        direction: "OUTFLOW",
        amountCents: 7_800,
        frequency: "MONTHLY",
        startDate,
        category: "Living",
        isActive: true,
      },
      {
        id: createId(),
        name: "Savings transfer",
        direction: "OUTFLOW",
        amountCents: 25_000,
        frequency: "MONTHLY",
        startDate,
        category: "Savings",
        note: "Move to a separate account on payday",
        isActive: true,
      },
    ],
    oneOffItems: [
      {
        id: createId(),
        name: "Car repair",
        direction: "OUTFLOW",
        amountCents: 260_000,
        date: addDays(startDate, 75),
        category: "Transport",
        note: "Unplanned — this is the dip in the curve",
      },
      {
        id: createId(),
        name: "Holiday",
        direction: "OUTFLOW",
        amountCents: 120_000,
        date: addDays(startDate, 200),
        category: "Leisure",
      },
    ],
    // Households do not raise invoices, which is the clearest split between the two kinds.
    invoices: [],
    createdAt: now,
    updatedAt: now,
    archived: false,
  };
}

/**
 * A freelance business: a retainer, running costs, a quarterly tax provision and
 * client invoices with payment delays. Deliberately runs out of cash, because
 * that is the question the tool exists to answer.
 */
export function createBusinessStarter(startDate: IsoDate = todayIso()): Forecast {
  const now = new Date().toISOString();

  return {
    id: createId(),
    name: defaultForecastName("BUSINESS"),
    forecastKind: "BUSINESS",
    currency: "EUR",
    startingBalanceCents: 420_000,
    startDate,
    horizon: "TWELVE_MONTHS",
    notes:
      "Starter items with placeholder amounts — replace them with your own figures. " +
      "Nothing here leaves your browser.",
    recurringItems: [
      {
        id: createId(),
        name: "Retainer — Acme Studio",
        direction: "INFLOW",
        amountCents: 120_000,
        frequency: "MONTHLY",
        startDate,
        category: "Client work",
        note: "Paid on the 1st",
        isActive: true,
      },
      {
        id: createId(),
        name: "Office rent",
        direction: "OUTFLOW",
        amountCents: 65_000,
        frequency: "MONTHLY",
        startDate,
        category: "Premises",
        isActive: true,
      },
      {
        id: createId(),
        name: "Software subscriptions",
        direction: "OUTFLOW",
        amountCents: 4_900,
        frequency: "MONTHLY",
        startDate,
        category: "Tools",
        isActive: true,
      },
      {
        id: createId(),
        name: "Accounting",
        direction: "OUTFLOW",
        amountCents: 25_000,
        frequency: "QUARTERLY",
        startDate: addDays(startDate, 30),
        category: "Admin",
        isActive: true,
      },
      {
        id: createId(),
        name: "Tax provision",
        direction: "OUTFLOW",
        amountCents: 60_000,
        frequency: "QUARTERLY",
        startDate: addDays(startDate, 30),
        category: "Tax",
        note: "Set aside roughly a quarter of profit",
        isActive: true,
      },
      {
        id: createId(),
        name: "Business insurance",
        direction: "OUTFLOW",
        amountCents: 13_200,
        frequency: "MONTHLY",
        startDate,
        category: "Insurance",
        isActive: true,
      },
      {
        id: createId(),
        name: "Phone and internet",
        direction: "OUTFLOW",
        amountCents: 5_500,
        frequency: "MONTHLY",
        startDate,
        category: "Tools",
        isActive: true,
      },
    ],
    oneOffItems: [
      {
        id: createId(),
        name: "Equipment — laptop",
        direction: "OUTFLOW",
        amountCents: 265_000,
        date: addDays(startDate, 45),
        category: "Equipment",
        note: "Four years old, screen failing",
      },
      {
        id: createId(),
        name: "Annual tax payment",
        direction: "OUTFLOW",
        amountCents: 850_000,
        date: addDays(startDate, 210),
        category: "Tax",
        note: "Final assessment — more than the quarterly provision covered",
      },
    ],
    invoices: [
      {
        id: createId(),
        clientName: "Northwind BV",
        amountCents: 380_000,
        issueDate: addDays(startDate, -20),
        expectedPaymentDate: addDays(startDate, 10),
        paymentDelayDays: 14,
        status: "EXPECTED",
        recurrence: "NONE",
      },
      {
        id: createId(),
        clientName: "Acme Studio",
        amountCents: 145_000,
        issueDate: addDays(startDate, 5),
        expectedPaymentDate: addDays(startDate, 40),
        paymentDelayDays: 7,
        status: "EXPECTED",
        recurrence: "NONE",
      },
      {
        id: createId(),
        clientName: "Lumen Group",
        amountCents: 92_500,
        issueDate: addDays(startDate, 15),
        expectedPaymentDate: addDays(startDate, 60),
        paymentDelayDays: 21,
        status: "EXPECTED",
        recurrence: "NONE",
      },
    ],
    createdAt: now,
    updatedAt: now,
    archived: false,
  };
}
