import { ArrowLeftIcon, GitCompareArrowsIcon, Loader2Icon, TriangleAlertIcon } from "lucide-react";
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { ComparisonChart } from "@/components/charts/ComparisonChart";
import { AppShell } from "@/components/layout/AppShell";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { DifferenceTable } from "@/components/forecast/ScenariosTab";
import { useComparison } from "@/components/forecast/useComparison";
import { Alert, AlertDescription, AlertIcon, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/forms/Field";
import { formatIsoDate } from "@/lib/dates";
import { describeScenarioImpact } from "@/lib/forecast/scenarios";
import { useForecasts } from "@/lib/storage/forecasts";

/**
 * Side-by-side comparison of any two forecasts.
 *
 * Selection lives in the query string (`?a=` base, `?b=` scenario) so a
 * comparison can be linked to and survives a refresh.
 */
export function ComparePage() {
  const { forecasts, loading } = useForecasts();
  const [searchParams, setSearchParams] = useSearchParams();

  const baseId = searchParams.get("a") ?? "";
  const scenarioId = searchParams.get("b") ?? "";

  const base = forecasts.find((item) => item.id === baseId);
  const scenario = forecasts.find((item) => item.id === scenarioId);

  const { baseLabel, scenarioLabel, chartData, diff } = useComparison(base, scenario);

  const options = useMemo(
    () => forecasts.map((item) => ({ id: item.id, name: item.name })),
    [forecasts],
  );

  const setParam = (key: "a" | "b", value: string): void => {
    const next = new URLSearchParams(searchParams);
    if (value === "") next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  if (loading) {
    return (
      <AppShell wide>
        <div
          className="text-muted-foreground flex items-center justify-center gap-2 py-24 text-sm"
          role="status"
        >
          <Loader2Icon className="size-4 animate-spin" />
          Loading forecasts…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      wide
      actions={
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">
            <ArrowLeftIcon />
            <span className="hidden sm:inline">All forecasts</span>
          </Link>
        </Button>
      }
    >
      <header className="flex flex-col gap-1">
        <h1 className="font-display flex items-center gap-3 text-2xl leading-tight tracking-tight sm:text-3xl">
          <GitCompareArrowsIcon className="size-5 sm:size-6" />
          Compare forecasts
        </h1>
        <p className="text-muted-foreground text-sm">
          Put a base forecast next to a scenario and see exactly where the two diverge.
        </p>
      </header>

      {forecasts.length < 2 ? (
        <Alert variant="warning">
          <AlertIcon>
            <TriangleAlertIcon />
          </AlertIcon>
          <AlertTitle>You need two forecasts to compare.</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <span>
              Open a forecast and use <strong>Duplicate as scenario</strong> on the Scenarios tab, or
              start from one of the preset questions.
            </span>
            <Button variant="outline" size="sm" asChild>
              <Link to="/">Back to your forecasts</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Choose what to compare</CardTitle>
            <CardDescription>
              The base is the reference; the scenario is measured against it.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Base forecast" htmlFor="compare-base" required>
              <select
                id="compare-base"
                value={baseId}
                onChange={(event) => setParam("a", event.target.value)}
                className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              >
                <option value="">Select a forecast…</option>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Compare with" htmlFor="compare-scenario" required>
              <select
                id="compare-scenario"
                value={scenarioId}
                onChange={(event) => setParam("b", event.target.value)}
                className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 h-9 w-full rounded-md border px-3 text-sm shadow-sm outline-none focus-visible:ring-[3px]"
              >
                <option value="">Select a forecast…</option>
                {options
                  .filter((option) => option.id !== baseId)
                  .map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
              </select>
            </Field>
          </CardContent>
        </Card>
      )}

      {diff !== null && base !== undefined ? (
        <ErrorBoundary label="the comparison">
          <Card>
            <CardHeader>
              <CardTitle>
                {baseLabel} vs {scenarioLabel}
              </CardTitle>
              <CardDescription>{describeScenarioImpact(diff)}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ComparisonChart
                data={chartData}
                currency={base.currency}
                baseLabel={baseLabel}
                scenarioLabel={scenarioLabel}
                divergenceDate={diff.maxDivergenceDate}
              />

              <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-2 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="bg-foreground inline-block h-0.5 w-4 rounded" aria-hidden="true" />
                  {baseLabel} (solid)
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-0.5 w-4 rounded"
                    style={{ backgroundColor: "var(--chart-scenario)" }}
                    aria-hidden="true"
                  />
                  {scenarioLabel} (dashed)
                </span>
                {diff.maxDivergenceDate !== null ? (
                  <span>
                    Widest gap on {formatIsoDate(diff.maxDivergenceDate)} — the marked point.
                  </span>
                ) : null}
              </div>

              <DifferenceTable diff={diff} currency={base.currency} />
            </CardContent>
          </Card>
        </ErrorBoundary>
      ) : forecasts.length >= 2 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-sm">
          Pick two forecasts above to see the comparison.
        </p>
      ) : null}
    </AppShell>
  );
}
