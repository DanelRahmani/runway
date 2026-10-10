import {
  ArrowLeftIcon,
  CircleHelpIcon,
  CopyIcon,
  GitCompareArrowsIcon,
  Loader2Icon,
  PrinterIcon,
  SearchXIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { ConfirmDialog } from "@/components/forms/ConfirmDialog";
import { AppShell } from "@/components/layout/AppShell";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { ShortcutsHelp } from "@/components/layout/ShortcutsHelp";
import { AssumptionsTab } from "@/components/forecast/AssumptionsTab";
import { DataTab } from "@/components/forecast/DataTab";
import { GraphDrawer } from "@/components/forecast/GraphDrawer";
import { InvoicesTab } from "@/components/forecast/InvoicesTab";
import { KpiCards } from "@/components/forecast/KpiCards";
import { OneOffTab } from "@/components/forecast/OneOffTab";
import { OverviewTab } from "@/components/forecast/OverviewTab";
import { RecurringTab } from "@/components/forecast/RecurringTab";
import { SaveIndicator } from "@/components/forecast/SaveIndicator";
import { SavingsTab } from "@/components/forecast/SavingsTab";
import { ScenariosTab } from "@/components/forecast/ScenariosTab";
import { WhatIfTab } from "@/components/forecast/WhatIfTab";
import { PrintSummary } from "@/components/report/PrintSummary";
import { Alert, AlertDescription, AlertIcon, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForecastEditor } from "@/hooks/useForecastEditor";
import { useShortcut } from "@/hooks/useShortcut";
import { HORIZON_LABELS, todayIso } from "@/lib/dates";
import { runProjection } from "@/lib/forecast/engine";
import { staleness } from "@/lib/forecast/insights";
import { KIND_LABELS } from "@/lib/sample";
import { deleteForecast, duplicateForecast, useForecasts } from "@/lib/storage/forecasts";

const TABS = [
  "overview",
  "savings",
  "recurring",
  "one-off",
  "invoices",
  "scenarios",
  "whatif",
  "assumptions",
  "data",
] as const;
type TabValue = (typeof TABS)[number];

const TAB_LABELS: Record<TabValue, string> = {
  overview: "Overview",
  savings: "Savings",
  recurring: "Recurring",
  "one-off": "One-off",
  invoices: "Invoices",
  scenarios: "Scenarios",
  whatif: "What if",
  assumptions: "Assumptions",
  data: "Data",
};

/**
 * Tabs that make no sense on a household forecast.
 *
 * A household raises no invoices — the engine already generates none for it — so
 * the invoices tab is the only one withheld. Scenarios used to be withheld too,
 * on the reasoning that a scenario is a business tool. That was wrong: "what if
 * the rent goes up" is a household question. The presets are filtered by kind
 * instead, so a household is never offered an invoice-driven one.
 */
const PERSONAL_HIDDEN_TABS: ReadonlySet<TabValue> = new Set<TabValue>(["invoices"]);

export function ForecastPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // `?` opens the list. Declared before the loading and not-found returns, since
  // a hook may not be called conditionally.
  useShortcut("help", () => setShowShortcuts(true));

  const { forecast, loading, notFound, saveState, update, lastError } = useForecastEditor(id);
  const { forecasts } = useForecasts();

  /*
   * The filter applies to the selected tab as well as to the list: a bookmarked
   * ?tab=invoices on a personal forecast would otherwise render a panel with no
   * trigger to navigate away from.
   */
  const visibleTabs: readonly TabValue[] =
    forecast?.forecastKind === "PERSONAL"
      ? TABS.filter((tab) => !PERSONAL_HIDDEN_TABS.has(tab))
      : TABS;

  const requestedTab = searchParams.get("tab");
  const activeTab: TabValue = visibleTabs.includes(requestedTab as TabValue)
    ? (requestedTab as TabValue)
    : "overview";

  // Pure and cheap for a few hundred days; memoised so typing in a form does not
  // re-run the engine on every unrelated render.
  const projection = useMemo(
    () => (forecast === null ? null : runProjection(forecast)),
    [forecast],
  );

  const scenarios = useMemo(
    () =>
      forecast === null
        ? []
        : forecasts.filter((candidate) => candidate.baseForecastId === forecast.id),
    [forecasts, forecast],
  );

  const baseForecast =
    forecast?.baseForecastId === undefined
      ? undefined
      : forecasts.find((candidate) => candidate.id === forecast.baseForecastId);

  if (loading) {
    return (
      <AppShell wide>
        <div
          className="text-muted-foreground flex items-center justify-center gap-2 py-24 text-sm"
          role="status"
        >
          <Loader2Icon className="size-4 animate-spin" />
          Loading forecast…
        </div>
      </AppShell>
    );
  }

  if (notFound || forecast === null || projection === null) {
    return (
      <AppShell wide>
        <Alert variant="destructive">
          <AlertIcon>
            <SearchXIcon />
          </AlertIcon>
          <AlertTitle>That forecast is not in this browser.</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <span>
              It may have been deleted, or it lives in a different browser profile. If you exported a
              JSON backup, you can import it from the Data page.
            </span>
            <Button variant="outline" size="sm" asChild>
              <Link to="/">
                <ArrowLeftIcon />
                Back to your forecasts
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      </AppShell>
    );
  }

  const setTab = (value: string): void => {
    // Keep the tab in the URL so refresh and back/forward behave as expected.
    setSearchParams(value === "overview" ? {} : { tab: value }, { replace: true });
  };

  // Pure and cheap — no engine run — so it needs no memo.
  const stale = staleness(forecast, todayIso());

  return (
    <AppShell
      wide
      actions={
        <>
          {/*
           * Prints the one-pager in `PrintSummary`, which portals itself outside
           * this shell — the shell is `print:hidden`, so anything inside it would
           * be hidden with it.
           */}
          <Button variant="ghost" size="sm" onClick={() => window.print()}>
            <PrinterIcon />
            <span className="hidden sm:inline">Print</span>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeftIcon />
              <span className="hidden sm:inline">All forecasts</span>
            </Link>
          </Button>
        </>
      }
    >
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl leading-tight tracking-tight sm:text-3xl">
                {forecast.name}
              </h1>
              <Badge variant="muted">{forecast.currency}</Badge>
              <Badge variant="muted">{HORIZON_LABELS[forecast.horizon]}</Badge>
              {/*
               * Shown whenever it is known, because the kind is what decides
               * which category suggestions the item forms offer. If it reads
               * wrong, the fix is one visit to the Assumptions tab.
               */}
              {forecast.forecastKind !== undefined ? (
                <Badge variant="muted">{KIND_LABELS[forecast.forecastKind]}</Badge>
              ) : null}
              {forecast.baseForecastId !== undefined ? (
                <Badge variant="default">Scenario</Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <SaveIndicator state={saveState} />
              {stale !== null ? (
                <span className="text-muted-foreground text-xs">{stale.text}</span>
              ) : null}
              {baseForecast !== undefined ? (
                <Link
                  to={`/forecast/${baseForecast.id}`}
                  className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
                >
                  Based on “{baseForecast.name}”
                </Link>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <GraphDrawer projection={projection} currency={forecast.currency} />
            {baseForecast !== undefined ? (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/compare?a=${baseForecast.id}&b=${forecast.id}`}>
                  <GitCompareArrowsIcon />
                  Compare with base
                </Link>
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void duplicateForecast(forecast.id)}
            >
              <CopyIcon />
              Duplicate
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive"
              aria-label={`Delete ${forecast.name}`}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2Icon />
            </Button>
          </div>
        </div>

        {/*
         * A forecast saved before the personal/business split has no kind, and
         * without one the category suggestions fall back to the full mixed list
         * — every household and business category at once. Asking once is
         * cheaper than guessing wrong and quieter than showing everything.
         */}
        {forecast.forecastKind === undefined ? (
          <Alert>
            <AlertIcon>
              <CircleHelpIcon />
            </AlertIcon>
            <AlertTitle>Which kind of forecast is this?</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-3">
              <span>
                Personal and business forecasts suggest different categories. Until this one
                knows which it is, it offers all of them. You can change this later under
                Assumptions.
              </span>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(KIND_LABELS) as Array<keyof typeof KIND_LABELS>).map((kind) => (
                  <Button
                    key={kind}
                    variant="outline"
                    size="sm"
                    onClick={() => update((current) => ({ ...current, forecastKind: kind }))}
                  >
                    {KIND_LABELS[kind]}
                  </Button>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        {lastError !== null ? (
          <Alert variant="destructive">
            <AlertIcon>
              <TriangleAlertIcon />
            </AlertIcon>
            <AlertDescription>{lastError}</AlertDescription>
          </Alert>
        ) : null}
      </header>

      <ErrorBoundary label="the summary figures">
        <KpiCards projection={projection} currency={forecast.currency} />
      </ErrorBoundary>

      <Tabs value={activeTab} onValueChange={setTab} className="flex flex-col gap-4">
        <div className="scrollbar-thin -mx-1 overflow-x-auto px-1 pb-0.5">
          <TabsList className="w-max">
            {visibleTabs.map((tab) => (
              <TabsTrigger key={tab} value={tab}>
                {TAB_LABELS[tab]}
                {tab === "scenarios" && scenarios.length > 0 ? (
                  <span className="bg-muted text-muted-foreground ml-1 rounded px-1 text-[10px]">
                    {scenarios.length}
                  </span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview">
          <ErrorBoundary label="the projection">
            <OverviewTab forecast={forecast} projection={projection} update={update} />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="savings">
          <ErrorBoundary label="the savings view">
            <SavingsTab
              forecast={forecast}
              projection={projection}
              onGoalChange={(goal) => update((current) => ({ ...current, goal }))}
              onAccountsChange={(accounts) =>
                update((current) => ({ ...current, accounts }))
              }
            />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="recurring">
          <ErrorBoundary label="recurring items">
            <RecurringTab forecast={forecast} projection={projection} update={update} />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="one-off">
          <ErrorBoundary label="one-off items">
            <OneOffTab forecast={forecast} projection={projection} update={update} />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="invoices">
          <ErrorBoundary label="invoices">
            <InvoicesTab forecast={forecast} projection={projection} update={update} />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="scenarios">
          <ErrorBoundary label="scenarios">
            <ScenariosTab forecast={forecast} scenarios={scenarios} />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="whatif">
          <ErrorBoundary label="the what-if table">
            <WhatIfTab forecast={forecast} />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="assumptions">
          <ErrorBoundary label="assumptions">
            <AssumptionsTab forecast={forecast} update={update} />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="data">
          <ErrorBoundary label="data tools">
            <DataTab forecast={forecast} projection={projection} />
          </ErrorBoundary>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${forecast.name}"?`}
        description="Removes the forecast from this browser. A copy is kept in the version history on the Data tab, so this can be undone."
        confirmLabel="Delete forecast"
        onConfirm={() => {
          void deleteForecast(forecast.id).then(() => {
            navigate("/");
          });
        }}
      />

      <ShortcutsHelp open={showShortcuts} onOpenChange={setShowShortcuts} />

      <PrintSummary forecast={forecast} projection={projection} />
    </AppShell>
  );
}
