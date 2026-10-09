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
import { addDays } from "@/lib/dates";
import { createId } from "@/lib/utils";
import { validateInvoice, type FieldErrors } from "@/lib/validation";
import type {
  Currency,
  Invoice,
  InvoiceRecurrence,
  InvoiceStatus,
  IsoDate,
} from "@/types/forecast";

const STATUSES: ReadonlyArray<{ value: InvoiceStatus; label: string }> = [
  { value: "EXPECTED", label: "Expected" },
  { value: "PAID", label: "Paid" },
  { value: "CANCELLED", label: "Cancelled" },
];

const RECURRENCES: ReadonlyArray<{ value: InvoiceRecurrence; label: string }> = [
  { value: "NONE", label: "One-off" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
];

interface InvoiceFormProps {
  onClose: () => void;
  invoice: Invoice | null;
  currency: Currency;
  defaultIssueDate: IsoDate;
  onSubmit: (invoice: Invoice) => void;
}

/** Add/edit dialog for an expected invoice. Mounted only while open. */
export function InvoiceForm({
  onClose,
  invoice,
  currency,
  defaultIssueDate,
  onSubmit,
}: InvoiceFormProps) {
  const [clientName, setClientName] = useState(invoice?.clientName ?? "");
  const [amountCents, setAmountCents] = useState(invoice?.amountCents ?? 0);
  const [issueDate, setIssueDate] = useState<IsoDate>(invoice?.issueDate ?? defaultIssueDate);
  const [expectedPaymentDate, setExpectedPaymentDate] = useState<IsoDate>(
    invoice?.expectedPaymentDate ?? addDays(defaultIssueDate, 30),
  );
  const [paymentDelayDays, setPaymentDelayDays] = useState(
    invoice?.paymentDelayDays !== undefined ? String(invoice.paymentDelayDays) : "0",
  );
  const [status, setStatus] = useState<InvoiceStatus>(invoice?.status ?? "EXPECTED");
  const [recurrence, setRecurrence] = useState<InvoiceRecurrence>(invoice?.recurrence ?? "NONE");
  const [errors, setErrors] = useState<FieldErrors>({});

  const delayDays = Number.parseInt(paymentDelayDays, 10);
  const effectiveDate =
    Number.isFinite(delayDays) && expectedPaymentDate !== ""
      ? addDays(expectedPaymentDate, delayDays)
      : expectedPaymentDate;

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();

    const result = validateInvoice({
      id: invoice?.id ?? createId(),
      clientName,
      amountCents,
      issueDate,
      expectedPaymentDate,
      paymentDelayDays: Number.isFinite(delayDays) ? delayDays : Number.NaN,
      status,
      recurrence,
    });

    if (!result.ok) {
      setErrors(result.errors);
      return;
    }

    onSubmit(result.invoice);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{invoice === null ? "Add invoice" : "Edit invoice"}</DialogTitle>
          <DialogDescription>
            Runway projects the money on the expected payment date plus the delay allowance — never
            on the issue date.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <Field label="Client" htmlFor="invoice-client" error={errors.clientName} required>
            <Input
              value={clientName}
              placeholder="e.g. Northwind BV"
              autoComplete="off"
              onChange={(event) => setClientName(event.target.value)}
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Amount" htmlFor="invoice-amount" error={errors.amountCents} required>
              <MoneyInput
                valueCents={amountCents}
                onValueChange={setAmountCents}
                currency={currency}
              />
            </Field>
            <Field
              label="Payment delay"
              htmlFor="invoice-delay"
              error={errors.paymentDelayDays}
              hint="Extra days beyond the expected date."
            >
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                /* `any` so the browser never refuses a typed decimal; it rounds instead. */
                step="any"
                value={paymentDelayDays}
                className="tabular-nums text-right"
                onChange={(event) => setPaymentDelayDays(event.target.value)}
                onBlur={() => {
                  const parsed = Number.parseFloat(paymentDelayDays);
                  if (Number.isFinite(parsed)) setPaymentDelayDays(String(Math.round(parsed)));
                }}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Issue date" htmlFor="invoice-issue" error={errors.issueDate} required>
              <Input
                type="date"
                value={issueDate}
                onChange={(event) => setIssueDate(event.target.value)}
              />
            </Field>
            <Field
              label="Expected payment date"
              htmlFor="invoice-expected"
              error={errors.expectedPaymentDate}
              required
            >
              <Input
                type="date"
                value={expectedPaymentDate}
                onChange={(event) => setExpectedPaymentDate(event.target.value)}
              />
            </Field>
          </div>

          <div className="border-positive/40 bg-positive-muted/40 rounded-md border px-3 py-2 text-xs">
            <span className="text-muted-foreground">Projected into the forecast on </span>
            <span className="text-positive font-medium">{effectiveDate || "—"}</span>
            <span className="text-muted-foreground">
              {" "}
              (expected date + {Number.isFinite(delayDays) ? Math.max(0, delayDays) : 0} days)
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Status" htmlFor="invoice-status" error={errors.status} required>
              <select
                id="invoice-status"
                value={status}
                onChange={(event) => setStatus(event.target.value as InvoiceStatus)}
                className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              >
                {STATUSES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Repeat" htmlFor="invoice-recurrence" error={errors.recurrence} required>
              <select
                id="invoice-recurrence"
                value={recurrence}
                onChange={(event) => setRecurrence(event.target.value as InvoiceRecurrence)}
                className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              >
                {RECURRENCES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {status !== "EXPECTED" ? (
            <p className="text-muted-foreground text-xs">
              Only expected invoices are projected. A paid invoice is treated as already inside your
              starting balance, and a cancelled one is ignored.
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{invoice === null ? "Add invoice" : "Save changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
