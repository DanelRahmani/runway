import { describeDays, formatIsoDate } from "@/lib/dates";
import { aggregate } from "@/lib/forecast/aggregate";
import { runwayDays } from "@/lib/forecast/engine";
import { keptCurve } from "@/lib/forecast/savings";
import { formatCents } from "@/lib/money";
import type { Forecast, Projection } from "@/types/forecast";

/**
 * The one-page printable summary.
 *
 * Built as plain data rather than markup so the print stylesheet has nothing to
 * compute and the content can be asserted in a node test — a print layout cannot
 * be tested in this repo's environment, so the part that can be tested is here.
 */

export interface PrintLine {
  label: string;
  value: string;
}

export interface PrintRow {
  period: string;
  opening: string;
  inflow: string;
  outflow: string;
  closing: string;
}

export interface PrintSummary {
  title: string;
  subtitle: string;
  lines: PrintLine[];
  columns: readonly string[];
  rows: PrintRow[];
}

export const PRINT_COLUMNS = ["Period", "Opening", "Inflows", "Outflows", "Closing"] as const;

export function buildPrintSummary(forecast: Forecast, projection: Projection): PrintSummary {
  const { summary } = projection;
  const currency = forecast.currency;
  const money = (cents: number): string => formatCents(cents, currency);
  const runway = runwayDays(projection);

  const lines: PrintLine[] = [
    { label: "Starting balance", value: money(summary.startingBalanceCents) },
    { label: "Projected ending balance", value: money(summary.endingBalanceCents) },
    { label: "Minimum projected balance", value: money(summary.minimumBalanceCents) },
    {
      label: "Cash-out date",
      value:
        summary.cashOutDate === null
          ? "No projected shortfall"
          : formatIsoDate(summary.cashOutDate),
    },
  ];

  // Only meaningful when there is a shortfall; the KPI card follows the same rule.
  if (runway !== null) {
    lines.push({ label: "Runway from the start", value: describeDays(runway) });
  }

  lines.push(
    { label: "Total inflows", value: money(summary.totalInflowCents) },
    { label: "Total outflows", value: money(summary.totalOutflowCents) },
  );

  if (forecast.goal !== undefined) {
    const keptCents = keptCurve(projection).at(-1)?.cumulativeCents ?? 0;
    lines.push({
      label: `Goal — ${forecast.goal.label}`,
      value: `${money(keptCents)} of ${money(forecast.goal.targetCents)} by ${formatIsoDate(forecast.goal.targetDate)}`,
    });
  }

  return {
    title: forecast.name,
    subtitle: `${formatIsoDate(projection.startDate)} to ${formatIsoDate(projection.endDate)} · ${currency}`,
    lines,
    columns: PRINT_COLUMNS,
    rows: aggregate(projection.days, "monthly").map((period) => ({
      period: period.label,
      opening: money(period.openingCents),
      inflow: money(period.inflowCents),
      outflow: money(period.outflowCents),
      closing: money(period.closingCents),
    })),
  };
}
