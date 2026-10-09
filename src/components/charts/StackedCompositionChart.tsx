import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatIsoDate, formatIsoDateRange } from "@/lib/dates";
import type { CompositionPeriod } from "@/lib/forecast/savings";
import { formatCents, formatCentsCompact } from "@/lib/money";
import type { Currency, Granularity } from "@/types/forecast";

/**
 * Order matters: spending sits on the axis, kept sits on top, so the eye reads
 * "what I spent" and "what I kept" as the two ends of the same column.
 */
const SERIES = [
  { dataKey: "spendingCents", label: "Spending", color: "var(--chart-1)" },
  { dataKey: "taxCents", label: "Tax", color: "var(--chart-3)" },
  { dataKey: "keptCents", label: "Kept", color: "var(--chart-2)" },
] as const;

interface StackedCompositionChartProps {
  periods: readonly CompositionPeriod[];
  currency: Currency;
  granularity: Granularity;
  height?: number;
}

interface TooltipEntry {
  dataKey?: string | number;
  value?: number | string;
}

interface TooltipProps {
  active?: boolean;
  payload?: readonly TooltipEntry[];
  label?: string | number;
  currency: Currency;
  granularity: Granularity;
  periods: readonly CompositionPeriod[];
}

/**
 * How the outflow mix changes across the horizon.
 *
 * The counterpart to the donuts, and the reason both exist: a donut answers
 * "what is the split overall", which is a single moment collapsed into one shape
 * and hides when things happened. A tax quarter and a quiet month look identical
 * once summed. Keeping time on the x-axis is the only way to see that.
 *
 * Labelled `role="img"` so the chart is announced, but the per-column numbers are
 * not duplicated here — the cash-flow table on the Overview carries them in a
 * form a screen reader can actually read.
 */
export function StackedCompositionChart({
  periods,
  currency,
  granularity,
  height = 260,
}: StackedCompositionChartProps) {
  if (periods.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div style={{ height }} className="w-full" role="img" aria-label={`Stacked bars per ${granularity === "daily" ? "day" : granularity === "weekly" ? "week" : "month"} showing spending, tax and money kept`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={periods.slice()} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="startDate"
              tickFormatter={(value: string) => formatIsoDate(value, undefined, false)}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              minTickGap={44}
              interval="preserveStartEnd"
            />
            <YAxis
              width={72}
              tickFormatter={(value: number) => formatCentsCompact(value, currency)}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }}
              content={
                <CompositionTooltip
                  currency={currency}
                  granularity={granularity}
                  periods={periods}
                />
              }
            />
            {SERIES.map((series) => (
              <Bar
                key={series.dataKey}
                dataKey={series.dataKey}
                name={series.label}
                stackId="outflow"
                fill={series.color}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* The legend is static: only the values move, so the names are the reading key. */}
      <ul className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        {SERIES.map((series) => (
          <li key={series.dataKey} className="flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-sm"
              style={{ backgroundColor: series.color }}
              aria-hidden="true"
            />
            {series.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CompositionTooltip({
  active,
  payload,
  label,
  currency,
  granularity,
  periods,
}: TooltipProps) {
  if (active !== true || payload === undefined || payload.length === 0) return null;

  const key = typeof label === "string" ? label : "";
  const period = periods.find((entry) => entry.startDate === key);
  const heading =
    period === undefined
      ? formatIsoDate(key)
      : granularity === "daily"
        ? formatIsoDate(period.startDate)
        : formatIsoDateRange(period.startDate, period.endDate);

  const total = SERIES.reduce((sum, series) => {
    const entry = payload.find((item) => item.dataKey === series.dataKey);
    return sum + (typeof entry?.value === "number" ? entry.value : 0);
  }, 0);

  return (
    <div className="bg-popover text-popover-foreground min-w-[11rem] rounded-lg border px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground mb-1.5">{heading}</p>
      <ul className="flex flex-col gap-1">
        {SERIES.map((series) => {
          const entry = payload.find((item) => item.dataKey === series.dataKey);
          const value = typeof entry?.value === "number" ? entry.value : 0;
          return (
            <li key={series.dataKey} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block size-2.5 rounded-sm"
                  style={{ backgroundColor: series.color }}
                  aria-hidden="true"
                />
                {series.label}
              </span>
              <span className="tnum font-medium">{formatCents(value, currency)}</span>
            </li>
          );
        })}
      </ul>
      <p className="text-muted-foreground mt-1.5 border-t pt-1.5 flex items-center justify-between gap-4">
        <span>Total out</span>
        <span className="tnum">{formatCents(total, currency)}</span>
      </p>
    </div>
  );
}
