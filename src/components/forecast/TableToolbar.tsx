import { SearchIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALL_FILTER, type SortChoice } from "@/lib/itemSort";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

interface TableToolbarProps {
  /** Names the controls for screen readers when a page holds several tables. */
  scope: string;
  query: string;
  onQueryChange: (query: string) => void;
  /** Label for the filter dimension, e.g. "category" or "status". */
  filterLabel: string;
  filterOptions: readonly FilterOption[];
  filterValue: string;
  onFilterChange: (value: string) => void;
  sorts: readonly SortChoice[];
  sort: string;
  onSortChange: (sort: string) => void;
  visibleCount: number;
  totalCount: number;
}

const SELECT_CLASS =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 h-8 w-full rounded-md border px-2 text-xs shadow-xs outline-none focus-visible:ring-[3px]";

/**
 * Search, one filter dimension and sort — shared by the item tables.
 *
 * The filter dimension is passed in rather than hardcoded to category, so the
 * invoice table can filter by status (which is the thing you actually want to
 * narrow down there) without needing a second component.
 */
export function TableToolbar({
  scope,
  query,
  onQueryChange,
  filterLabel,
  filterOptions,
  filterValue,
  onFilterChange,
  sorts,
  sort,
  onSortChange,
  visibleCount,
  totalCount,
}: TableToolbarProps) {
  const filtering = query.trim() !== "" || filterValue !== ALL_FILTER;

  const clear = (): void => {
    onQueryChange("");
    onFilterChange(ALL_FILTER);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            placeholder={`Search ${scope}`}
            aria-label={`Search ${scope}`}
            className="h-8 pr-8 pl-8 text-xs"
            onChange={(event) => onQueryChange(event.target.value)}
          />
          {query !== "" ? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground absolute top-1/2 right-0.5 size-7 -translate-y-1/2"
              aria-label="Clear search"
              onClick={() => onQueryChange("")}
            >
              <XIcon className="size-3.5" />
            </Button>
          ) : null}
        </div>

        <div className="flex gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2">
            <span className="sr-only">{`Filter ${scope} by ${filterLabel}`}</span>
            <select
              value={filterValue}
              onChange={(event) => onFilterChange(event.target.value)}
              className={cn(SELECT_CLASS, "sm:w-40")}
            >
              <option value={ALL_FILTER}>All {filterLabel}s</option>
              {filterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-0 flex-1 items-center gap-2">
            <span className="sr-only">{`Sort ${scope}`}</span>
            <select
              value={sort}
              onChange={(event) => onSortChange(event.target.value)}
              className={cn(SELECT_CLASS, "sm:w-48")}
            >
              {sorts.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {filtering ? (
        <div className="flex items-center gap-2">
          <p className="text-muted-foreground text-xs" role="status">
            Showing {visibleCount} of {totalCount}
          </p>
          <Button variant="link" size="sm" className="h-auto px-0 text-xs" onClick={clear}>
            Clear filters
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Shown when filters exclude everything, so a table never just looks empty. */
export function NoMatches({ scope, onClear }: { scope: string; onClear: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed p-5">
      <p className="text-sm font-medium">No {scope} match those filters</p>
      <p className="text-muted-foreground text-xs">
        Nothing has been deleted — the rows are hidden by the search or filter.
      </p>
      <Button size="sm" variant="outline" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  );
}
