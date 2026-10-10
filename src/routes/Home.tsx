import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowRightIcon,
  CalendarClockIcon,
  CopyIcon,
  FileJsonIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
  TrendingDownIcon,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ConfirmDialog } from "@/components/forms/ConfirmDialog";
import { ForecastForm, type ForecastFormValues } from "@/components/forms/ForecastForm";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/Field";
import { formatIsoDate, HORIZON_LABELS } from "@/lib/dates";
import { runProjection } from "@/lib/forecast/engine";
import { formatCents } from "@/lib/money";
import { createStarterForecast, KIND_DESCRIPTIONS, KIND_LABELS } from "@/lib/sample";
import {
  createForecast,
  deleteForecast,
  duplicateForecast,
  renameForecast,
  saveForecast,
  setArchived,
  useForecasts,
  type StoredForecast,
} from "@/lib/storage/forecasts";
import { cn } from "@/lib/utils";
import type { ForecastKind } from "@/types/forecast";

type KindFilter = "ALL" | ForecastKind;

const KIND_FILTERS: ReadonlyArray<{ value: KindFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "PERSONAL", label: "Personal" },
  { value: "BUSINESS", label: "Business" },
];

export function Home() {
  const { forecasts, loading } = useForecasts();
  const navigate = useNavigate();

  /** `null` when closed; otherwise the kind the form should pre-select. */
  const [creating, setCreating] = useState<ForecastKind | null>(null);
  const [renaming, setRenaming] = useState<StoredForecast | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<StoredForecast | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [kindFilter, setKindFilter] = useState<KindFilter>("ALL");

  const archived = forecasts.filter((forecast) => forecast.archived === true);
  const active = forecasts.filter((forecast) => forecast.archived !== true);
  const inView = showArchived ? archived : active;
  const visible =
    kindFilter === "ALL" ? inView : inView.filter((forecast) => forecast.forecastKind === kindFilter);

  const startFromStarter = (kind: ForecastKind): void => {
    void saveForecast(createStarterForecast(kind)).then((created) => {
      navigate(`/forecast/${created.id}`);
    });
  };

  return (
    <AppShell
      actions={
        <Button size="sm" onClick={() => setCreating("PERSONAL")}>
          <PlusIcon />
          New forecast
        </Button>
      }
    >
      <LandingHero onCreate={(kind) => setCreating(kind)} onStarter={startFromStarter} />

      <section aria-labelledby="forecasts-heading" className="seam flex flex-col gap-4 pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="forecasts-heading" className="font-display text-2xl tracking-tight">
            Your forecasts
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {!showArchived && active.length > 0 ? (
              <div
                className="bg-muted inline-flex items-center gap-0.5 rounded-lg p-0.5"
                role="group"
                aria-label="Filter forecasts by kind"
              >
                {KIND_FILTERS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={kindFilter === option.value}
                    onClick={() => setKindFilter(option.value)}
                    className={cn(
                      "focus-visible:ring-ring rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                      kindFilter === option.value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
            {archived.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setShowArchived((value) => !value)}>
                <ArchiveIcon />
                {showArchived ? "Show active" : `Archived (${archived.length})`}
              </Button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <LoadingList />
        ) : visible.length === 0 ? (
          <EmptyForecasts
            archived={showArchived}
            filtered={kindFilter !== "ALL" && inView.length > 0}
            onCreate={() => setCreating("PERSONAL")}
            onStarter={startFromStarter}
          />
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {visible.map((forecast) => (
              <ForecastCard
                key={forecast.id}
                forecast={forecast}
                onRename={() => {
                  setRenaming(forecast);
                  setRenameValue(forecast.name);
                  setRenameError(undefined);
                }}
                onDelete={() => setPendingDelete(forecast)}
              />
            ))}
          </ul>
        )}
      </section>

      {creating !== null ? (
        <ForecastForm
          initialKind={creating}
          onClose={() => setCreating(null)}
          onSubmit={(values: ForecastFormValues) => {
            void createForecast({
              name: values.name,
              forecastKind: values.forecastKind,
              currency: values.currency,
              startingBalanceCents: values.startingBalanceCents,
              startDate: values.startDate,
              horizon: values.horizon,
              notes: values.notes,
            }).then((created) => {
              navigate(`/forecast/${created.id}`);
            });
          }}
        />
      ) : null}

      {renaming !== null ? (
        <Dialog open onOpenChange={(next) => (next ? undefined : setRenaming(null))}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Rename forecast</DialogTitle>
              <DialogDescription>Only the label changes — the numbers stay as they are.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <Field label="Name" htmlFor="rename-input" error={renameError} required>
                <Input
                  value={renameValue}
                  autoFocus
                  onChange={(event) => setRenameValue(event.target.value)}
                />
              </Field>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRenaming(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const trimmed = renameValue.trim();
                    if (trimmed === "") {
                      setRenameError("Give the forecast a name");
                      return;
                    }
                    void renameForecast(renaming.id, trimmed);
                    setRenaming(null);
                  }}
                >
                  Save name
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => (open ? undefined : setPendingDelete(null))}
        title={`Delete "${pendingDelete?.name ?? ""}"?`}
        description="Removes the forecast from this browser. A copy is kept in the version history on the Data page, so this can be undone."
        confirmLabel="Delete forecast"
        onConfirm={() => {
          const target = pendingDelete;
          if (target === null) return;
          void deleteForecast(target.id);
          setPendingDelete(null);
        }}
      />
    </AppShell>
  );
}

function LandingHero({
  onCreate,
  onStarter,
}: {
  onCreate: (kind: ForecastKind) => void;
  onStarter: (kind: ForecastKind) => void;
}) {
  return (
    <section className="relative flex flex-col gap-6 pt-2 sm:pt-6">
      {/*
       * Hero backdrop. A faint dot grid with an accent bloom, both faded out at
       * the edges and pushed behind the content, so the headline sits on a lit
       * surface rather than on flat background.
       */}
      <div
        aria-hidden="true"
        className="dot-grid pointer-events-none absolute inset-x-[-2rem] -top-10 -z-10 h-[24rem] opacity-70 [mask-image:radial-gradient(62%_58%_at_28%_0%,black,transparent)]"
      />
      <div
        aria-hidden="true"
        className="glow-accent pointer-events-none absolute -top-28 -left-10 -z-10 h-72 w-[34rem]"
      />

      <div className="rise-stagger flex max-w-2xl flex-col gap-3">
        <Badge variant="muted" className="w-fit">
          <SparklesIcon />
          Private by design — nothing leaves your browser
        </Badge>
        <h1 className="font-display text-4xl leading-[1.05] tracking-tight text-balance sm:text-6xl">
          Know when your{" "}
          <span className="gradient-pan bg-clip-text text-transparent">cash runs out</span>.
        </h1>
        <p className="text-muted-foreground max-w-[68ch] text-base leading-relaxed sm:text-lg">
          Runway turns your income, expenses and expected invoices into a day-by-day cash-flow
          forecast — so you can see the shortfall coming, and test what happens when an assumption
          changes.
        </p>
      </div>

      {/* Two entry points, because a household and a business are not the same forecast. */}
      <div className="rise-stagger grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
        <KindStartCard
          kind="PERSONAL"
          onCreate={onCreate}
          onStarter={onStarter}
        />
        <KindStartCard
          kind="BUSINESS"
          onCreate={onCreate}
          onStarter={onStarter}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FeatureCard
          icon={<CalendarClockIcon className="size-4" />}
          title="Recurring cash flow"
          description="Rent, retainers, subscriptions and tax provisions repeat on their own schedule, month-end handled correctly."
        />
        <FeatureCard
          icon={<TrendingDownIcon className="size-4" />}
          title="Invoice delays"
          description="Project each invoice on its expected payment date plus your delay allowance — late payers show up as a real gap."
        />
        <FeatureCard
          icon={<SparklesIcon className="size-4" />}
          title="Scenario planning"
          description="“What if my biggest client pays 30 days late?” Duplicate, change one thing, and compare both outcomes."
        />
      </div>

      <div className="bg-muted/50 flex flex-col gap-3 rounded-xl border p-5">
        <h2 className="text-sm font-semibold">How it works</h2>
        <ol className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <Step number={1} title="Set your starting point">
            Starting balance, start date and a horizon of 13 weeks, 6 or 12 months.
          </Step>
          <Step number={2} title="Add what moves">
            Recurring items, one-off items and invoices with their payment delays.
          </Step>
          <Step number={3} title="Read the projection">
            Balance chart, cash-out date, weekly table — then test a scenario.
          </Step>
        </ol>
      </div>
    </section>
  );
}

/** The two creation paths: a blank forecast, or one pre-filled with starter items. */
function KindStartCard({
  kind,
  onCreate,
  onStarter,
}: {
  kind: ForecastKind;
  onCreate: (kind: ForecastKind) => void;
  onStarter: (kind: ForecastKind) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl leading-tight tracking-tight">
          {KIND_LABELS[kind]} forecast
        </h2>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {KIND_DESCRIPTIONS[kind]}
        </p>
      </div>
      <div className="mt-auto flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onCreate(kind)}>
          Start from scratch
          <ArrowRightIcon />
        </Button>
        <Button size="sm" variant="outline" onClick={() => onStarter(kind)}>
          <FileJsonIcon />
          Use {KIND_LABELS[kind].toLowerCase()} starter
        </Button>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border p-4">
      <span className="text-primary">{icon}</span>
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        className="bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
        aria-hidden="true"
      >
        {number}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground text-xs leading-relaxed">{children}</span>
      </span>
    </li>
  );
}

function ForecastCard({
  forecast,
  onRename,
  onDelete,
}: {
  forecast: StoredForecast;
  onRename: () => void;
  onDelete: () => void;
}) {
  const projection = runProjection(forecast);
  const { summary } = projection;
  const runsOut = summary.cashOutDate !== null;

  return (
    <li>
      <Card className="h-full gap-0">
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">
              <Link to={`/forecast/${forecast.id}`} className="hover:underline">
                {forecast.name}
              </Link>
            </CardTitle>
            <CardDescription>
              {forecast.currency} · {HORIZON_LABELS[forecast.horizon]} from{" "}
              {formatIsoDate(forecast.startDate)}
            </CardDescription>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {forecast.forecastKind !== undefined ? (
              <Badge variant="muted">{KIND_LABELS[forecast.forecastKind]}</Badge>
            ) : null}
            {forecast.baseForecastId !== undefined ? <Badge variant="default">Scenario</Badge> : null}
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-3 pt-3">
          <dl className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground text-xs">Ending balance</dt>
              <dd
                className={cn(
                  "tnum text-sm font-medium",
                  summary.endingBalanceCents < 0 ? "text-negative" : "text-positive",
                )}
              >
                {formatCents(summary.endingBalanceCents, forecast.currency)}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground text-xs">Cash-out</dt>
              <dd
                className={cn(
                  "text-sm font-medium",
                  runsOut ? "text-negative" : "text-positive",
                )}
              >
                {runsOut ? formatIsoDate(summary.cashOutDate ?? "") : "No shortfall"}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap items-center gap-1 border-t pt-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/forecast/${forecast.id}`}>
                Open
                <ArrowRightIcon />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Rename ${forecast.name}`}
              onClick={onRename}
            >
              <PencilIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Duplicate ${forecast.name}`}
              onClick={() => void duplicateForecast(forecast.id)}
            >
              <CopyIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`${forecast.archived === true ? "Restore" : "Archive"} ${forecast.name}`}
              onClick={() => void setArchived(forecast.id, forecast.archived !== true)}
            >
              {forecast.archived === true ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive"
              aria-label={`Delete ${forecast.name}`}
              onClick={onDelete}
            >
              <Trash2Icon />
            </Button>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

function EmptyForecasts({
  archived,
  filtered,
  onCreate,
  onStarter,
}: {
  archived: boolean;
  /** True when forecasts exist but the active kind filter hid them all. */
  filtered: boolean;
  onCreate: () => void;
  onStarter: (kind: ForecastKind) => void;
}) {
  if (archived) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-sm">
        No archived forecasts.
      </p>
    );
  }

  if (filtered) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-sm">
        No forecasts of that kind. Switch the filter back to “All”, or create one below.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-4 rounded-xl border border-dashed p-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">No forecasts yet</p>
        <p className="text-muted-foreground max-w-prose text-xs leading-relaxed">
          Start with a blank personal or business forecast, or load a starter with typical items to
          edit. Starter amounts are placeholders, and a starter is an ordinary forecast — delete it
          whenever you like.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onCreate}>
          <PlusIcon />
          Blank forecast
        </Button>
        <Button size="sm" variant="outline" onClick={() => onStarter("PERSONAL")}>
          <FileJsonIcon />
          Personal starter
        </Button>
        <Button size="sm" variant="outline" onClick={() => onStarter("BUSINESS")}>
          <FileJsonIcon />
          Business starter
        </Button>
      </div>
    </div>
  );
}

function LoadingList() {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-hidden="true">
      {[0, 1].map((index) => (
        <li key={index}>
          <div className="bg-muted/40 h-44 animate-pulse rounded-xl border" />
        </li>
      ))}
      <li className="sr-only" role="status">
        Loading your forecasts…
      </li>
    </ul>
  );
}
