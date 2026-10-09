import { Field } from "@/components/forms/Field";
import { CategoryPicker } from "@/components/forms/CategoryPicker";
import { NamePicker } from "@/components/forms/NamePicker";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { Input } from "@/components/ui/input";
import type { LineItemDraft } from "@/components/forms/lineItemDraft";
import { isTransferCategory } from "@/lib/categories";
import { accountKindLabel } from "@/lib/forecast/accounts";
import type { FieldErrors } from "@/lib/validation";
import type { Account, Currency, ForecastKind } from "@/types/forecast";
import { cn } from "@/lib/utils";

interface LineItemFieldsProps {
  draft: LineItemDraft;
  onChange: (draft: LineItemDraft) => void;
  errors: FieldErrors;
  currency: Currency;
  /** Shapes which category suggestions are offered. */
  forecastKind: ForecastKind | undefined;
  /** Pots a transfer can be sent to. Empty means the choice is not offered. */
  accounts: readonly Account[];
  idPrefix: string;
}

export function LineItemFields({
  draft,
  onChange,
  errors,
  currency,
  forecastKind,
  accounts,
  idPrefix,
}: LineItemFieldsProps) {
  /*
   * Only a transfer needs a destination. Ordinary spending always comes out of the
   * spending account, so asking which pot paid for the groceries would be a
   * question with no correct answer.
   */
  const isTransfer = isTransferCategory(draft.category);
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

        {isTransfer && accounts.length > 0 ? (
          <Field
            label="Goes into"
            htmlFor={`${idPrefix}-account`}
            hint="A transfer into an account is two-sided: your spending money drops, your total does not."
            className="sm:col-span-2"
          >
            <select
              id={`${idPrefix}-account`}
              value={draft.accountId}
              onChange={(event) => onChange({ ...draft, accountId: event.target.value })}
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
            >
              <option value="">Leave the spending account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({accountKindLabel(account.kind)})
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <Field label="Note" htmlFor={`${idPrefix}-note`} error={errors.note} className="sm:col-span-2">          <Input
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
