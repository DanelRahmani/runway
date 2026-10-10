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

import { CHART_COLORS, boundsOf, paddedDomain } from "@/components/charts/chart-utils";
import { formatIsoDate } from "@/lib/dates";
import type { KeptPoint } from "@/lib/forecast/savings";
import { formatCents, formatCentsTick } from "@/lib/money";
import type { Currency } from "@/types/forecast";

interface GoalProgressChartProps {
  /**
   * Rows come straight from `keptCurve`, whose `date` and `cumulativeCents` keys
   * are the contract this chart's `dataKey` reads. Pinned in `tests/savings.test.ts`.
   */
  points: readonly KeptPoint[];
  targetCents: number;
  currency: Currency;
  height?: number;
}

interface TooltipEntry {
  value?: number | string;
  dataKey?: string | number;
}

interface TooltipContentProps {
  active?: boolean;
  payload?: readonly TooltipEntry[];
  label?: string | number;
  currency: Currency;
}

function GoalTooltip({ active, payload, label, currency }: TooltipContentProps) {
  if (active !== true || payload === undefined || payload.length === 0) return null;

  const value = payload[0]?.value;
  if (typeof value !== "number") return null;

  return (
    <div className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground">
        {typeof label === "string" ? formatIsoDate(label) : ""}
      </p>
      <p className="font-medium">{formatCents(value, currency)} kept</p>
    </div>
  );
}

/**
 * Money kept, accumulated across the horizon, against the goal line.
 *
 * The curve only ever rises — it counts transfers out — so unlike the balance
 * chart it answers "how far along am I" rather than "where do I stand". The
 * target is a reference line, not a second series: it is a constant the user set,
 * not something the projection produced.
 */
export function GoalProgressChart({
  points,
  targetCents,
  currency,
  height = 168,
}: GoalProgressChartProps) {
  if (points.length === 0) return null;

  // The target is folded into the bounds so the reference line is never off-canvas.
  const domain = paddedDomain(boundsOf([...points.map((point) => point.cumulativeCents), targetCents]));

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points.slice()} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
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
            content={<GoalTooltip currency={currency} />}
            cursor={{ stroke: CHART_COLORS.muted, strokeDasharray: "3 3" }}
          />

          <ReferenceLine y={targetCents} stroke={CHART_COLORS.scenario} strokeDasharray="4 3" />

          <Line
            type="monotone"
            dataKey="cumulativeCents"
            stroke={CHART_COLORS.positive}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
