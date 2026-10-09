import { CopyIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/forms/ConfirmDialog";
import { OneOffItemForm } from "@/components/forms/OneOffItemForm";
import { BulkBar, SelectionCheckbox } from "@/components/forecast/BulkBar";
import { CategoryLabel } from "@/components/forecast/CategoryLabel";
import { NoMatches, TableToolbar } from "@/components/forecast/TableToolbar";
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
import { useSelection, withoutCategory } from "@/hooks/useSelection";
import { compareIsoDate, formatIsoDate, horizonEndDate } from "@/lib/dates";
import {
  ALL_FILTER,
  byCents,
  byDate,
  byText,
  distinctCategories,
  matchesFilter,
  matchesQuery,
  type SortChoice,
} from "@/lib/itemSort";
import { formatCents } from "@/lib/money";
import { showUndoToast } from "@/lib/toast";
import { createId } from "@/lib/utils";
import type { Currency, Forecast, OneOffItem, Projection } from "@/types/forecast";

const SORTS: readonly SortChoice[] = [
  { value: "date-asc", label: "Soonest first" },
  { value: "date-desc", label: "Latest first" },
  { value: "amount-desc", label: "Largest amount" },
  { value: "amount-asc", label: "Smallest amount" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
];

const SORT_VALUES = new Set(SORTS.map((option) => option.value));

interface OneOffTabProps {
  forecast: Forecast;
  /** Accepted for a consistent tab signature; a one-off's impact is its amount. */
  projection: Projection;
  update: (updater: (current: Forecast) => Forecast) => void;
}

export function OneOffTab({ forecast, update }: OneOffTabProps) {
  const [editing, setEditing] = useState<{ item: OneOffItem | null } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<OneOffItem | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL_FILTER);
  const [sort, setSort] = useState("date-asc");
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);

  const itemIds = useMemo(() => forecast.oneOffItems.map((item) => item.id), [forecast.oneOffItems]);
  const selection = useSelection(itemIds);

  const categories = useMemo(() => distinctCategories(forecast.oneOffItems), [forecast.oneOffItems]);
  const horizonEnd = horizonEndDate(forecast.startDate, forecast.horizon);

  /** Chronological is the natural default for dated events, but not the only useful order. */
  const visible = useMemo(() => {
    const filtered = forecast.oneOffItems.filter(
      (item) =>
        matchesFilter(item.category, category) &&
        matchesQuery(query, item.name, item.category, item.note),
    );
    return sortOneOff(filtered, SORT_VALUES.has(sort) ? sort : "date-asc");
  }, [forecast.oneOffItems, category, query, sort]);

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

  /** Deletes, then offers the way back. Undo restores the original position. */
  const remove = (item: OneOffItem): void => {
    const index = forecast.oneOffItems.findIndex((candidate) => candidate.id === item.id);

    update((current) => ({
      ...current,
      oneOffItems: current.oneOffItems.filter((candidate) => candidate.id !== item.id),
    }));

    showUndoToast(`Deleted “${item.name}”.`, () => {
      update((current) => {
        if (current.oneOffItems.some((candidate) => candidate.id === item.id)) return current;
        const next = [...current.oneOffItems];
        next.splice(index < 0 ? next.length : index, 0, item);
        return { ...current, oneOffItems: next };
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
      oneOffItems: current.oneOffItems.map((item) => {
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
    const removed = forecast.oneOffItems
      .map((item, index) => ({ item, index }))
      .filter((entry) => targets.has(entry.item.id));

    update((current) => ({
      ...current,
      oneOffItems: current.oneOffItems.filter((item) => !targets.has(item.id)),
    }));
    selection.clear();

    showUndoToast(`Deleted ${removed.length} item${removed.length === 1 ? "" : "s"}.`, () => {
      update((current) => {
        const next = [...current.oneOffItems];
        for (const { item, index } of removed) {
          if (next.some((candidate) => candidate.id === item.id)) continue;
          next.splice(Math.min(index, next.length), 0, item);
        }
        return { ...current, oneOffItems: next };
      });
    });
  };

  const totals = forecast.oneOffItems.reduce(
    (accumulator, item) => {
      if (item.direction === "INFLOW") accumulator.income += item.amountCents;
      else accumulator.expense += item.amountCents;
      return accumulator;
    },
    { income: 0, expense: 0 },
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>One-off items</CardTitle>
        <CardDescription>
          {describe(forecast.oneOffItems.length, totals, forecast.currency)}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {forecast.oneOffItems.length === 0 ? (
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
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <TableToolbar
                  scope="one-off items"
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
                  totalCount={forecast.oneOffItems.length}
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
              <NoMatches scope="one-off items" onClear={clearFilters} />
            ) : (
              <>
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
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-center">In horizon</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visible.map((item) => {
                        const outsideHorizon =
                          compareIsoDate(item.date, forecast.startDate) < 0 ||
                          compareIsoDate(item.date, horizonEnd) > 0;
                        return (
                          <TableRow key={item.id}>
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
                              <Badge
                                variant={item.direction === "INFLOW" ? "positive" : "negative"}
                              >
                                {item.direction === "INFLOW" ? "Income" : "Expense"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {formatIsoDate(item.date)}
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
                              {outsideHorizon ? (
                                <Badge variant="muted" title="Outside the horizon, so not projected">
                                  No
                                </Badge>
                              ) : (
                                <Badge variant="positive" title="Projected into the forecast">
                                  Yes
                                </Badge>
                              )}
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
                <p className="text-muted-foreground text-xs">
                  One-off items land once, so the amount shown is also their whole impact. Items
                  marked “No” fall outside the horizon and are not projected.
                </p>
              </>
            )}
          </>
        )}
      </CardContent>

      {editing !== null ? (
        <OneOffItemForm
          item={editing.item}
          currency={forecast.currency}
          defaultDate={forecast.startDate}
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

function sortOneOff(items: readonly OneOffItem[], sort: string): OneOffItem[] {
  const copy = [...items];
  switch (sort) {
    case "date-asc":
      return copy.sort((a, b) => byDate("asc")(a.date, b.date));
    case "date-desc":
      return copy.sort((a, b) => byDate("desc")(a.date, b.date));
    case "amount-desc":
      return copy.sort((a, b) => byCents("desc")(a.amountCents, b.amountCents));
    case "amount-asc":
      return copy.sort((a, b) => byCents("asc")(a.amountCents, b.amountCents));
    case "name-asc":
      return copy.sort((a, b) => byText("asc")(a.name, b.name));
    case "name-desc":
      return copy.sort((a, b) => byText("desc")(a.name, b.name));
    default:
      return copy;
  }
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
