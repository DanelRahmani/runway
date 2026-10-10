import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  ReferenceDot,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_COLORS, boundsOf, paddedDomain } from "@/components/charts/chart-utils";
import { formatIsoDate } from "@/lib/dates";
import { formatCents, formatCentsTick } from "@/lib/money";
import type { ChartPoint, Currency, IsoDate } from "@/types/forecast";

interface ComparisonChartProps {
  data: readonly ChartPoint[];
  currency: Currency;
  baseLabel: string;
  scenarioLabel: string;
  /** Date of maximum divergence, marked so the eye lands on the interesting point. */
  divergenceDate?: IsoDate | null;
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
  baseLabel: string;
  scenarioLabel: string;
}

/** Base and scenario balances on one axis so the gap between them is readable. */
export function ComparisonChart({
  data,
  currency,
  baseLabel,
  scenarioLabel,
  divergenceDate,
  height = 320,
}: ComparisonChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="text-muted-foreground flex items-center justify-center rounded-lg border border-dashed text-sm"
        style={{ height }}
      >
        Nothing to compare yet.
      </div>
    );
  }

  const bounds = boundsOf([
    ...data.map((point) => point.baseCents),
    ...data.map((point) => point.scenarioCents),
  ]);
  const domain = paddedDomain(bounds);

  const divergencePoint =
    divergenceDate !== undefined && divergenceDate !== null
      ? data.find((point) => point.date === divergenceDate)
      : undefined;

  return (
    <div
      style={{ height }}
      className="w-full"
      role="img"
      aria-label={`${baseLabel} and ${scenarioLabel} compared from ${formatIsoDate(data[0]?.date ?? "")} to ${formatIsoDate(data[data.length - 1]?.date ?? "")}${divergenceDate === undefined || divergenceDate === null ? "" : `. They diverge most on ${formatIsoDate(divergenceDate)}`}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.slice()} margin={{ top: 16, right: 16, bottom: 4, left: 4 }}>
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
            content={
              <ComparisonTooltip
                currency={currency}
                baseLabel={baseLabel}
                scenarioLabel={scenarioLabel}
              />
            }
            cursor={{ stroke: CHART_COLORS.muted, strokeDasharray: "3 3" }}
          />

          <ReferenceLine y={0} stroke={CHART_COLORS.negative} strokeWidth={1} strokeDasharray="4 3" />

          <Line
            type="monotone"
            dataKey="baseCents"
            name={baseLabel}
            stroke={CHART_COLORS.balance}
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="scenarioCents"
            name={scenarioLabel}
            stroke={CHART_COLORS.scenario}
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />

          {divergencePoint !== undefined && divergencePoint.scenarioCents !== null ? (
            <ReferenceDot
              x={divergencePoint.date}
              y={divergencePoint.scenarioCents}
              r={5}
              fill={CHART_COLORS.scenario}
              stroke="var(--background)"
              strokeWidth={2}
            />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ComparisonTooltip({
  active,
  payload,
  label,
  currency,
  baseLabel,
  scenarioLabel,
}: TooltipContentProps) {
  if (active !== true || payload === undefined || payload.length === 0) return null;

  const base = payload.find((entry) => entry.dataKey === "baseCents");
  const scenario = payload.find((entry) => entry.dataKey === "scenarioCents");
  const baseValue = typeof base?.value === "number" ? base.value : null;
  const scenarioValue = typeof scenario?.value === "number" ? scenario.value : null;
  const delta = baseValue !== null && scenarioValue !== null ? scenarioValue - baseValue : null;

  return (
    <div className="bg-popover text-popover-foreground min-w-52 rounded-lg border px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground mb-1.5">
        {typeof label === "string" ? formatIsoDate(label) : String(label ?? "")}
      </p>
      <dl className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-4">
          <dt className="flex items-center gap-1.5">
            <span
              className="inline-block size-2 rounded-full"
              style={{ backgroundColor: CHART_COLORS.balance }}
              aria-hidden="true"
            />
            {baseLabel}
          </dt>
          <dd className="tnum font-medium">
            {baseValue === null ? "—" : formatCents(baseValue, currency)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="flex items-center gap-1.5">
            <span
              className="inline-block size-2 rounded-full"
              style={{ backgroundColor: CHART_COLORS.scenario }}
              aria-hidden="true"
            />
            {scenarioLabel}
          </dt>
          <dd className="tnum font-medium">
            {scenarioValue === null ? "—" : formatCents(scenarioValue, currency)}
          </dd>
        </div>
        {delta !== null ? (
          <div className="mt-1 flex items-center justify-between gap-4 border-t pt-1">
            <dt className="text-muted-foreground">Difference</dt>
            <dd className={`tnum font-medium ${delta < 0 ? "text-negative" : "text-positive"}`}>
              {formatCents(delta, currency, { signed: true })}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
