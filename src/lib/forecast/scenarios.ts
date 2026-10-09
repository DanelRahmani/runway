import { addMonths, daysBetween } from "@/lib/dates";
import { alignSeries } from "@/lib/forecast/aggregate";
import { runProjection } from "@/lib/forecast/engine";
import { formatCents } from "@/lib/money";
import { createId } from "@/lib/utils";
import type { Currency, Forecast, ScenarioDiff } from "@/types/forecast";

/**
 * Scenario modelling.
 *
 * A scenario is a real forecast row linked back to its base, so it can be edited
 * afterwards like anything else. The presets below are just functions that layer
 * a change onto a copy — they run through the same engine as the base case, which
 * is what makes the comparison deterministic.
 */

export interface ScenarioPreset {
  id: string;
  /**
   * Takes the forecast currency because two of these name an amount.
   *
   * They used to hard-code "€1,500", which read as a euro figure on a dollar or
   * yen forecast. Handing in the currency keeps the label honest.
   */
  label: (currency: Currency) => string;
  description: (currency: Currency) => string;
  /** Returns a modified copy, or `null` when the forecast has nothing to change. */
  apply: (forecast: Forecast) => Forecast | null;
}

/** Roughly a month of a junior salary, in major units, uniform across currencies. */
const HIRE_CENTS = 150_000;
const LAPTOP_CENTS = 200_000;

function copy(forecast: Forecast, label: string, changed: Partial<Forecast>): Forecast {
  return {
    ...forecast,
    ...changed,
    scenarioLabel: label,
    updatedAt: new Date().toISOString(),
  };
}

export const SCENARIO_PRESETS: readonly ScenarioPreset[] = [
  {
    id: "client-30-days-late",
    label: () => "Largest client pays 30 days late",
    description: () => "Adds 30 days to the payment delay on the biggest expected invoice.",
    apply: (forecast) => {
      const expected = forecast.invoices.filter((invoice) => invoice.status === "EXPECTED");
      if (expected.length === 0) return null;

      const largest = expected.reduce((best, invoice) =>
        invoice.amountCents > best.amountCents ? invoice : best,
      );

      return copy(forecast, "Largest client pays 30 days late", {
        invoices: forecast.invoices.map((invoice) =>
          invoice.id === largest.id
            ? { ...invoice, paymentDelayDays: invoice.paymentDelayDays + 30 }
            : invoice,
        ),
      });
    },
  },
  {
    id: "lose-monthly-client",
    label: () => "Lose a monthly client",
    description: () => "Switches off the largest monthly recurring income.",
    apply: (forecast) => {
      const monthlyIncome = forecast.recurringItems.filter(
        (item) => item.direction === "INFLOW" && item.isActive && item.frequency === "MONTHLY",
      );
      if (monthlyIncome.length === 0) return null;

      const largest = monthlyIncome.reduce((best, item) =>
        item.amountCents > best.amountCents ? item : best,
      );

      return copy(forecast, "Lose a monthly client", {
        recurringItems: forecast.recurringItems.map((item) =>
          item.id === largest.id ? { ...item, isActive: false } : item,
        ),
      });
    },
  },
  {
    id: "hire-1500-per-month",
    label: (currency) =>
      `Hire someone for ${formatCents(HIRE_CENTS, currency)} per month`,
    description: (currency) =>
      `Adds a monthly salary outflow of ${formatCents(HIRE_CENTS, currency)} starting with the forecast.`,
    apply: (forecast) =>
      copy(
        forecast,
        `Hire someone for ${formatCents(HIRE_CENTS, forecast.currency)} per month`,
        {
          recurringItems: [
            ...forecast.recurringItems,
            {
              id: createId(),
              name: "New hire",
              direction: "OUTFLOW",
              // 1,500 major units in minor units, written as an integer literal.
              amountCents: HIRE_CENTS,
              frequency: "MONTHLY",
              startDate: forecast.startDate,
              // "Payroll", not the old "People": the taxonomy has no "People"
              // bucket, so that item rendered without an emoji.
              category: "Payroll",
              note: "Scenario: added headcount",
              isActive: true,
            },
          ],
        },
      ),
  },
  {
    id: "buy-2000-laptop",
    label: (currency) => `Buy a ${formatCents(LAPTOP_CENTS, currency)} laptop next month`,
    description: (currency) =>
      `Adds a one-off equipment purchase of ${formatCents(LAPTOP_CENTS, currency)} one month after the start date.`,
    apply: (forecast) =>
      copy(
        forecast,
        `Buy a ${formatCents(LAPTOP_CENTS, forecast.currency)} laptop next month`,
        {
          oneOffItems: [
            ...forecast.oneOffItems,
            {
              id: createId(),
              name: "New laptop",
              direction: "OUTFLOW",
              amountCents: LAPTOP_CENTS,
              date: addMonths(forecast.startDate, 1),
              category: "Equipment",
              note: "Scenario: one-off capital purchase",
            },
          ],
        },
      ),
  },
];

/**
 * Difference between two projections.
 *
 * Both are run from their own start date, and days are compared by calendar
 * date rather than by index, so a scenario with a shifted start date still
 * produces a meaningful delta.
 */
export function compareProjections(base: Forecast, scenario: Forecast): ScenarioDiff {
  const baseProjection = runProjection(base);
  const scenarioProjection = runProjection(scenario);

  const baseSummary = baseProjection.summary;
  const scenarioSummary = scenarioProjection.summary;

  const aligned = alignSeries(baseProjection.days, scenarioProjection.days);
  let maxDivergenceDate: string | null = null;
  let maxDivergenceCents = 0;

  for (const point of aligned) {
    if (point.baseCents === null || point.scenarioCents === null) continue;
    const delta = point.scenarioCents - point.baseCents;
    if (Math.abs(delta) > Math.abs(maxDivergenceCents)) {
      maxDivergenceCents = delta;
      maxDivergenceDate = point.date;
    }
  }

  let cashOutDeltaDays: number | null = null;
  if (baseSummary.cashOutDate !== null && scenarioSummary.cashOutDate !== null) {
    cashOutDeltaDays = daysBetween(baseSummary.cashOutDate, scenarioSummary.cashOutDate);
  }

  return {
    baseName: base.scenarioLabel ?? base.name,
    scenarioName: scenario.scenarioLabel ?? scenario.name,
    baseSummary,
    scenarioSummary,
    endingDeltaCents: scenarioSummary.endingBalanceCents - baseSummary.endingBalanceCents,
    minimumDeltaCents: scenarioSummary.minimumBalanceCents - baseSummary.minimumBalanceCents,
    totalInflowDeltaCents: scenarioSummary.totalInflowCents - baseSummary.totalInflowCents,
    totalOutflowDeltaCents: scenarioSummary.totalOutflowCents - baseSummary.totalOutflowCents,
    cashOutDeltaDays,
    maxDivergenceDate,
    maxDivergenceCents,
  };
}

/** Human-readable verdict for the scenario comparison header. */
export function describeScenarioImpact(diff: ScenarioDiff): string {
  const baseCashOut = diff.baseSummary.cashOutDate;
  const scenarioCashOut = diff.scenarioSummary.cashOutDate;

  if (diff.cashOutDeltaDays !== null) {
    if (diff.cashOutDeltaDays > 0) {
      return `Cash runs out ${diff.cashOutDeltaDays} days later than the base case.`;
    }
    if (diff.cashOutDeltaDays < 0) {
      return `Cash runs out ${Math.abs(diff.cashOutDeltaDays)} days earlier than the base case.`;
    }
    return "Cash runs out on the same day as the base case.";
  }

  if (baseCashOut !== null && scenarioCashOut === null) {
    return "This scenario avoids the shortfall the base case runs into.";
  }
  if (baseCashOut === null && scenarioCashOut !== null) {
    return "This scenario introduces a shortfall the base case avoids.";
  }
  return "Neither case runs out of cash within the horizon.";
}

/** Suggests a scenario name that does not collide with an existing forecast. */
export function nextScenarioName(label: string, existingNames: readonly string[]): string {
  if (!existingNames.includes(label)) return label;
  let suffix = 2;
  while (existingNames.includes(`${label} (${suffix})`)) suffix += 1;
  return `${label} (${suffix})`;
}
