import { Field } from "@/components/forms/Field";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { Input } from "@/components/ui/input";
import type { FieldErrors } from "@/lib/validation";
import type { Currency, Direction } from "@/types/forecast";
import { cn } from "@/lib/utils";

/** The fields shared by recurring and one-off entries. */
export interface LineItemDraft {
  name: string;
  direction: Direction;
  amountCents: number;
  category: string;
  note: string;
}

export const EMPTY_LINE_ITEM_DRAFT: LineItemDraft = {
  name: "",
  direction: "OUTFLOW",
  amountCents: 0,
  category: "",
  note: "",
};

interface LineItemFieldsProps {
  draft: LineItemDraft;
  onChange: (draft: LineItemDraft) => void;
  errors: FieldErrors;
  currency: Currency;
  idPrefix: string;
}

export function LineItemFields({ draft, onChange, errors, currency, idPrefix }: LineItemFieldsProps) {
  return (
    <>
      <Field label="Name" htmlFor={`${idPrefix}-name`} error={errors.name} required>
        <Input
          value={draft.name}
          placeholder="e.g. Rent"
          autoComplete="off"
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
        />
      </Field>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-xs font-medium">Direction</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["INFLOW", "OUTFLOW"] as const).map((direction) => (
            <button
              key={direction}
              type="button"
              aria-pressed={draft.direction === direction}
              onClick={() => onChange({ ...draft, direction })}
              className={cn(
                "focus-visible:ring-ring rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                draft.direction === direction
                  ? direction === "INFLOW"
                    ? "border-positive bg-positive-muted text-positive"
                    : "border-negative bg-negative-muted text-negative"
                  : "bg-background text-muted-foreground hover:bg-accent",
              )}
            >
              {direction === "INFLOW" ? "Income" : "Expense"}
            </button>
          ))}
        </div>
      </fieldset>

      <Field
        label="Amount"
        htmlFor={`${idPrefix}-amount`}
        error={errors.amountCents}
        hint={`Enter the amount in ${currency}.`}
        required
      >
        <MoneyInput
          valueCents={draft.amountCents}
          onValueChange={(amountCents) => onChange({ ...draft, amountCents })}
          currency={currency}
        />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Category" htmlFor={`${idPrefix}-category`} error={errors.category}>
          <Input
            value={draft.category}
            placeholder="e.g. Housing"
            autoComplete="off"
            onChange={(event) => onChange({ ...draft, category: event.target.value })}
          />
        </Field>
        <Field label="Note" htmlFor={`${idPrefix}-note`} error={errors.note}>
          <Input
            value={draft.note}
            placeholder="Optional detail"
            autoComplete="off"
            onChange={(event) => onChange({ ...draft, note: event.target.value })}
          />
        </Field>
      </div>
    </>
  );
}
