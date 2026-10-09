import { Field } from "@/components/forms/Field";
import { CategoryPicker } from "@/components/forms/CategoryPicker";
import { NamePicker } from "@/components/forms/NamePicker";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { Input } from "@/components/ui/input";
import type { LineItemDraft } from "@/components/forms/lineItemDraft";
import type { FieldErrors } from "@/lib/validation";
import type { Currency, ForecastKind } from "@/types/forecast";
import { cn } from "@/lib/utils";

interface LineItemFieldsProps {
  draft: LineItemDraft;
  onChange: (draft: LineItemDraft) => void;
  errors: FieldErrors;
  currency: Currency;
  /** Shapes which category suggestions are offered. */
  forecastKind: ForecastKind | undefined;
  idPrefix: string;
}

export function LineItemFields({
  draft,
  onChange,
  errors,
  currency,
  forecastKind,
  idPrefix,
}: LineItemFieldsProps) {
  return (
    <>
      <Field
        label="Name"
        htmlFor={`${idPrefix}-name`}
        error={errors.name}
        hint="Pick one, or type your own."
        required
      >
        <NamePicker
          id={`${idPrefix}-name`}
          value={draft.name}
          onChange={(name) => onChange({ ...draft, name })}
          onImpliedCategory={(category) => onChange({ ...draft, name: draft.name, category })}
          categoryIsEmpty={draft.category.trim() === ""}
          kind={forecastKind}
          direction={draft.direction}
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
        {/*
         * The category picker spans both columns: its suggestion chips need the
         * width, and it reads as one block with the free-text field above them.
         */}
        <Field
          label="Category"
          htmlFor={`${idPrefix}-category`}
          error={errors.category}
          hint="Pick one, or type your own."
          className="sm:col-span-2"
        >
          <CategoryPicker
            id={`${idPrefix}-category`}
            value={draft.category}
            onChange={(category) => onChange({ ...draft, category })}
            kind={forecastKind}
            direction={draft.direction}
          />
        </Field>
        <Field label="Note" htmlFor={`${idPrefix}-note`} error={errors.note} className="sm:col-span-2">
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
