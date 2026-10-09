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
import { createSampleForecast } from "@/lib/sample";
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

export function Home() {
  const { forecasts, loading } = useForecasts();
  const navigate = useNavigate();

  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<StoredForecast | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<StoredForecast | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const active = forecasts.filter((forecast) => forecast.archived !== true);
  const archived = forecasts.filter((forecast) => forecast.archived === true);
  const visible = showArchived ? archived : active;

  return (
    <AppShell
      actions={
        <Button size="sm" onClick={() => setCreating(true)}>
          <PlusIcon />
          New forecast
        </Button>
      }
    >
      <LandingHero onCreate={() => setCreating(true)} />

      <section aria-labelledby="forecasts-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="forecasts-heading" className="text-lg font-semibold tracking-tight">
            Your forecasts
          </h2>
          <div className="flex items-center gap-1">
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
            onCreate={() => setCreating(true)}
            onSample={() => {
              void saveForecast(createSampleForecast()).then((created) => {
                navigate(`/forecast/${created.id}`);
              });
            }}
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

      {creating ? (
        <ForecastForm
          onClose={() => setCreating(false)}
          onSubmit={(values: ForecastFormValues) => {
            void createForecast({
              name: values.name,
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
        description="This permanently removes the forecast from this browser. Export a backup first if you might want it back."
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

function LandingHero({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="flex flex-col gap-6 pt-2 sm:pt-6">
      <div className="flex max-w-2xl flex-col gap-3">
        <Badge variant="muted" className="w-fit">
          <SparklesIcon />
          Private by design — nothing leaves your browser
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Know when your cash runs out.
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed">
          Runway turns your income, expenses and expected invoices into a day-by-day cash-flow
          forecast — so you can see the shortfall coming, and test what happens when an assumption
          changes.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="lg" onClick={onCreate}>
            Create a forecast
            <ArrowRightIcon />
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="#forecasts-heading">See my forecasts</a>
          </Button>
        </div>
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
          {forecast.baseForecastId !== undefined ? <Badge variant="default">Scenario</Badge> : null}
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
  onCreate,
  onSample,
}: {
  archived: boolean;
  onCreate: () => void;
  onSample: () => void;
}) {
  if (archived) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-sm">
        No archived forecasts.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-4 rounded-xl border border-dashed p-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">No forecasts yet</p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Start from scratch, or load a sample freelance cash flow and change the numbers to match
          your own. A sample is a normal forecast — delete it whenever you like.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onCreate}>
          <PlusIcon />
          Create a forecast
        </Button>
        <Button size="sm" variant="outline" onClick={onSample}>
          <FileJsonIcon />
          Try the sample
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
