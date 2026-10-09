import { CopyIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/forms/ConfirmDialog";
import { RecurringItemForm } from "@/components/forms/RecurringItemForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrapper,
} from "@/components/ui/table";
import { formatIsoDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { createId } from "@/lib/utils";
import type { Currency, Forecast, RecurringItem } from "@/types/forecast";

const FREQUENCY_LABELS: Record<RecurringItem["frequency"], string> = {
  WEEKLY: "Weekly",
  BIWEEKLY: "Every 2 weeks",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
};

interface RecurringTabProps {
  forecast: Forecast;
  update: (updater: (current: Forecast) => Forecast) => void;
}

export function RecurringTab({ forecast, update }: RecurringTabProps) {
  const [editing, setEditing] = useState<{ item: RecurringItem | null } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RecurringItem | null>(null);

  const upsert = (item: RecurringItem): void => {
    update((current) => {
      const exists = current.recurringItems.some((candidate) => candidate.id === item.id);
      return {
        ...current,
        recurringItems: exists
          ? current.recurringItems.map((candidate) => (candidate.id === item.id ? item : candidate))
          : [...current.recurringItems, item],
      };
    });
  };

  const duplicate = (item: RecurringItem): void => {
    upsert({ ...item, id: createId(), name: `${item.name} (copy)` });
  };

  const setActive = (item: RecurringItem, isActive: boolean): void => {
    update((current) => ({
      ...current,
      recurringItems: current.recurringItems.map((candidate) =>
        candidate.id === item.id ? { ...candidate, isActive } : candidate,
      ),
    }));
  };

  const incomeTotal = forecast.recurringItems
    .filter((item) => item.isActive && item.direction === "INFLOW")
    .reduce((total, item) => total + item.amountCents, 0);
  const expenseTotal = forecast.recurringItems
    .filter((item) => item.isActive && item.direction === "OUTFLOW")
    .reduce((total, item) => total + item.amountCents, 0);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle>Recurring items</CardTitle>
          <CardDescription>
            {summary(forecast.recurringItems.length, incomeTotal, expenseTotal, forecast.currency)}
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setEditing({ item: null })}>
          <PlusIcon />
          Add item
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {forecast.recurringItems.length === 0 ? (
          <EmptyRecurring onAdd={() => setEditing({ item: null })} />
        ) : (
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forecast.recurringItems.map((item) => (
                  <TableRow key={item.id} className={item.isActive ? undefined : "opacity-55"}>
                    <TableCell>
                      <span className="font-medium">{item.name}</span>
                      {item.category !== undefined ? (
                        <span className="text-muted-foreground block text-xs">{item.category}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.direction === "INFLOW" ? "positive" : "negative"}>
                        {item.direction === "INFLOW" ? "Income" : "Expense"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {FREQUENCY_LABELS[item.frequency]}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatIsoDate(item.startDate)}
                      {item.endDate !== undefined ? ` → ${formatIsoDate(item.endDate)}` : ""}
                    </TableCell>
                    <TableCell
                      className={`tnum text-right font-medium ${
                        item.direction === "INFLOW" ? "text-positive" : "text-negative"
                      }`}
                    >
                      {item.direction === "INFLOW" ? "+" : "−"}
                      {formatCents(item.amountCents, forecast.currency)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={item.isActive}
                        onCheckedChange={(checked) => setActive(item, checked)}
                        aria-label={`${item.isActive ? "Deactivate" : "Activate"} ${item.name}`}
                      />
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
                          onClick={() => duplicate(item)}
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
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
        )}
      </CardContent>

      {editing !== null ? (
        <RecurringItemForm
          item={editing.item}
          currency={forecast.currency}
          defaultStartDate={forecast.startDate}
          onSubmit={upsert}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => (open ? undefined : setPendingDelete(null))}
        title={`Delete "${pendingDelete?.name ?? ""}"?`}
        description="This removes the item from the forecast. You can undo it by importing a backup, but not from this screen."
        confirmLabel="Delete item"
        onConfirm={() => {
          const target = pendingDelete;
          if (target === null) return;
          update((current) => ({
            ...current,
            recurringItems: current.recurringItems.filter((item) => item.id !== target.id),
          }));
          setPendingDelete(null);
        }}
      />
    </Card>
  );
}

function summary(
  count: number,
  income: number,
  expense: number,
  currency: Currency,
): string {
  if (count === 0) return "Nothing scheduled yet.";
  return `${count} item${count === 1 ? "" : "s"} · ${formatCents(income, currency)} in, ${formatCents(expense, currency)} out per cycle`;
}

function EmptyRecurring({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">No recurring items yet</p>
        <p className="text-muted-foreground text-xs">
          Rent, subscriptions, a retainer, a tax provision — anything that repeats goes here.
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={onAdd}>
        <PlusIcon />
        Add your first item
      </Button>
    </div>
  );
}
