import type { Direction, ForecastKind } from "@/types/forecast";

/**
 * Suggested item names.
 *
 * A name chip also carries the category that item almost always belongs to, so
 * picking "Rent" fills in Housing too. That is only applied when the category is
 * still empty — a category the user already chose is never overwritten.
 */

export interface NameSuggestion {
  name: string;
  kinds: readonly ForecastKind[];
  direction: Direction;
  /** Applied when the category is still blank. */
  category?: string;
}

const BOTH: readonly ForecastKind[] = ["PERSONAL", "BUSINESS"];

export const ITEM_NAMES: readonly NameSuggestion[] = [
  /* ------------------------------------------------------ personal income -- */
  { name: "Salary", kinds: ["PERSONAL"], direction: "INFLOW", category: "Salary" },
  // "Client work" is business-only, so a personal freelance line points at the
  // shared "Client income" bucket rather than a category the picker withholds.
  { name: "Freelance income", kinds: ["PERSONAL"], direction: "INFLOW", category: "Client income" },
  { name: "Huurtoeslag", kinds: ["PERSONAL"], direction: "INFLOW", category: "Toeslagen" },
  { name: "Zorgtoeslag", kinds: ["PERSONAL"], direction: "INFLOW", category: "Toeslagen" },
  { name: "Kinderopvangtoeslag", kinds: ["PERSONAL"], direction: "INFLOW", category: "Toeslagen" },
  {
    name: "Studiefinanciering",
    kinds: ["PERSONAL"],
    direction: "INFLOW",
    category: "Studiefinanciering",
  },
  { name: "Uitkering", kinds: ["PERSONAL"], direction: "INFLOW", category: "Benefits" },
  // Left without a category on purpose: a refund can be tax, a shop return or a
  // deposit released, and guessing one of those is worse than leaving it blank.
  { name: "Refund", kinds: ["PERSONAL"], direction: "INFLOW" },

  /* ---------------------------------------------------- personal outgoings -- */
  { name: "Rent", kinds: ["PERSONAL"], direction: "OUTFLOW", category: "Housing" },
  { name: "Mortgage", kinds: ["PERSONAL"], direction: "OUTFLOW", category: "Housing" },
  { name: "Groceries", kinds: ["PERSONAL"], direction: "OUTFLOW", category: "Groceries" },
  { name: "Energy bill", kinds: ["PERSONAL"], direction: "OUTFLOW", category: "Utilities" },
  { name: "Water bill", kinds: ["PERSONAL"], direction: "OUTFLOW", category: "Utilities" },
  { name: "Phone contract", kinds: ["PERSONAL"], direction: "OUTFLOW", category: "Phone & internet" },
  { name: "Internet", kinds: ["PERSONAL"], direction: "OUTFLOW", category: "Phone & internet" },
  { name: "Gym", kinds: ["PERSONAL"], direction: "OUTFLOW", category: "Fitness" },
  { name: "Health insurance", kinds: ["PERSONAL"], direction: "OUTFLOW", category: "Health" },
  { name: "Streaming services", kinds: ["PERSONAL"], direction: "OUTFLOW", category: "Subscriptions" },
  { name: "Public transport", kinds: ["PERSONAL"], direction: "OUTFLOW", category: "Transport" },
  { name: "Car insurance", kinds: ["PERSONAL"], direction: "OUTFLOW", category: "Transport" },
  { name: "Fuel", kinds: ["PERSONAL"], direction: "OUTFLOW", category: "Fuel" },
  { name: "Savings transfer", kinds: ["PERSONAL"], direction: "OUTFLOW", category: "Savings" },
  { name: "Investment contribution", kinds: ["PERSONAL"], direction: "OUTFLOW", category: "Investing" },
  { name: "Loan repayment", kinds: ["PERSONAL"], direction: "OUTFLOW", category: "Debt repayment" },
  { name: "Childcare", kinds: ["PERSONAL"], direction: "OUTFLOW", category: "Health" },

  /* ------------------------------------------------------ business income -- */
  { name: "Client retainer", kinds: ["BUSINESS"], direction: "INFLOW", category: "Client work" },
  { name: "Project payment", kinds: ["BUSINESS"], direction: "INFLOW", category: "Client work" },
  { name: "Consulting fee", kinds: ["BUSINESS"], direction: "INFLOW", category: "Client work" },
  // WBSO is a payroll-tax credit in name and a cash inflow in practice.
  { name: "WBSO", kinds: ["BUSINESS"], direction: "INFLOW", category: "Subsidies" },
  { name: "Grant", kinds: ["BUSINESS"], direction: "INFLOW", category: "Subsidies" },

  /* ---------------------------------------------------- business outgoings -- */
  { name: "Office rent", kinds: ["BUSINESS"], direction: "OUTFLOW", category: "Premises" },
  { name: "Co-working desk", kinds: ["BUSINESS"], direction: "OUTFLOW", category: "Premises" },
  { name: "Software subscriptions", kinds: ["BUSINESS"], direction: "OUTFLOW", category: "Software" },
  { name: "Hosting", kinds: ["BUSINESS"], direction: "OUTFLOW", category: "Hosting" },
  { name: "Accountant", kinds: ["BUSINESS"], direction: "OUTFLOW", category: "Accounting" },
  { name: "Bookkeeping", kinds: ["BUSINESS"], direction: "OUTFLOW", category: "Accounting" },
  { name: "Tax provision", kinds: ["BUSINESS"], direction: "OUTFLOW", category: "Tax" },
  { name: "VAT payment", kinds: ["BUSINESS"], direction: "OUTFLOW", category: "Tax" },
  { name: "Liability insurance", kinds: ["BUSINESS"], direction: "OUTFLOW", category: "Insurance" },
  { name: "Contractor payment", kinds: ["BUSINESS"], direction: "OUTFLOW", category: "Subcontractors" },
  { name: "Marketing spend", kinds: ["BUSINESS"], direction: "OUTFLOW", category: "Marketing" },
  { name: "Software licence", kinds: ["BUSINESS"], direction: "OUTFLOW", category: "Software" },
  { name: "Equipment financing", kinds: ["BUSINESS"], direction: "OUTFLOW", category: "Equipment" },
  { name: "Bank charges", kinds: ["BUSINESS"], direction: "OUTFLOW", category: "Banking fees" },
  { name: "Pension contribution", kinds: BOTH, direction: "OUTFLOW", category: "Pension" },

  /* ------------------------------------------------------------ both ways -- */
  { name: "Travel", kinds: BOTH, direction: "OUTFLOW", category: "Travel" },
  { name: "Training course", kinds: BOTH, direction: "OUTFLOW", category: "Education" },
  { name: "Insurance", kinds: BOTH, direction: "OUTFLOW", category: "Insurance" },
];

/**
 * Name suggestions for a forecast, with the selected direction first.
 *
 * Mirrors `categorySuggestions`, including the tie-break that keeps the declared
 * order inside each group rather than alphabetising it.
 */
export function nameSuggestions(
  kind: ForecastKind | undefined,
  direction: Direction,
): NameSuggestion[] {
  const matched = ITEM_NAMES.filter((item) => kind === undefined || item.kinds.includes(kind));

  return [...matched].sort((a, b) => {
    const aScore = a.direction === direction ? 0 : 1;
    const bScore = b.direction === direction ? 0 : 1;
    return aScore - bScore;
  });
}
