import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceDot,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  CHART_COLORS,
  boundsOf,
  computeGradientOffset,
  paddedDomain,
} from "@/components/charts/chart-utils";
import { formatCents, formatCentsTick } from "@/lib/money";
import { formatIsoDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Currency, IsoDate } from "@/types/forecast";

export interface BalancePoint {
  date: IsoDate;
  label: string;
  balanceCents: number;
}

interface BalanceChartProps {
  data: readonly BalancePoint[];
  currency: Currency;
  /** Date of the minimum balance, highlighted with a marker. */
  minimumDate?: IsoDate;
  minimumCents?: number;
  height?: number;
}

interface TooltipPayloadEntry {
  value?: number | string;
  color?: string;
  name?: string | number;
  dataKey?: string | number;
}

interface TooltipContentProps {
  active?: boolean;
  payload?: readonly TooltipPayloadEntry[];
  label?: string | number;
  currency: Currency;
}

/**
 * Projected balance over time.
 *
 * The area is filled with a two-stop gradient whose split sits exactly on the
 * zero line, so a negative stretch is unmistakable without a second series.
 */
export function BalanceChart({
  data,
  currency,
  minimumDate,
  minimumCents,
  height = 320,
}: BalanceChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="text-muted-foreground flex items-center justify-center rounded-lg border border-dashed text-sm"
        style={{ height }}
      >
        No projection yet.
      </div>
    );
  }

  const bounds = boundsOf(data.map((point) => point.balanceCents));
  const offset = computeGradientOffset(bounds.min, bounds.max);
  const domain = paddedDomain(bounds);

  const minimumPoint =
    minimumDate !== undefined ? data.find((point) => point.date === minimumDate) : undefined;

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data.slice()} margin={{ top: 16, right: 16, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="runway-balance-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset={offset} stopColor={CHART_COLORS.positive} stopOpacity={0.28} />
              <stop offset={offset} stopColor={CHART_COLORS.negative} stopOpacity={0.3} />
            </linearGradient>
            <linearGradient id="runway-balance-stroke" x1="0" y1="0" x2="0" y2="1">
              <stop offset={offset} stopColor={CHART_COLORS.positive} />
              <stop offset={offset} stopColor={CHART_COLORS.negative} />
            </linearGradient>
          </defs>

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
            content={<BalanceTooltip currency={currency} />}
            cursor={{ stroke: CHART_COLORS.muted, strokeDasharray: "3 3" }}
          />

          {/* The zero line is the whole point of the chart: crossing it is the event. */}
          <ReferenceLine y={0} stroke={CHART_COLORS.negative} strokeWidth={1} strokeDasharray="4 3" />

          <Area
            type="monotone"
            dataKey="balanceCents"
            name="Projected balance"
            stroke="url(#runway-balance-stroke)"
            strokeWidth={2}
            fill="url(#runway-balance-fill)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            isAnimationActive={false}
          />

          {minimumPoint !== undefined ? (
            <ReferenceDot
              x={minimumPoint.date}
              y={minimumCents ?? minimumPoint.balanceCents}
              r={5}
              fill={minimumPoint.balanceCents < 0 ? CHART_COLORS.negative : CHART_COLORS.positive}
              stroke="var(--background)"
              strokeWidth={2}
            />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function BalanceTooltip({ active, payload, label, currency }: TooltipContentProps) {
  if (active !== true || payload === undefined || payload.length === 0) return null;

  const entry = payload[0];
  const value = typeof entry?.value === "number" ? entry.value : 0;
  const negative = value < 0;

  return (
    <div className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground mb-1">
        {typeof label === "string" ? formatIsoDate(label) : String(label ?? "")}
      </p>
      <p className={`font-medium tnum ${negative ? "text-negative" : "text-positive"}`}>
        {formatCents(value, currency, { signed: value > 0 })}
      </p>
      {negative ? (
        <p className="text-negative mt-1">Below zero — cash is short on this date.</p>
      ) : null}
    </div>
  );
}

/**
 * Names the colours rather than leaving the reader to infer them.
 *
 * The lowest-point marker is a separate entry in its own right, because "when do
 * I hit bottom" is a different question from "when do I run out".
 */
export function ChartLegend({ minimumCents }: { minimumCents: number }) {
  return (
    <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
      <span className="flex items-center gap-1.5">
        <span className="bg-positive inline-block size-2.5 rounded-full" aria-hidden="true" />
        Balance above zero
      </span>
      <span className="flex items-center gap-1.5">
        <span className="bg-negative inline-block size-2.5 rounded-full" aria-hidden="true" />
        Balance below zero
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className={cn(
            "inline-block size-2.5 rounded-full border-2 border-background",
            minimumCents < 0
              ? "bg-negative ring-1 ring-negative"
              : "bg-positive ring-1 ring-positive",
          )}
          aria-hidden="true"
        />
        Lowest point
      </span>
    </div>
  );
}
