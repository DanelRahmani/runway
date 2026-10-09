import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { foldToDonutSlices, type DonutSlice } from "@/lib/donut";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Currency } from "@/types/forecast";

const SLICE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
] as const;

function donutColor(index: number): string {
  return SLICE_COLORS[index] ?? SLICE_COLORS[SLICE_COLORS.length - 1] ?? "var(--chart-1)";
}

interface DonutChartProps {
  slices: readonly DonutSlice[];
  currency: Currency;
  height?: number;
  className?: string;
}

interface DonutTooltipProps {
  active?: boolean;
  payload?: readonly { payload?: DonutSlice }[];
  currency: Currency;
  total: number;
}

/**
 * Composition of a total, as a ring with its legend beside it.
 *
 * The ring is `aria-hidden` and the legend is the real content: it carries every
 * label, amount and share, so the chart is never the only carrier of meaning and
 * nobody has to distinguish six colours to read it. That is also why the scale is
 * capped at six slices — past that the wedges stop being comparable.
 *
 * Rendered flat, with a background-coloured stroke between wedges rather than a
 * drop shadow, to match the rest of the app.
 */
export function DonutChart({ slices, currency, height = 176, className }: DonutChartProps) {
  const data = foldToDonutSlices(slices);
  const total = data.reduce((sum, slice) => sum + slice.cents, 0);

  if (data.length === 0 || total <= 0) return null;

  return (
    <div className={cn("flex flex-col items-start gap-4 sm:flex-row sm:items-center", className)}>
      <div className="w-full shrink-0 sm:w-[11rem]" style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.slice()}
              dataKey="cents"
              nameKey="label"
              innerRadius="64%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="var(--background)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((slice, index) => (
                <Cell key={slice.key} fill={donutColor(index)} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip currency={currency} total={total} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex w-full min-w-0 flex-col gap-2">
        {data.map((slice, index) => {
          const share = slice.cents / total;
          return (
            <li key={slice.key} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="inline-block size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: donutColor(index) }}
                  aria-hidden="true"
                />
                <span className="truncate">{slice.label}</span>
              </span>
              <span className="flex shrink-0 items-baseline gap-2">
                <span className="tnum font-medium">{formatCents(slice.cents, currency)}</span>
                <span className="text-muted-foreground tnum w-9 text-right">
                  {Math.round(share * 100)}%
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DonutTooltip({ active, payload, currency, total }: DonutTooltipProps) {
  if (active !== true || payload === undefined || payload.length === 0) return null;

  const slice = payload[0]?.payload;
  if (slice === undefined) return null;

  return (
    <div className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground mb-1">{slice.label}</p>
      <p className="tnum font-medium">{formatCents(slice.cents, currency)}</p>
      <p className="text-muted-foreground mt-0.5 tnum">
        {Math.round((slice.cents / total) * 100)}% of the total
      </p>
    </div>
  );
}
