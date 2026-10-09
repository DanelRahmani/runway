import { GitCompareArrowsIcon, PlusIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { ComparisonChart } from "@/components/charts/ComparisonChart";
import { ConfirmDialog } from "@/components/forms/ConfirmDialog";
import { useComparison } from "@/components/forecast/useComparison";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatIsoDate } from "@/lib/dates";
import { describeScenarioImpact, SCENARIO_PRESETS } from "@/lib/forecast/scenarios";
import { formatCents } from "@/lib/money";
import {
  createScenario,
  deleteForecast,
  saveForecast,
  type StoredForecast,
} from "@/lib/storage/forecasts";
import { cn, createId } from "@/lib/utils";
import type { Currency, Forecast, ScenarioDiff } from "@/types/forecast";

interface ScenariosTabProps {
  forecast: Forecast;
  scenarios: readonly StoredForecast[];
}

export function ScenariosTab({ forecast, scenarios }: ScenariosTabProps) {
  const [busyPreset, setBusyPreset] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<StoredForecast | null>(null);

  // `ponytail:` charts the first saved scenario against the base. Comparing all
  // of them at once needs a series picker; the dedicated comparison view covers
  // that, so this panel stays a single at-a-glance check.
  const featured = scenarios[0];

  const applyPreset = async (preset: (typeof SCENARIO_PRESETS)[number]): Promise<void> => {
    const variant = preset.apply(forecast);
    if (variant === null) return;

    setBusyPreset(preset.id);
    try {
      const now = new Date().toISOString();
      // The preset returns a full forecast; only its identity and lineage change.
      await saveForecast({
        ...variant,
        id: createId(),
        name: variant.scenarioLabel ?? variant.name,
        createdAt: now,
        updatedAt: now,
        baseForecastId: forecast.id,
        archived: false,
      });
    } finally {
      setBusyPreset(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Scenario planning</CardTitle>
          <CardDescription>
            Create a variant, change one assumption, and see exactly what difference it makes.
            Scenarios are stored separately and never alter the base case.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-muted-foreground text-xs font-medium">Start from a common question</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SCENARIO_PRESETS.map((preset) => {
              const applicable = preset.apply(forecast) !== null;
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={!applicable || busyPreset !== null}
                  onClick={() => void applyPreset(preset)}
                  className={cn(
                    "focus-visible:ring-ring rounded-lg border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
                    applicable ? "hover:bg-accent" : "cursor-not-allowed opacity-50",
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <SparklesIcon className="size-3.5" />
                    {preset.label(forecast.currency)}
                  </span>
                  <span className="text-muted-foreground mt-1 block text-xs">
                    {applicable
                      ? preset.description(forecast.currency)
                      : "Not applicable — nothing in this forecast matches that assumption."}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-muted-foreground text-xs">
            Pre-set amounts are in euros. Adjust them on the scenario once it is created.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>Saved scenarios</CardTitle>
            <CardDescription>
              {scenarios.length === 0
                ? "No scenarios yet."
                : `${scenarios.length} scenario${scenarios.length === 1 ? "" : "s"} based on this forecast.`}
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void createScenario(forecast.id, `${forecast.name} — variant`)}
          >
            <PlusIcon />
            Duplicate as scenario
          </Button>
        </CardHeader>
        <CardContent>
          {scenarios.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-xs">
              Pick a question above, or duplicate this forecast and change anything you like.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {scenarios.map((scenario) => (
                <li
                  key={scenario.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2"
                >
                  <Badge variant="muted">Scenario</Badge>
                  <span className="text-sm font-medium">
                    {scenario.scenarioLabel ?? scenario.name}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    updated {formatIsoDate(scenario.updatedAt.slice(0, 10))}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/forecast/${scenario.id}`}>Open</Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${scenario.name}`}
                      onClick={() => setPendingDelete(scenario)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {featured !== undefined ? (
        <ComparisonPanel
          base={forecast}
          scenario={featured}
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link to={`/compare?a=${forecast.id}&b=${featured.id}`}>
                <GitCompareArrowsIcon />
                Open in comparison view
              </Link>
            </Button>
          }
        />
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => (open ? undefined : setPendingDelete(null))}
        title={`Delete "${pendingDelete?.name ?? ""}"?`}
        description="This permanently removes the scenario from this browser. The base forecast is untouched."
        confirmLabel="Delete scenario"
        onConfirm={() => {
          const target = pendingDelete;
          if (target === null) return;
          void deleteForecast(target.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}

function ComparisonPanel({
  base,
  scenario,
  actions,
}: {
  base: Forecast;
  scenario: Forecast;
  actions: ReactNode;
}) {
  const { baseLabel, scenarioLabel, chartData, diff } = useComparison(base, scenario);
  if (diff === null) return null;

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>Base vs scenario</CardTitle>
          <CardDescription>{describeScenarioImpact(diff)}</CardDescription>
        </div>
        {actions}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ComparisonChart
          data={chartData}
          currency={base.currency}
          baseLabel={baseLabel}
          scenarioLabel={scenarioLabel}
          divergenceDate={diff.maxDivergenceDate}
        />
        <DifferenceTable diff={diff} currency={base.currency} />
      </CardContent>
    </Card>
  );
}

interface DiffRow {
  label: string;
  baseValue: string;
  scenarioValue: string;
  delta: number;
  /** `true` when a positive delta is an improvement. */
  higherIsBetter: boolean;
}

/**
 * Base | Scenario | Difference for every headline measure.
 *
 * The delta is coloured by whether the change helps: more inflow is good, more
 * outflow is not, so a shared "positive is green" rule would be misleading.
 */
export function DifferenceTable({ diff, currency }: { diff: ScenarioDiff; currency: Currency }) {
  const cashOut = (date: string | null): string => (date === null ? "Never" : formatIsoDate(date));

  const rows: DiffRow[] = [
    {
      label: "Minimum projected balance",
      baseValue: formatCents(diff.baseSummary.minimumBalanceCents, currency),
      scenarioValue: formatCents(diff.scenarioSummary.minimumBalanceCents, currency),
      delta: diff.minimumDeltaCents,
      higherIsBetter: true,
    },
    {
      label: "Ending balance",
      baseValue: formatCents(diff.baseSummary.endingBalanceCents, currency),
      scenarioValue: formatCents(diff.scenarioSummary.endingBalanceCents, currency),
      delta: diff.endingDeltaCents,
      higherIsBetter: true,
    },
    {
      label: "Total inflows",
      baseValue: formatCents(diff.baseSummary.totalInflowCents, currency),
      scenarioValue: formatCents(diff.scenarioSummary.totalInflowCents, currency),
      delta: diff.totalInflowDeltaCents,
      higherIsBetter: true,
    },
    {
      label: "Total outflows",
      baseValue: formatCents(diff.baseSummary.totalOutflowCents, currency),
      scenarioValue: formatCents(diff.scenarioSummary.totalOutflowCents, currency),
      delta: diff.totalOutflowDeltaCents,
      higherIsBetter: false,
    },
  ];

  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="text-muted-foreground sr-only">
          Base forecast versus scenario, measure by measure
        </caption>
        <thead>
          <tr className="border-b">
            <th scope="col" className="text-muted-foreground h-9 text-left text-xs font-medium">
              Measure
            </th>
            <th scope="col" className="text-muted-foreground h-9 text-right text-xs font-medium">
              {diff.baseName}
            </th>
            <th scope="col" className="text-muted-foreground h-9 text-right text-xs font-medium">
              {diff.scenarioName}
            </th>
            <th scope="col" className="text-muted-foreground h-9 text-right text-xs font-medium">
              Difference
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const improves = row.higherIsBetter ? row.delta > 0 : row.delta < 0;
            const worsens = row.higherIsBetter ? row.delta < 0 : row.delta > 0;
            return (
              <tr key={row.label} className="border-b last:border-0">
                <th scope="row" className="py-2 text-left font-normal">
                  {row.label}
                </th>
                <td className="tnum text-muted-foreground py-2 text-right">{row.baseValue}</td>
                <td className="tnum py-2 text-right font-medium">{row.scenarioValue}</td>
                <td
                  className={cn(
                    "tnum py-2 text-right font-semibold",
                    improves ? "text-positive" : worsens ? "text-negative" : "text-muted-foreground",
                  )}
                >
                  {formatCents(row.delta, currency, { signed: true })}
                </td>
              </tr>
            );
          })}
          <tr>
            <th scope="row" className="py-2 text-left font-normal">
              Cash-out date
            </th>
            <td className="tnum text-muted-foreground py-2 text-right">
              {cashOut(diff.baseSummary.cashOutDate)}
            </td>
            <td className="tnum py-2 text-right font-medium">
              {cashOut(diff.scenarioSummary.cashOutDate)}
            </td>
            <td
              className={cn(
                "tnum py-2 text-right font-semibold",
                diff.cashOutDeltaDays === null
                  ? "text-muted-foreground"
                  : diff.cashOutDeltaDays > 0
                    ? "text-positive"
                    : diff.cashOutDeltaDays < 0
                      ? "text-negative"
                      : "text-muted-foreground",
              )}
            >
              {diff.cashOutDeltaDays === null
                ? "—"
                : `${diff.cashOutDeltaDays > 0 ? "+" : ""}${diff.cashOutDeltaDays} days`}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
