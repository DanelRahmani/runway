import type { Direction } from "@/types/forecast";

/**
 * The draft shape shared by the recurring and one-off forms.
 *
 * Kept out of `LineItemFields.tsx` so that file exports only a component, which
 * is what the fast-refresh lint rule asks for, and so both forms can seed an
 * empty draft without duplicating the literal.
 */
export interface LineItemDraft {
  name: string;
  direction: Direction;
  amountCents: number;
  category: string;
  note: string;
  /** Which pot a transfer lands in. Empty string means none chosen. */
  accountId: string;
}

export const EMPTY_LINE_ITEM_DRAFT: LineItemDraft = {
  name: "",
  direction: "OUTFLOW",
  amountCents: 0,
  category: "",
  note: "",
  accountId: "",
};
