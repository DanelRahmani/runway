import { useMemo, useState, type ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  AccountBreakdownChart,
  AccountBreakdownLegend,
} from "@/components/charts/AccountBreakdownChart";
import {
  CHART_COLORS,
  boundsOf,
  paddedDomain,
  seriesColor,
} from "@/components/charts/chart-utils";
import {
  breakdownSeries,
  growthRows,
  type AccountSeriesPoint,
} from "@/lib/forecast/accounts";
import { formatIsoDate } from "@/lib/dates";
import { formatCents, formatCentsTick } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Account, Currency } from "@/types/forecast";

interface AccountGrowthChartProps {
  series: readonly AccountSeriesPoint[];
  /** The pots to plot, in the order they are listed. Never the spending account. */
  accounts: readonly Account[];
  currency: Currency;
  height?: number;
}

interface TooltipEntry {
  value?: number | string;
  color?: string;
  name?: string | number;
  dataKey?: string | number;
}

/**
 * Every pot's balance over the horizon, one line each.
 *
 * The spending account is deliberately absent. It already has its own chart on the
 * overview, and on most forecasts it swings by more across a year than the pots
 * hold in total — putting it on this axis would flatten every growth curve into a
 * straight line, which is the one thing this chart exists to show. That is also
 * why there is no total line: the panel already reports the totals, and the point
 * here is the shape of each one.
 */
export function AccountGrowthChart({
  series,
  accounts,
  currency,
  height = 260,
}: AccountGrowthChartProps) {
  /**
   * One account isolated, or `null` for all of them.
   *
   * A single choice rather than one switch per line: the question people actually
   * ask is "how is *this* one doing", and hiding the other four to answer it is
   * four clicks rather than one.
   */
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const shown = useMemo(
    () => (selectedId === null ? accounts : accounts.filter((a) => a.id === selectedId)),
    [accounts, selectedId],
  );

  /*
   * Flattened once, because every line below reads its `dataKey` off the top level
   * of a row. `growthRows` owns that shape so it can be tested without a browser.
   */
  const data = useMemo(() => growthRows(series), [series]);

  const ids = useMemo(() => shown.map((account) => account.id), [shown]);

  const domain = useMemo(
    () => paddedDomain(boundsOf(series.flatMap((point) => ids.map((id) => point.cents[id])))),
    [series, ids],
  );

  const breakdown = useMemo(() => breakdownSeries(series, shown), [series, shown]);

  const selectedName =
    selectedId === null
      ? null
      : (accounts.find((account) => account.id === selectedId)?.name ?? null);

  if (accounts.length === 0) {
    return (
      <div
        className="text-muted-foreground flex items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm"
        style={{ height }}
      >
        Add an account and set a rate to see it grow over time.
      </div>
    );
  }

  const first = series[0]?.date;
  const last = series.at(-1)?.date;
  const range =
    first !== undefined && last !== undefined
      ? ` from ${formatIsoDate(first)} to ${formatIsoDate(last)}`
      : "";

  return (
    <div className="flex flex-col gap-3">
      <div
        style={{ height }}
        className="w-full"
        role="img"
        aria-label={`Balance of ${selectedName ?? "each account"} over time${range}. Closing balances and growth are listed above.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="2 4" vertical={false} />

            <XAxis
              dataKey="date"
              tickFormatter={(value: string) => formatIsoDate(value, undefined, false)}
              tick={{ fontSize: 11, fill: CHART_COLORS.muted }}
              tickLine={false}
              axisLine={{ stroke: CHART_COLORS.grid }}
              minTickGap={44}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={domain}
              width={72}
              tickFormatter={(value: number) => formatCentsTick(value, currency)}
              tick={{ fontSize: 11, fill: CHART_COLORS.muted }}
              tickLine={false}
              axisLine={false}
            />

            <Tooltip
              content={<GrowthTooltip currency={currency} />}
              cursor={{ stroke: CHART_COLORS.muted, strokeDasharray: "3 3" }}
            />

            {/* A debt pot lives below this line, so it is worth drawing. */}
            <ReferenceLine
              y={0}
              stroke={CHART_COLORS.negative}
              strokeWidth={1}
              strokeDasharray="4 3"
            />

            {shown.map((account) => (
              <Line
                key={account.id}
                type="monotone"
                dataKey={account.id}
                name={account.name}
                /* Colour comes from the account's place in the full list, so a
                   line keeps its colour when another is isolated. */
                stroke={seriesColor(accounts.indexOf(account))}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex flex-wrap items-center gap-1.5">
        <LegendButton selected={selectedId === null} onClick={() => setSelectedId(null)}>
          All
        </LegendButton>
        {accounts.map((account) => (
          <LegendButton
            key={account.id}
            selected={selectedId === account.id}
            onClick={() => setSelectedId(selectedId === account.id ? null : account.id)}
          >
            <span
              className="inline-block size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: seriesColor(accounts.indexOf(account)) }}
              aria-hidden="true"
            />
            {account.name}
          </LegendButton>
        ))}
      </ul>

      <div className="mt-1 flex flex-col gap-3 border-t pt-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">
            {selectedName === null ? "Where the change came from" : `Where ${selectedName}'s change came from`}
          </p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Money you moved in, stacked under money the annual rate added. Together they are how
            much the balance changed over the horizon — the opening balance is not part of it.
          </p>
        </div>
        <AccountBreakdownChart
          data={breakdown}
          currency={currency}
          subject={selectedName ?? "these accounts"}
        />
        <AccountBreakdownLegend />
      </div>
    </div>
  );
}

/** A legend entry that isolates its account. `aria-pressed` carries the state. */
function LegendButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onClick}
        className={cn(
          "text-muted-foreground flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
          "hover:text-foreground focus-visible:ring-ring/40 focus-visible:outline-none focus-visible:ring-[3px]",
          selected && "border-foreground/25 bg-muted text-foreground",
        )}
      >
        {children}
      </button>
    </li>
  );
}

function GrowthTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: readonly TooltipEntry[];
  label?: string | number;
  currency: Currency;
}) {
  if (active !== true || payload === undefined || payload.length === 0) return null;

  return (
    <div className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground mb-1.5">
        {typeof label === "string" ? formatIsoDate(label) : ""}
      </p>
      <ul className="flex flex-col gap-1">
        {payload.map((entry) => (
          <li
            key={String(entry.dataKey)}
            className="flex items-center justify-between gap-4 whitespace-nowrap"
          >
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: entry.color }}
                aria-hidden="true"
              />
              {String(entry.name ?? "")}
            </span>
            <span className="tnum font-medium">
              {formatCents(typeof entry.value === "number" ? entry.value : 0, currency)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
