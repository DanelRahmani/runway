import { useState } from "react";

import { Field } from "@/components/forms/Field";
import { LineItemFields } from "@/components/forms/LineItemFields";
import {
  EMPTY_LINE_ITEM_DRAFT,
  type LineItemDraft,
} from "@/components/forms/lineItemDraft";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createId } from "@/lib/utils";
import { validateOneOffItem, type FieldErrors } from "@/lib/validation";
import type { Account, Currency, ForecastKind, IsoDate, OneOffItem } from "@/types/forecast";

interface OneOffItemFormProps {
  onClose: () => void;
  item: OneOffItem | null;
  currency: Currency;
  defaultDate: IsoDate;
  forecastKind: ForecastKind | undefined;
  /** Pots a transfer can be sent to. */
  accounts: readonly Account[];
  onSubmit: (item: OneOffItem) => void;
}

/** Add/edit dialog for a single-dated entry. Mounted only while open. */
export function OneOffItemForm({
  onClose,
  item,
  currency,
  defaultDate,
  forecastKind,
  accounts,
  onSubmit,
}: OneOffItemFormProps) {
  const [draft, setDraft] = useState<LineItemDraft>(() =>
    item === null
      ? EMPTY_LINE_ITEM_DRAFT
      : {
          name: item.name,
          direction: item.direction,
          amountCents: item.amountCents,
          category: item.category ?? "",
          note: item.note ?? "",
          accountId: item.accountId ?? "",
        },
  );
  const [date, setDate] = useState<IsoDate>(item?.date ?? defaultDate);
  const [errors, setErrors] = useState<FieldErrors>({});

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();

    const result = validateOneOffItem({
      id: item?.id ?? createId(),
      name: draft.name,
      direction: draft.direction,
      amountCents: draft.amountCents,
      date,
      ...(draft.category.trim() === "" ? {} : { category: draft.category }),
      ...(draft.accountId === "" ? {} : { accountId: draft.accountId }),
      ...(draft.note.trim() === "" ? {} : { note: draft.note }),
    });

    if (!result.ok) {
      setErrors(result.errors);
      return;
    }

    onSubmit(result.item);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{item === null ? "Add one-off item" : "Edit one-off item"}</DialogTitle>
          <DialogDescription>
            One-off entries land on a single date — a purchase, a bonus, a tax bill.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <LineItemFields
            draft={draft}
            onChange={setDraft}
            errors={errors}
            currency={currency}
            forecastKind={forecastKind}
            accounts={accounts}
            idPrefix="one-off"
          />

          <Field
            label="Date"
            htmlFor="one-off-date"
            error={errors.date}
            hint="Must fall inside the forecast horizon to appear in the projection."
            required
          >
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{item === null ? "Add item" : "Save changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
