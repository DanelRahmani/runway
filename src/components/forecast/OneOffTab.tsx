import { CopyIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/forms/ConfirmDialog";
import { OneOffItemForm } from "@/components/forms/OneOffItemForm";
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
import { compareIsoDate, formatIsoDate, horizonEndDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { createId } from "@/lib/utils";
import type { Currency, Forecast, OneOffItem } from "@/types/forecast";

interface OneOffTabProps {
  forecast: Forecast;
  update: (updater: (current: Forecast) => Forecast) => void;
}

export function OneOffTab({ forecast, update }: OneOffTabProps) {
  const [editing, setEditing] = useState<{ item: OneOffItem | null } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<OneOffItem | null>(null);

  // Chronological order is the only order that makes sense for dated events.
  const sorted = [...forecast.oneOffItems].sort((a, b) => compareIsoDate(a.date, b.date));

  const upsert = (item: OneOffItem): void => {
    update((current) => {
      const exists = current.oneOffItems.some((candidate) => candidate.id === item.id);
      return {
        ...current,
        oneOffItems: exists
          ? current.oneOffItems.map((candidate) => (candidate.id === item.id ? item : candidate))
          : [...current.oneOffItems, item],
      };
    });
  };

  const totals = sorted.reduce(
    (accumulator, item) => {
      if (item.direction === "INFLOW") accumulator.income += item.amountCents;
      else accumulator.expense += item.amountCents;
      return accumulator;
    },
    { income: 0, expense: 0 },
  );

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle>One-off items</CardTitle>
          <CardDescription>{describe(sorted.length, totals, forecast.currency)}</CardDescription>
        </div>
        <Button size="sm" onClick={() => setEditing({ item: null })}>
          <PlusIcon />
          Add item
        </Button>
      </CardHeader>

      <CardContent>
        {sorted.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-5">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">No one-off items yet</p>
              <p className="text-muted-foreground text-xs">
                A laptop, a bonus, an annual tax bill — anything that happens once on a known date.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setEditing({ item: null })}>
              <PlusIcon />
              Add your first item
            </Button>
          </div>
        ) : (
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((item) => {
                  const horizonEnd = horizonEndDate(forecast.startDate, forecast.horizon);
                  const outsideHorizon =
                    compareIsoDate(item.date, forecast.startDate) < 0 ||
                    compareIsoDate(item.date, horizonEnd) > 0;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <span className="font-medium">{item.name}</span>
                        {item.category !== undefined ? (
                          <span className="text-muted-foreground block text-xs">
                            {item.category}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.direction === "INFLOW" ? "positive" : "negative"}>
                          {item.direction === "INFLOW" ? "Income" : "Expense"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatIsoDate(item.date)}
                        {outsideHorizon ? (
                          <Badge variant="muted" className="ml-2">
                            Outside horizon
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell
                        className={`tnum text-right font-medium ${
                          item.direction === "INFLOW" ? "text-positive" : "text-negative"
                        }`}
                      >
                        {item.direction === "INFLOW" ? "+" : "−"}
                        {formatCents(item.amountCents, forecast.currency)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Edit ${item.name}`}
                            onClick={() => setEditing({ item })}
                          >
                            <PencilIcon />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Duplicate ${item.name}`}
                            onClick={() => upsert({ ...item, id: createId(), name: `${item.name} (copy)` })}
                          >
                            <CopyIcon />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Delete ${item.name}`}
                            onClick={() => setPendingDelete(item)}
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
        <OneOffItemForm
          item={editing.item}
          currency={forecast.currency}
          defaultDate={forecast.startDate}
          onSubmit={upsert}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => (open ? undefined : setPendingDelete(null))}
        title={`Delete "${pendingDelete?.name ?? ""}"?`}
        description="This removes the item from the forecast."
        confirmLabel="Delete item"
        onConfirm={() => {
          const target = pendingDelete;
          if (target === null) return;
          update((current) => ({
            ...current,
            oneOffItems: current.oneOffItems.filter((item) => item.id !== target.id),
          }));
          setPendingDelete(null);
        }}
      />
    </Card>
  );
}

/** Human-readable summary of the one-off list. */
function describe(
  count: number,
  totals: { income: number; expense: number },
  currency: Currency,
): string {
  if (count === 0) return "Nothing scheduled yet.";
  return `${count} item${count === 1 ? "" : "s"} · ${formatCents(totals.income, currency)} in, ${formatCents(totals.expense, currency)} out`;
}
