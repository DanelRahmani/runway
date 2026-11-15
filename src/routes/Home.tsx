import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowRightIcon,
  CopyIcon,
  FileJsonIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
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
          <h2 id="forecasts-heading" className="font-display text-2xl">
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
    <section className="relative flex flex-col gap-10 pt-2 sm:pt-8">
      {/* The single faint radial tint the design system allows behind a hero. */}
      <div
        aria-hidden="true"
        className="hero-tint pointer-events-none absolute inset-x-0 -top-16 -z-10 h-[26rem]"
      />

      <div className="rise-stagger flex max-w-2xl flex-col gap-4">
        <p className="text-muted-foreground font-mono text-xs">
          Private by design. Nothing leaves your browser.
        </p>
        <h1 className="font-display text-[2.75rem] leading-[1.05] font-normal italic sm:text-7xl">
          Know when your cash runs out.
        </h1>
        <svg
          aria-hidden="true"
          className="stitch-underline text-accent -mt-1 h-1.5 w-56"
          viewBox="0 0 224 6"
        >
          <line
            x1="2"
            y1="3"
            x2="222"
            y2="3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="9 7"
          />
        </svg>
        <p className="text-muted-foreground max-w-[62ch] text-base leading-7 sm:text-lg sm:leading-8">
          Runway turns your income, expenses and expected invoices into a day-by-day cash-flow
          forecast, so you can see the shortfall coming and test what happens when an assumption
          changes.
        </p>
      </div>

      {/* Two entry points, because a household and a business are not the same forecast. */}
      <div className="rise-stagger grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
        <KindStartCard kind="PERSONAL" onCreate={onCreate} onStarter={onStarter} />
        <KindStartCard kind="BUSINESS" onCreate={onCreate} onStarter={onStarter} />
      </div>

      {/* Editorial rows rather than a grid of icon cards: text, separated by seams. */}
      <div className="seam grid grid-cols-1 gap-8 pt-8 sm:grid-cols-3">
        <FeatureCard
          title="Recurring cash flow"
          description="Rent, retainers, subscriptions and tax provisions repeat on their own schedule, month-end handled correctly."
        />
        <FeatureCard
          title="Invoice delays"
          description="Each invoice lands on its expected payment date plus your delay allowance, so late payers show up as a real gap."
        />
        <FeatureCard
          title="Scenario planning"
          description="What if your biggest client pays 30 days late? Duplicate, change one thing, and compare both outcomes."
        />
      </div>

      <div className="seam flex flex-col gap-4 pt-8">
        <h2 className="font-display text-2xl leading-tight">How it works</h2>
        <ol className="grid grid-cols-1 gap-6 text-sm sm:grid-cols-3">
          <Step number={1} title="Set your starting point">
            Starting balance, start date and a horizon of 13 weeks, 6 or 12 months.
          </Step>
          <Step number={2} title="Add what moves">
            Recurring items, one-off items and invoices with their payment delays.
          </Step>
          <Step number={3} title="Read the projection">
            Balance chart, cash-out date and a weekly table. Then test a scenario.
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
    <div className="bg-card shadow-rest lift flex flex-col gap-4 rounded-3xl border p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-2xl leading-tight">{KIND_LABELS[kind]} forecast</h2>
        <p className="text-muted-foreground text-sm leading-6">
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

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="font-display text-xl leading-tight">{title}</h3>
      <p className="text-muted-foreground text-sm leading-6">{description}</p>
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
    <li className="flex flex-col gap-1">
      {/* A woven label, not a filled disc. */}
      <span className="text-accent-text font-mono text-xs" aria-hidden="true">
        {String(number).padStart(2, "0")}
      </span>
      <span className="font-medium">{title}</span>
      <span className="text-muted-foreground leading-6">{children}</span>
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
      <p className="text-muted-foreground rounded-3xl border border-dashed border-seam p-6 text-sm">
        No archived forecasts.
      </p>
    );
  }

  if (filtered) {
    return (
      <p className="text-muted-foreground rounded-3xl border border-dashed border-seam p-6 text-sm">
        No forecasts of that kind. Switch the filter back to “All”, or create one below.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-4 rounded-3xl border border-dashed border-seam p-6">
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
          <div className="bg-muted/40 h-44 animate-pulse rounded-3xl border" />
        </li>
      ))}
      <li className="sr-only" role="status">
        Loading your forecasts…
      </li>
    </ul>
  );
}
