import { CopyIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/forms/ConfirmDialog";
import { RecurringItemForm } from "@/components/forms/RecurringItemForm";
import { BulkBar, SelectionCheckbox } from "@/components/forecast/BulkBar";
import { CategoryLabel } from "@/components/forecast/CategoryLabel";
import { ImpactCell } from "@/components/forecast/ImpactCell";
import { NoMatches, TableToolbar } from "@/components/forecast/TableToolbar";
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
import { useSelection, withoutCategory } from "@/hooks/useSelection";
import { formatIsoDate } from "@/lib/dates";
import { impactFor, itemImpact } from "@/lib/forecast/engine";
import {
  ALL_FILTER,
  byCents,
  byText,
  distinctCategories,
  matchesFilter,
  matchesQuery,
  type SortChoice,
} from "@/lib/itemSort";
import { formatCents } from "@/lib/money";
import { showUndoToast } from "@/lib/toast";
import { createId } from "@/lib/utils";
import type { Currency, Forecast, ItemImpact, Projection, RecurringItem } from "@/types/forecast";

const FREQUENCY_LABELS: Record<RecurringItem["frequency"], string> = {
  WEEKLY: "Weekly",
  BIWEEKLY: "Every 2 weeks",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
};

const SORTS: readonly SortChoice[] = [
  { value: "amount-desc", label: "Largest amount" },
  { value: "amount-asc", label: "Smallest amount" },
  // Per-occurrence order can mislead: €10 weekly outweighs €40 monthly. This
  // orders by what the item actually does to the horizon.
  { value: "impact-desc", label: "Biggest over horizon" },
  { value: "impact-asc", label: "Smallest over horizon" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "original", label: "My order" },
];

const SORT_VALUES = new Set(SORTS.map((option) => option.value));

interface RecurringTabProps {
  forecast: Forecast;
  projection: Projection;
  update: (updater: (current: Forecast) => Forecast) => void;
}

export function RecurringTab({ forecast, projection, update }: RecurringTabProps) {
  const [editing, setEditing] = useState<{ item: RecurringItem | null } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RecurringItem | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL_FILTER);
  const [sort, setSort] = useState("amount-desc");
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);

  const itemIds = useMemo(
    () => forecast.recurringItems.map((item) => item.id),
    [forecast.recurringItems],
  );
  const selection = useSelection(itemIds);

  const impacts = useMemo(() => itemImpact(projection), [projection]);
  const categories = useMemo(
    () => distinctCategories(forecast.recurringItems),
    [forecast.recurringItems],
  );

  const visible = useMemo(() => {
    const filtered = forecast.recurringItems.filter(
      (item) =>
        matchesFilter(item.category, category) &&
        matchesQuery(query, item.name, item.category, item.note),
    );
    return sortRecurring(filtered, SORT_VALUES.has(sort) ? sort : "original", impacts);
  }, [forecast.recurringItems, category, query, sort, impacts]);

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

  const setActive = (item: RecurringItem, isActive: boolean): void => {
    update((current) => ({
      ...current,
      recurringItems: current.recurringItems.map((candidate) =>
        candidate.id === item.id ? { ...candidate, isActive } : candidate,
      ),
    }));
  };

  /** Deletes, then offers the way back. Undo restores the original position. */
  const remove = (item: RecurringItem): void => {
    const index = forecast.recurringItems.findIndex((candidate) => candidate.id === item.id);

    update((current) => ({
      ...current,
      recurringItems: current.recurringItems.filter((candidate) => candidate.id !== item.id),
    }));

    showUndoToast(`Deleted “${item.name}”.`, () => {
      update((current) => {
        if (current.recurringItems.some((candidate) => candidate.id === item.id)) return current;
        const next = [...current.recurringItems];
        next.splice(index < 0 ? next.length : index, 0, item);
        return { ...current, recurringItems: next };
      });
    });
  };

  const clearFilters = (): void => {
    setQuery("");
    setCategory(ALL_FILTER);
  };

  /** Applies one category to everything selected, in a single write. */
  const applyCategory = (next: string | undefined): void => {
    const targets = selection.ids;
    if (targets.size === 0) return;

    update((current) => ({
      ...current,
      recurringItems: current.recurringItems.map((item) => {
        if (!targets.has(item.id)) return item;
        return next === undefined ? withoutCategory(item) : { ...item, category: next };
      }),
    }));
    selection.clear();
  };

  /** Deletes the whole selection, then offers one undo for all of it. */
  const removeSelected = (): void => {
    const targets = selection.ids;
    if (targets.size === 0) return;

    // Captured with their positions so undo can put the list back as it was.
    const removed = forecast.recurringItems
      .map((item, index) => ({ item, index }))
      .filter((entry) => targets.has(entry.item.id));

    update((current) => ({
      ...current,
      recurringItems: current.recurringItems.filter((item) => !targets.has(item.id)),
    }));
    selection.clear();

    showUndoToast(`Deleted ${removed.length} item${removed.length === 1 ? "" : "s"}.`, () => {
      update((current) => {
        const next = [...current.recurringItems];
        for (const { item, index } of removed) {
          if (next.some((candidate) => candidate.id === item.id)) continue;
          next.splice(Math.min(index, next.length), 0, item);
        }
        return { ...current, recurringItems: next };
      });
    });
  };

  const incomeTotal = forecast.recurringItems
    .filter((item) => item.isActive && item.direction === "INFLOW")
    .reduce((total, item) => total + item.amountCents, 0);
  const expenseTotal = forecast.recurringItems
    .filter((item) => item.isActive && item.direction === "OUTFLOW")
    .reduce((total, item) => total + item.amountCents, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recurring items</CardTitle>
        <CardDescription>
          {summary(forecast.recurringItems.length, incomeTotal, expenseTotal, forecast.currency)}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {forecast.recurringItems.length === 0 ? (
          <EmptyRecurring onAdd={() => setEditing({ item: null })} />
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <TableToolbar
                  scope="recurring items"
                  query={query}
                  onQueryChange={setQuery}
                  filterLabel="category"
                  filterPlural="categories"
                  filterOptions={categories.map((option) => ({ value: option, label: option }))}
                  filterValue={category}
                  onFilterChange={setCategory}
                  sorts={SORTS}
                  sort={sort}
                  onSortChange={setSort}
                  visibleCount={visible.length}
                  totalCount={forecast.recurringItems.length}
                />
              </div>
              <Button size="sm" onClick={() => setEditing({ item: null })}>
                <PlusIcon />
                Add item
              </Button>
            </div>

            {selection.count > 0 ? (
              <BulkBar
                count={selection.count}
                existing={categories}
                forecastKind={forecast.forecastKind}
                onApplyCategory={applyCategory}
                onDelete={() => setPendingBulkDelete(true)}
                onClear={selection.clear}
              />
            ) : null}

            {visible.length === 0 ? (
              <NoMatches scope="recurring items" onClear={clearFilters} />
            ) : (
              <TableWrapper>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">
                        <SelectionCheckbox
                          checked={
                            visible.length > 0 &&
                            visible.every((item) => selection.isSelected(item.id))
                          }
                          indeterminate={visible.some((item) => selection.isSelected(item.id))}
                          onChange={(checked) =>
                            selection.setMany(
                              visible.map((item) => item.id),
                              checked,
                            )
                          }
                          label="Select all visible items"
                        />
                      </TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Over horizon</TableHead>
                      <TableHead className="text-center">Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((item) => {
                      const impact = impactFor(impacts, "recurring", item.id);
                      return (
                        <TableRow
                          key={item.id}
                          className={item.isActive ? undefined : "opacity-55"}
                        >
                          <TableCell>
                            <SelectionCheckbox
                              checked={selection.isSelected(item.id)}
                              onChange={(checked) => selection.toggle(item.id, checked)}
                              label={`Select ${item.name}`}
                            />
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{item.name}</span>
                            {item.category !== undefined ? (
                              <span className="text-muted-foreground block text-xs">
                                <CategoryLabel category={item.category} />
                              </span>
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
                          <ImpactCell
                            impact={impact}
                            currency={forecast.currency}
                            isActive={item.isActive}
                          />
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
                                onClick={() =>
                                  upsert({ ...item, id: createId(), name: `${item.name} (copy)` })
                                }
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
          </>
        )}
      </CardContent>

      {editing !== null ? (
        <RecurringItemForm
          item={editing.item}
          currency={forecast.currency}
          defaultStartDate={forecast.startDate}
          forecastKind={forecast.forecastKind}
          accounts={forecast.accounts ?? []}
          onSubmit={upsert}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={pendingBulkDelete}
        onOpenChange={(open) => (open ? undefined : setPendingBulkDelete(false))}
        title={`Delete ${selection.count} item${selection.count === 1 ? "" : "s"}?`}
        description="They are removed from this forecast. You can undo straight after."
        confirmLabel="Delete"
        onConfirm={removeSelected}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => (open ? undefined : setPendingDelete(null))}
        title={`Delete "${pendingDelete?.name ?? ""}"?`}
        description="This removes the item from the forecast. You will get a moment to undo it afterwards."
        confirmLabel="Delete item"
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

function impactCents(impacts: Map<string, ItemImpact>, id: string): number {
  return impactFor(impacts, "recurring", id)?.totalCents ?? 0;
}

function sortRecurring(
  items: readonly RecurringItem[],
  sort: string,
  impacts: Map<string, ItemImpact>,
): RecurringItem[] {
  const copy = [...items];
  switch (sort) {
    case "amount-desc":
      return copy.sort((a, b) => byCents("desc")(a.amountCents, b.amountCents));
    case "amount-asc":
      return copy.sort((a, b) => byCents("asc")(a.amountCents, b.amountCents));
    case "impact-desc":
      return copy.sort((a, b) =>
        byCents("desc")(impactCents(impacts, a.id), impactCents(impacts, b.id)),
      );
    case "impact-asc":
      return copy.sort((a, b) =>
        byCents("asc")(impactCents(impacts, a.id), impactCents(impacts, b.id)),
      );
    case "name-asc":
      return copy.sort((a, b) => byText("asc")(a.name, b.name));
    case "name-desc":
      return copy.sort((a, b) => byText("desc")(a.name, b.name));
    default:
      return copy;
  }
}

function summary(count: number, income: number, expense: number, currency: Currency): string {
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
