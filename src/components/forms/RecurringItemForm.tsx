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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createId } from "@/lib/utils";
import { validateRecurringItem, type FieldErrors } from "@/lib/validation";
import type { Currency, ForecastKind, Frequency, IsoDate, RecurringItem } from "@/types/forecast";

const FREQUENCIES: ReadonlyArray<{ value: Frequency; label: string }> = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "BIWEEKLY", label: "Every 2 weeks" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "YEARLY", label: "Yearly" },
];

interface RecurringItemFormProps {
  onClose: () => void;
  /** `null` creates a new item. */
  item: RecurringItem | null;
  currency: Currency;
  defaultStartDate: IsoDate;
  forecastKind: ForecastKind | undefined;
  onSubmit: (item: RecurringItem) => void;
}

/**
 * Add/edit dialog for a recurring entry.
 *
 * The parent mounts this only while it is open (see `RecurringTab`), so the
 * state below is always freshly seeded from `item` and a cancelled edit cannot
 * leak into the next one.
 */
export function RecurringItemForm({
  onClose,
  item,
  currency,
  defaultStartDate,
  forecastKind,
  onSubmit,
}: RecurringItemFormProps) {
  const [draft, setDraft] = useState<LineItemDraft>(() =>
    item === null
      ? EMPTY_LINE_ITEM_DRAFT
      : {
          name: item.name,
          direction: item.direction,
          amountCents: item.amountCents,
          category: item.category ?? "",
          note: item.note ?? "",
        },
  );
  const [frequency, setFrequency] = useState<Frequency>(item?.frequency ?? "MONTHLY");
  const [startDate, setStartDate] = useState<IsoDate>(item?.startDate ?? defaultStartDate);
  const [endDate, setEndDate] = useState<string>(item?.endDate ?? "");
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [errors, setErrors] = useState<FieldErrors>({});

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();

    const candidate = {
      id: item?.id ?? createId(),
      name: draft.name,
      direction: draft.direction,
      amountCents: draft.amountCents,
      frequency,
      startDate,
      ...(endDate === "" ? {} : { endDate }),
      ...(draft.category.trim() === "" ? {} : { category: draft.category }),
      ...(draft.note.trim() === "" ? {} : { note: draft.note }),
      isActive,
    };

    const result = validateRecurringItem(candidate);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }

    setErrors({});
    onSubmit(result.item);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{item === null ? "Add recurring item" : "Edit recurring item"}</DialogTitle>
          <DialogDescription>
            Recurring entries repeat on a schedule for the whole forecast horizon.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <LineItemFields
            draft={draft}
            onChange={setDraft}
            errors={errors}
            currency={currency}
            forecastKind={forecastKind}
            idPrefix="recurring"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Frequency" htmlFor="recurring-frequency" error={errors.frequency} required>
              <select
                id="recurring-frequency"
                value={frequency}
                onChange={(event) => setFrequency(event.target.value as Frequency)}
                className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              >
                {FREQUENCIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Starts" htmlFor="recurring-start" error={errors.startDate} required>
              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </Field>

            <Field
              label="Ends"
              htmlFor="recurring-end"
              error={errors.endDate}
              hint="Leave blank to run forever."
            >
              <Input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </Field>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-md border px-3 py-2.5">
            <Label htmlFor="recurring-active" className="flex-col items-start gap-0.5">
              <span className="text-xs font-medium">Active</span>
              <span className="text-muted-foreground text-xs font-normal">
                Inactive items stay in the list but are excluded from the projection.
              </span>
            </Label>
            <Switch id="recurring-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>

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
