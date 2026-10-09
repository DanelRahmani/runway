import { useState } from "react";

import { Field } from "@/components/forms/Field";
import { MoneyInput } from "@/components/forms/MoneyInput";
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
import { Textarea } from "@/components/ui/textarea";
import { todayIso } from "@/lib/dates";
import { defaultForecastName, KIND_DESCRIPTIONS, KIND_LABELS } from "@/lib/sample";
import { currencyOptionLabel } from "@/lib/money";
import { createId, cn } from "@/lib/utils";
import { forecastSchema, toFieldErrors, type FieldErrors } from "@/lib/validation";
import { CURRENCIES, type Currency, type Forecast, type ForecastKind, type Horizon } from "@/types/forecast";

const KINDS: readonly ForecastKind[] = ["PERSONAL", "BUSINESS"];

const HORIZONS: ReadonlyArray<{ value: Horizon; label: string }> = [
  { value: "THIRTEEN_WEEKS", label: "13 weeks" },
  { value: "SIX_MONTHS", label: "6 months" },
  { value: "TWELVE_MONTHS", label: "12 months" },
];

export interface ForecastFormValues {
  name: string;
  forecastKind: ForecastKind;
  currency: Currency;
  startingBalanceCents: number;
  startDate: string;
  horizon: Horizon;
  notes: string;
}

interface ForecastFormProps {
  onClose: () => void;
  /** Pass an existing forecast to edit its setup. */
  forecast?: Forecast | null;
  /** Pre-selects personal or business, depending on which button opened the form. */
  initialKind?: ForecastKind;
  onSubmit: (values: ForecastFormValues) => void;
}

/** Create or edit a forecast's core assumptions. Mounted only while open. */
export function ForecastForm({
  onClose,
  forecast = null,
  initialKind,
  onSubmit,
}: ForecastFormProps) {
  const [values, setValues] = useState<ForecastFormValues>(() => {
    const kind = forecast?.forecastKind ?? initialKind ?? "PERSONAL";
    return {
      name: forecast?.name ?? defaultForecastName(kind),
      forecastKind: kind,
      currency: forecast?.currency ?? "EUR",
      startingBalanceCents: forecast?.startingBalanceCents ?? 0,
      startDate: forecast?.startDate ?? todayIso(),
      horizon: forecast?.horizon ?? "THIRTEEN_WEEKS",
      notes: forecast?.notes ?? "",
    };
  });
  const [errors, setErrors] = useState<FieldErrors>({});

  /**
   * Switching kind renames the forecast, but only while the name is still a
   * generated default — a name the user typed is never overwritten.
   */
  const handleKindChange = (kind: ForecastKind): void => {
    setValues((current) => {
      const isGenerated =
        current.name.trim() === "" ||
        KINDS.some((candidate) => current.name.trim() === defaultForecastName(candidate));
      return {
        ...current,
        forecastKind: kind,
        name: isGenerated ? defaultForecastName(kind) : current.name,
      };
    });
  };

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();

    // Validate the setup fields through the full forecast schema so the rules
    // stay in one place. Line items are carried through untouched.
    const candidate: Forecast = {
      id: forecast?.id ?? createId(),
      name: values.name,
      forecastKind: values.forecastKind,
      currency: values.currency,
      startingBalanceCents: values.startingBalanceCents,
      startDate: values.startDate,
      horizon: values.horizon,
      ...(values.notes.trim() === "" ? {} : { notes: values.notes }),
      recurringItems: forecast?.recurringItems ?? [],
      oneOffItems: forecast?.oneOffItems ?? [],
      invoices: forecast?.invoices ?? [],
      createdAt: forecast?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(forecast?.baseForecastId === undefined
        ? {}
        : { baseForecastId: forecast.baseForecastId }),
      ...(forecast?.scenarioLabel === undefined ? {} : { scenarioLabel: forecast.scenarioLabel }),
    };

    const result = forecastSchema.safeParse(candidate);
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      return;
    }

    setErrors({});
    onSubmit(values);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{forecast === null ? "New forecast" : "Forecast assumptions"}</DialogTitle>
          <DialogDescription>
            Set the starting point. You can change any of this later — Runway recalculates instantly.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-xs font-medium">
              What are you forecasting?
              <span className="text-destructive ml-2" aria-hidden="true">
                *
              </span>
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {KINDS.map((kind) => {
                const selected = values.forecastKind === kind;
                return (
                  <label
                    key={kind}
                    className={cn(
                      "relative flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-colors",
                      selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "hover:bg-accent border-border",
                    )}
                  >
                    <input
                      type="radio"
                      name="forecast-kind"
                      value={kind}
                      checked={selected}
                      onChange={() => handleKindChange(kind)}
                      className="peer sr-only"
                    />
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span
                        className={cn(
                          "inline-block size-2 rounded-full",
                          selected ? "bg-primary" : "bg-border",
                        )}
                        aria-hidden="true"
                      />
                      {KIND_LABELS[kind]} forecast
                    </span>
                    <span className="text-muted-foreground text-xs leading-relaxed">
                      {KIND_DESCRIPTIONS[kind]}
                    </span>
                    <span className="peer-focus-visible:ring-ring pointer-events-none absolute rounded-lg peer-focus-visible:ring-2" />
                  </label>
                );
              })}
            </div>
          </fieldset>

          <Field label="Forecast name" htmlFor="forecast-name" error={errors.name} required>
            <Input
              value={values.name}
              placeholder="e.g. Freelance 2027"
              autoComplete="off"
              onChange={(event) => setValues({ ...values, name: event.target.value })}
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Starting balance"
              htmlFor="forecast-balance"
              error={errors.startingBalanceCents}
              required
            >
              <MoneyInput
                valueCents={values.startingBalanceCents}
                onValueChange={(startingBalanceCents) =>
                  setValues({ ...values, startingBalanceCents })
                }
                currency={values.currency}
              />
            </Field>
            <Field label="Currency" htmlFor="forecast-currency" error={errors.currency} required>
              <select
                id="forecast-currency"
                value={values.currency}
                onChange={(event) =>
                  setValues({ ...values, currency: event.target.value as Currency })
                }
                className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currencyOptionLabel(currency)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Start date" htmlFor="forecast-start" error={errors.startDate} required>
              <Input
                type="date"
                value={values.startDate}
                onChange={(event) => setValues({ ...values, startDate: event.target.value })}
              />
            </Field>
            <Field label="Horizon" htmlFor="forecast-horizon" error={errors.horizon} required>
              <select
                id="forecast-horizon"
                value={values.horizon}
                onChange={(event) => setValues({ ...values, horizon: event.target.value as Horizon })}
                className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              >
                {HORIZONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Notes" htmlFor="forecast-notes" error={errors.notes}>
            <Textarea
              value={values.notes}
              rows={3}
              placeholder="Anything worth remembering about the assumptions in this forecast."
              onChange={(event) => setValues({ ...values, notes: event.target.value })}
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{forecast === null ? "Create forecast" : "Save changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
