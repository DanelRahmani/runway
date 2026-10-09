import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_COLORS } from "@/components/charts/chart-utils";
import { formatIsoDate } from "@/lib/dates";
import type { BreakdownPoint } from "@/lib/forecast/accounts";
import { formatCents, formatCentsTick } from "@/lib/money";
import type { Currency } from "@/types/forecast";

const SERIES = [
  { dataKey: "contributionsCents", label: "You paid in", color: "var(--chart-4)" },
  { dataKey: "growthCents", label: "The rate added", color: "var(--chart-3)" },
] as const;

interface AccountBreakdownChartProps {
  data: readonly BreakdownPoint[];
  currency: Currency;
  /** What the bands describe, named in the caption. */
  subject: string;
  height?: number;
}

interface TooltipEntry {
  value?: number | string;
  color?: string;
  name?: string | number;
  dataKey?: string | number;
}

/**
 * Where the change in a set of accounts came from.
 *
 * Two bands only — money the user moved in, and money the rate moved — because
 * those are the two things a person can actually decide about. The stack totals
 * `totalCents`, so the top of it is how much the accounts gained over the horizon,
 * and the split says how much of that was earned rather than saved.
 *
 * Growth arrives in monthly steps, because that is when it is credited and rounded
 * to whole cents. The curve is smoothed for reading, not to imply the money lands
 * continuously.
 */
export function AccountBreakdownChart({
  data,
  currency,
  subject,
  height = 220,
}: AccountBreakdownChartProps) {
  const moved = data.some(
    (point) => point.contributionsCents !== 0 || point.growthCents !== 0,
  );

  if (data.length === 0 || !moved) {
    return (
      <div
        className="text-muted-foreground flex items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm"
        style={{ height }}
      >
        Nothing moved in or out of {subject} over this horizon.
      </div>
    );
  }

  /*
   * Normally pinned to zero, because a composition chart whose floor drifts
   * exaggerates whichever band happens to be largest. It drops below zero only
   * when the data does — repaying a debt pot takes money *out* of it, and that is
   * a real negative contribution rather than a gap to be clipped.
   */
  const floor = Math.min(
    0,
    ...data.map((point) => Math.min(point.contributionsCents, point.totalCents)),
  );

  return (
    <div
      style={{ height }}
      className="w-full"
      role="img"
      aria-label={`How much of the change in ${subject} was paid in and how much the annual rate added, over the horizon. Exact figures are in the tooltip and the list above.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data.slice()} margin={{ top: 12, right: 16, bottom: 4, left: 4 }}>
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
            domain={[floor, "auto"]}
            width={72}
            tickFormatter={(value: number) => formatCentsTick(value, currency)}
            tick={{ fontSize: 11, fill: CHART_COLORS.muted }}
            tickLine={false}
            axisLine={false}
          />

          <Tooltip
            content={<BreakdownTooltip currency={currency} />}
            cursor={{ stroke: CHART_COLORS.muted, strokeDasharray: "3 3" }}
          />

          {SERIES.map((series) => (
            <Area
              key={series.dataKey}
              type="monotone"
              dataKey={series.dataKey}
              name={series.label}
              stackId="change"
              stroke={series.color}
              strokeWidth={2}
              fill={series.color}
              fillOpacity={0.22}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** The two bands plus their total, because the total is what the stack is worth. */
export function AccountBreakdownLegend() {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
      {SERIES.map((series) => (
        <span key={series.dataKey} className="flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 rounded-full"
            style={{ backgroundColor: series.color }}
            aria-hidden="true"
          />
          {series.label}
        </span>
      ))}
    </div>
  );
}

function BreakdownTooltip({
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

  const total = payload.reduce(
    (sum, entry) => sum + (typeof entry.value === "number" ? entry.value : 0),
    0,
  );

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
              {formatCents(
                typeof entry.value === "number" ? entry.value : 0,
                currency,
                { signed: true },
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 flex items-center justify-between gap-4 border-t pt-1.5">
        <span>Change so far</span>
        <span className="tnum font-medium">{formatCents(total, currency, { signed: true })}</span>
      </p>
    </div>
  );
}
