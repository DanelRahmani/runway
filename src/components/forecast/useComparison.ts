import { useMemo } from "react";

import { alignSeries } from "@/lib/forecast/aggregate";
import { runProjection } from "@/lib/forecast/engine";
import { compareProjections } from "@/lib/forecast/scenarios";
import type { ChartPoint, Forecast, ScenarioDiff } from "@/types/forecast";

export interface ComparisonResult {
  baseLabel: string;
  scenarioLabel: string;
  chartData: ChartPoint[];
  diff: ScenarioDiff | null;
  ready: boolean;
}

/**
 * Compares two forecasts.
 *
 * Memoised on the two forecast objects: the engine is pure, so re-running it on
 * every keystroke elsewhere in the app would be wasted work.
 */
export function useComparison(
  base: Forecast | undefined,
  scenario: Forecast | undefined,
): ComparisonResult {
  return useMemo(() => comparePair(base, scenario), [base, scenario]);
}

export function comparePair(
  base: Forecast | undefined,
  scenario: Forecast | undefined,
): ComparisonResult {
  if (base === undefined || scenario === undefined) {
    return {
      baseLabel: base?.scenarioLabel ?? base?.name ?? "Base",
      scenarioLabel: scenario?.scenarioLabel ?? scenario?.name ?? "Scenario",
      chartData: [],
      diff: null,
      ready: false,
    };
  }

  const baseProjection = runProjection(base);
  const scenarioProjection = runProjection(scenario);

  return {
    baseLabel: base.scenarioLabel ?? base.name,
    scenarioLabel: scenario.scenarioLabel ?? scenario.name,
    chartData: alignSeries(baseProjection.days, scenarioProjection.days),
    diff: compareProjections(base, scenario),
    ready: true,
  };
}
