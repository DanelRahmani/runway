import { useMemo } from "react";
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
  CHART_COLORS,
  boundsOf,
  paddedDomain,
  seriesColor,
} from "@/components/charts/chart-utils";
import type { AccountSeriesPoint } from "@/lib/forecast/accounts";
import { formatIsoDate } from "@/lib/dates";
import { formatCents, formatCentsCompact } from "@/lib/money";
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
  /*
   * Recharts reads a `dataKey` off the top level of each row, so the engine's
   * nested `cents` map is flattened once here rather than reached into per line.
   */
  const data = useMemo(
    () => series.map((point) => ({ date: point.date, ...point.cents })),
    [series],
  );

  const ids = useMemo(() => accounts.map((account) => account.id), [accounts]);

  const domain = useMemo(
    () => paddedDomain(boundsOf(series.flatMap((point) => ids.map((id) => point.cents[id])))),
    [series, ids],
  );

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
        aria-label={`Balance of each account over time${range}. Closing balances and growth are listed above.`}
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
              tickFormatter={(value: number) => formatCentsCompact(value, currency)}
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

            {accounts.map((account, index) => (
              <Line
                key={account.id}
                type="monotone"
                dataKey={account.id}
                name={account.name}
                stroke={seriesColor(index)}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ul className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        {accounts.map((account, index) => (
          <li key={account.id} className="flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ backgroundColor: seriesColor(index) }}
              aria-hidden="true"
            />
            {account.name}
          </li>
        ))}
      </ul>
    </div>
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
