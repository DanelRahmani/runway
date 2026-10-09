import type { CategoryTotal, Direction, ForecastKind } from "@/types/forecast";

/**
 * Suggested categories.
 *
 * Stored data keeps the plain label ("Housing") and the emoji is looked up for
 * display, so exports stay portable, greppable and stable if an emoji is ever
 * changed. A category the user types themselves simply has no emoji.
 *
 * Emoji are chosen from the long-established set: they render on older Android,
 * iOS and Windows, and they are never the only carrier of meaning — the label is
 * always present next to them.
 */

export interface CategorySuggestion {
  label: string;
  emoji: string;
  /** Which kind of forecast this belongs to. */
  kinds: readonly ForecastKind[];
  /** Typically income or expense, used to order suggestions within a form. */
  direction: Direction;
  /**
   * A movement between the user's own accounts rather than money leaving them.
   *
   * Cash-wise a transfer is a real outflow — the current account is lighter — but
   * nothing was spent. Paying yourself into savings, buying investments, funding a
   * pension and repaying debt principal all reduce cash while leaving net worth
   * unchanged, so Runway reports them separately from actual spending. Getting
   * this wrong makes a healthy month look like a reckless one.
   */
  isTransfer: boolean;
}

type CategoryInput = Omit<CategorySuggestion, "isTransfer"> & { isTransfer?: boolean };

const BOTH: readonly ForecastKind[] = ["PERSONAL", "BUSINESS"];

/** Defaults `isTransfer` to false so only the balance-sheet movements set it. */
const CATEGORY_INPUTS: readonly CategoryInput[] = [
  /* ------------------------------------------------------------- personal -- */
  /*
   * A household's income is a salary, not a client invoice. Without this the
   * only personal income suggestion was "Client income", which reads as
   * business and left a salaried household with nothing that fitted.
   */
  { label: "Salary", emoji: "💵", kinds: ["PERSONAL"], direction: "INFLOW" },
  { label: "Housing", emoji: "🏠", kinds: ["PERSONAL"], direction: "OUTFLOW" },
  { label: "Groceries", emoji: "🛒", kinds: ["PERSONAL"], direction: "OUTFLOW" },
  { label: "Eating out", emoji: "🍽️", kinds: ["PERSONAL"], direction: "OUTFLOW" },
  { label: "Transport", emoji: "🚌", kinds: ["PERSONAL"], direction: "OUTFLOW" },
  { label: "Fuel", emoji: "⛽", kinds: ["PERSONAL"], direction: "OUTFLOW" },
  { label: "Utilities", emoji: "💡", kinds: ["PERSONAL"], direction: "OUTFLOW" },
  // Businesses pay for phones and connectivity too, so this is not household-only.
  { label: "Phone & internet", emoji: "📱", kinds: BOTH, direction: "OUTFLOW" },
  { label: "Subscriptions", emoji: "🎬", kinds: ["PERSONAL"], direction: "OUTFLOW" },
  { label: "Health", emoji: "🩺", kinds: ["PERSONAL"], direction: "OUTFLOW" },
  { label: "Fitness", emoji: "🏋️", kinds: ["PERSONAL"], direction: "OUTFLOW" },
  { label: "Clothing", emoji: "👕", kinds: ["PERSONAL"], direction: "OUTFLOW" },
  { label: "Gifts", emoji: "🎁", kinds: ["PERSONAL"], direction: "OUTFLOW" },
  { label: "Pets", emoji: "🐾", kinds: ["PERSONAL"], direction: "OUTFLOW" },
  { label: "Maintenance", emoji: "🔧", kinds: ["PERSONAL"], direction: "OUTFLOW" },

  /* ----------------------------------------- savings rather than spending -- */
  { label: "Savings", emoji: "💰", kinds: ["PERSONAL"], direction: "OUTFLOW", isTransfer: true },
  { label: "Investing", emoji: "📈", kinds: ["PERSONAL"], direction: "OUTFLOW", isTransfer: true },
  {
    label: "Debt repayment",
    emoji: "💳",
    kinds: ["PERSONAL"],
    direction: "OUTFLOW",
    isTransfer: true,
  },
  { label: "Pension", emoji: "🏛️", kinds: BOTH, direction: "OUTFLOW", isTransfer: true },

  /* ------------------------------------------------------------- business -- */
  { label: "Client work", emoji: "🧑‍💼", kinds: ["BUSINESS"], direction: "INFLOW" },
  { label: "Premises", emoji: "🏢", kinds: ["BUSINESS"], direction: "OUTFLOW" },
  { label: "Software", emoji: "💻", kinds: ["BUSINESS"], direction: "OUTFLOW" },
  { label: "Hosting", emoji: "☁️", kinds: ["BUSINESS"], direction: "OUTFLOW" },
  { label: "Marketing", emoji: "📣", kinds: ["BUSINESS"], direction: "OUTFLOW" },
  { label: "Payroll", emoji: "👥", kinds: ["BUSINESS"], direction: "OUTFLOW" },
  { label: "Subcontractors", emoji: "🤝", kinds: ["BUSINESS"], direction: "OUTFLOW" },
  { label: "Accounting", emoji: "🧮", kinds: ["BUSINESS"], direction: "OUTFLOW" },
  { label: "Legal", emoji: "⚖️", kinds: ["BUSINESS"], direction: "OUTFLOW" },
  { label: "Insurance", emoji: "🛡️", kinds: ["BUSINESS"], direction: "OUTFLOW" },
  { label: "Equipment", emoji: "📦", kinds: ["BUSINESS"], direction: "OUTFLOW" },
  { label: "Logistics", emoji: "🚚", kinds: ["BUSINESS"], direction: "OUTFLOW" },
  { label: "Banking fees", emoji: "🏦", kinds: ["BUSINESS"], direction: "OUTFLOW" },
  { label: "Events", emoji: "🎪", kinds: ["BUSINESS"], direction: "OUTFLOW" },

  /* ----------------------------------------------------------------- both -- */
  { label: "Tax", emoji: "🧾", kinds: BOTH, direction: "OUTFLOW" },
  { label: "Travel", emoji: "✈️", kinds: BOTH, direction: "OUTFLOW" },
  { label: "Education", emoji: "🎓", kinds: BOTH, direction: "OUTFLOW" },
  // Invoices arrive with this category from the engine, so it must resolve.
  { label: "Client income", emoji: "💼", kinds: BOTH, direction: "INFLOW" },
];

export const CATEGORIES: readonly CategorySuggestion[] = CATEGORY_INPUTS.map((category) => ({
  isTransfer: false,
  ...category,
}));

/** Label for entries with no category, matching the engine's bucket. */
export const UNCATEGORISED_LABEL = "Uncategorised";

const LOOKUP = new Map<string, CategorySuggestion>(
  CATEGORIES.map((category) => [category.label.toLowerCase(), category]),
);

/** Emoji for a stored category label, or `null` for a custom one. */
export function categoryEmoji(label: string | undefined): string | null {
  if (label === undefined) return null;
  return LOOKUP.get(label.trim().toLowerCase())?.emoji ?? null;
}

/**
 * True when a category is a movement between the user's own accounts.
 *
 * Unknown labels — anything the user typed themselves — are treated as spending.
 * That is the safer default: under-reporting a transfer makes the outlook look
 * worse than it is, whereas hiding real spending would make it look better.
 */
export function isTransferCategory(label: string | undefined): boolean {
  if (label === undefined) return false;
  return LOOKUP.get(label.trim().toLowerCase())?.isTransfer ?? false;
}

export interface OutflowSplit {
  /** Money genuinely spent. */
  spending: CategoryTotal[];
  /** Money moved to savings, investments, pension or debt principal. */
  transfers: CategoryTotal[];
}

/** Splits outbound categories into spending and transfers. Order is preserved. */
export function splitOutflows(totals: readonly CategoryTotal[]): OutflowSplit {
  const spending: CategoryTotal[] = [];
  const transfers: CategoryTotal[] = [];

  for (const total of totals) {
    if (total.direction !== "OUTFLOW") continue;
    if (isTransferCategory(total.category)) transfers.push(total);
    else spending.push(total);
  }

  return { spending, transfers };
}

/** Total of a set of category totals, in cents. */
export function sumCategoryTotals(totals: readonly CategoryTotal[]): number {
  return totals.reduce((sum, total) => sum + total.totalCents, 0);
}

/**
 * Suggestions for a forecast, ordered so the direction the user is entering
 * comes first — a form adding income should not open with sixteen expenses.
 */
export function categorySuggestions(
  kind: ForecastKind | undefined,
  direction?: Direction,
): CategorySuggestion[] {
  const matched = CATEGORIES.filter(
    (category) => kind === undefined || category.kinds.includes(kind),
  );

  if (direction === undefined) return [...matched];
  // Manual sort rather than two filters: it keeps the input order within a group.
  return [...matched].sort((a, b) => {
    const aScore = a.direction === direction ? 0 : 1;
    const bScore = b.direction === direction ? 0 : 1;
    return aScore - bScore;
  });
}
