import { CopyIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/forms/ConfirmDialog";
import { InvoiceForm } from "@/components/forms/InvoiceForm";
import { ImpactCell } from "@/components/forecast/ImpactCell";
import { NoMatches, TableToolbar, type FilterOption } from "@/components/forecast/TableToolbar";import { Badge } from "@/components/ui/badge";
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
import { impactFor, itemImpact } from "@/lib/forecast/engine";
import {
  ALL_FILTER,
  byCents,
  byDate,
  byText,
  matchesQuery,
  type SortChoice,
} from "@/lib/itemSort";
import { formatCents } from "@/lib/money";
import { showUndoToast } from "@/lib/toast";
import { createId } from "@/lib/utils";
import type { Forecast, Invoice, Projection } from "@/types/forecast";

const STATUS_LABELS: Record<Invoice["status"], string> = {
  EXPECTED: "Expected",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

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

const STATUS_FILTERS: readonly FilterOption[] = (
  ["EXPECTED", "PAID", "CANCELLED"] as const
).map((status) => ({ value: status, label: STATUS_LABELS[status] }));

const SORTS: readonly SortChoice[] = [
  { value: "projected-asc", label: "Soonest payment" },
  { value: "projected-desc", label: "Latest payment" },
  { value: "amount-desc", label: "Largest amount" },
  { value: "amount-asc", label: "Smallest amount" },
  { value: "client-asc", label: "Client A–Z" },
  { value: "client-desc", label: "Client Z–A" },
];

const SORT_VALUES = new Set(SORTS.map((option) => option.value));

/** The date an invoice is actually expected to land on. */
function projectedDate(invoice: Invoice): string {
  return addDays(invoice.expectedPaymentDate, invoice.paymentDelayDays);
}

interface InvoicesTabProps {
  forecast: Forecast;
  projection: Projection;
  update: (updater: (current: Forecast) => Forecast) => void;
}

export function InvoicesTab({ forecast, projection, update }: InvoicesTabProps) {
  const [editing, setEditing] = useState<{ invoice: Invoice | null } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Invoice | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(ALL_FILTER);
  const [sort, setSort] = useState("projected-asc");

  const impacts = useMemo(() => itemImpact(projection), [projection]);

  const visible = useMemo(() => {
    const filtered = forecast.invoices.filter(
      (invoice) =>
        (status === ALL_FILTER || invoice.status === status) &&
        matchesQuery(query, invoice.clientName, STATUS_LABELS[invoice.status]),
    );
    return sortInvoices(filtered, SORT_VALUES.has(sort) ? sort : "projected-asc");
  }, [forecast.invoices, status, query, sort]);

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

  /** Deletes, then offers the way back. Undo restores the original position. */
  const remove = (invoice: Invoice): void => {
    const index = forecast.invoices.findIndex((candidate) => candidate.id === invoice.id);

    update((current) => ({
      ...current,
      invoices: current.invoices.filter((candidate) => candidate.id !== invoice.id),
    }));

    showUndoToast(`Deleted the invoice for “${invoice.clientName}”.`, () => {
      update((current) => {
        if (current.invoices.some((candidate) => candidate.id === invoice.id)) return current;
        const next = [...current.invoices];
        next.splice(index < 0 ? next.length : index, 0, invoice);
        return { ...current, invoices: next };
      });
    });
  };

  const clearFilters = (): void => {
    setQuery("");
    setStatus(ALL_FILTER);
  };

  const expectedTotal = forecast.invoices
    .filter((invoice) => invoice.status === "EXPECTED")
    .reduce((total, invoice) => total + invoice.amountCents, 0);

  const delayedCount = forecast.invoices.filter(
    (invoice) => invoice.status === "EXPECTED" && invoice.paymentDelayDays > 0,
  ).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoices</CardTitle>
        <CardDescription>
          {forecast.invoices.length === 0
            ? "No invoices yet."
            : `${formatCents(expectedTotal, forecast.currency)} expected outstanding · ${delayedCount} with a delay allowance`}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
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
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <TableToolbar
                  scope="invoices"
                  query={query}
                  onQueryChange={setQuery}
                  filterLabel="status"
                  filterOptions={STATUS_FILTERS}
                  filterValue={status}
                  onFilterChange={setStatus}
                  sorts={SORTS}
                  sort={sort}
                  onSortChange={setSort}
                  visibleCount={visible.length}
                  totalCount={forecast.invoices.length}
                />
              </div>
              <Button size="sm" onClick={() => setEditing({ invoice: null })}>
                <PlusIcon />
                Add invoice
              </Button>
            </div>

            {visible.length === 0 ? (
              <NoMatches scope="invoices" onClear={clearFilters} />
            ) : (
              <>
                <TableWrapper>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Recurs</TableHead>
                        <TableHead>Expected</TableHead>
                        <TableHead>Delay</TableHead>
                        <TableHead>Projected</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Over horizon</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visible.map((invoice) => {
                        const impact = impactFor(impacts, "invoice", invoice.id);
                        return (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-medium">{invoice.clientName}</TableCell>
                            <TableCell>
                              <Badge variant={STATUS_VARIANT[invoice.status]}>
                                {STATUS_LABELS[invoice.status]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {RECURRENCE_LABELS[invoice.recurrence]}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {formatIsoDate(invoice.expectedPaymentDate)}
                            </TableCell>
                            <TableCell className="tnum text-muted-foreground text-xs">
                              +{invoice.paymentDelayDays}d
                            </TableCell>
                            <TableCell className="tnum text-xs font-medium text-positive">
                              {formatIsoDate(projectedDate(invoice))}
                            </TableCell>
                            <TableCell className="tnum text-right font-medium">
                              {formatCents(invoice.amountCents, forecast.currency)}
                            </TableCell>
                            <ImpactCell
                              impact={impact}
                              currency={forecast.currency}
                              isActive={invoice.status === "EXPECTED"}
                            />
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
                <p className="text-muted-foreground text-xs">
                  “Over horizon” counts a repeating invoice every time it fires. Only expected
                  invoices are projected — paid ones are assumed to be inside your starting balance,
                  and cancelled ones are ignored.
                </p>
              </>
            )}
          </>
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
        description="This removes the invoice from the forecast. You will get a moment to undo it afterwards."
        confirmLabel="Delete invoice"
        onConfirm={() => {
          const target = pendingDelete;
          if (target === null) return;
          remove(target);
          setPendingDelete(null);
        }}
      />
    </Card>
  );
}

function sortInvoices(items: readonly Invoice[], sort: string): Invoice[] {
  const copy = [...items];
  switch (sort) {
    case "projected-asc":
      return copy.sort((a, b) => byDate("asc")(projectedDate(a), projectedDate(b)));
    case "projected-desc":
      return copy.sort((a, b) => byDate("desc")(projectedDate(a), projectedDate(b)));
    case "amount-desc":
      return copy.sort((a, b) => byCents("desc")(a.amountCents, b.amountCents));
    case "amount-asc":
      return copy.sort((a, b) => byCents("asc")(a.amountCents, b.amountCents));
    case "client-asc":
      return copy.sort((a, b) => byText("asc")(a.clientName, b.clientName));
    case "client-desc":
      return copy.sort((a, b) => byText("desc")(a.clientName, b.clientName));
    default:
      return copy;
  }
}
