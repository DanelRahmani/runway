import { CopyIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/forms/ConfirmDialog";
import { InvoiceForm } from "@/components/forms/InvoiceForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrapper,
} from "@/components/ui/table";
import { addDays, formatIsoDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { createId } from "@/lib/utils";
import type { Forecast, Invoice } from "@/types/forecast";

const STATUS_VARIANT: Record<Invoice["status"], "positive" | "muted" | "negative"> = {
  EXPECTED: "muted",
  PAID: "positive",
  CANCELLED: "negative",
};

const RECURRENCE_LABELS: Record<Invoice["recurrence"], string> = {
  NONE: "One-off",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
};

interface InvoicesTabProps {
  forecast: Forecast;
  update: (updater: (current: Forecast) => Forecast) => void;
}

export function InvoicesTab({ forecast, update }: InvoicesTabProps) {
  const [editing, setEditing] = useState<{ invoice: Invoice | null } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Invoice | null>(null);

  const upsert = (invoice: Invoice): void => {
    update((current) => {
      const exists = current.invoices.some((candidate) => candidate.id === invoice.id);
      return {
        ...current,
        invoices: exists
          ? current.invoices.map((candidate) =>
              candidate.id === invoice.id ? invoice : candidate,
            )
          : [...current.invoices, invoice],
      };
    });
  };

  const expectedTotal = forecast.invoices
    .filter((invoice) => invoice.status === "EXPECTED")
    .reduce((total, invoice) => total + invoice.amountCents, 0);

  const delayedCount = forecast.invoices.filter(
    (invoice) => invoice.status === "EXPECTED" && invoice.paymentDelayDays > 0,
  ).length;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle>Invoices</CardTitle>
          <CardDescription>
            {forecast.invoices.length === 0
              ? "No invoices yet."
              : `${formatCents(expectedTotal, forecast.currency)} expected outstanding · ${delayedCount} with a delay allowance`}
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setEditing({ invoice: null })}>
          <PlusIcon />
          Add invoice
        </Button>
      </CardHeader>

      <CardContent>
        {forecast.invoices.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-5">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">No invoices yet</p>
              <p className="text-muted-foreground text-xs">
                Add what clients owe you. Runway projects each one on its expected payment date plus
                your delay allowance, so late payers show up as a real gap.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setEditing({ invoice: null })}>
              <PlusIcon />
              Add your first invoice
            </Button>
          </div>
        ) : (
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Recurs</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Delay</TableHead>
                  <TableHead>Projected</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forecast.invoices.map((invoice) => {
                  const projected = addDays(invoice.expectedPaymentDate, invoice.paymentDelayDays);
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.clientName}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[invoice.status]}>
                          {invoice.status === "EXPECTED"
                            ? "Expected"
                            : invoice.status === "PAID"
                              ? "Paid"
                              : "Cancelled"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {RECURRENCE_LABELS[invoice.recurrence]}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatIsoDate(invoice.issueDate)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatIsoDate(invoice.expectedPaymentDate)}
                      </TableCell>
                      <TableCell className="tnum text-muted-foreground text-xs">
                        +{invoice.paymentDelayDays}d
                      </TableCell>
                      <TableCell className="tnum text-xs font-medium text-positive">
                        {formatIsoDate(projected)}
                      </TableCell>
                      <TableCell className="tnum text-right font-medium">
                        {formatCents(invoice.amountCents, forecast.currency)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Edit invoice for ${invoice.clientName}`}
                            onClick={() => setEditing({ invoice })}
                          >
                            <PencilIcon />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Duplicate invoice for ${invoice.clientName}`}
                            onClick={() =>
                              upsert({
                                ...invoice,
                                id: createId(),
                                clientName: `${invoice.clientName} (copy)`,
                              })
                            }
                          >
                            <CopyIcon />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Delete invoice for ${invoice.clientName}`}
                            onClick={() => setPendingDelete(invoice)}
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableWrapper>
        )}
      </CardContent>

      {editing !== null ? (
        <InvoiceForm
          invoice={editing.invoice}
          currency={forecast.currency}
          defaultIssueDate={forecast.startDate}
          onSubmit={upsert}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => (open ? undefined : setPendingDelete(null))}
        title={`Delete the invoice for "${pendingDelete?.clientName ?? ""}"?`}
        description="This removes the invoice from the forecast."
        confirmLabel="Delete invoice"
        onConfirm={() => {
          const target = pendingDelete;
          if (target === null) return;
          update((current) => ({
            ...current,
            invoices: current.invoices.filter((invoice) => invoice.id !== target.id),
          }));
          setPendingDelete(null);
        }}
      />
    </Card>
  );
}
