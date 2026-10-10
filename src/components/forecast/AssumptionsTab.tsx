import { PencilIcon } from "lucide-react";
import { useState } from "react";

import { ForecastForm, type ForecastFormValues } from "@/components/forms/ForecastForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MONTH_LABELS, formatIsoDate, HORIZON_LABELS, horizonEndDate } from "@/lib/dates";
import { currencyName, formatCents } from "@/lib/money";
import { KIND_LABELS } from "@/lib/sample";
import { NEUTRAL_SEASONAL_COST_PERCENT } from "@/lib/validation";
import type { Currency, Forecast } from "@/types/forecast";

interface AssumptionsTabProps {
  forecast: Forecast;
  update: (updater: (current: Forecast) => Forecast) => void;
}

/** A whole percentage that could stand for a month's running-cost multiplier. */
function isSeasonPercent(raw: string): boolean {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value <= 1_000;
}

/** The forecast's own setup, plus the derived facts a reader should know. */
export function AssumptionsTab({ forecast, update }: AssumptionsTabProps) {
  const [editing, setEditing] = useState(false);
  /*
   * The seasonality grid is edited as text so a half-typed number never becomes a
   * half-applied one: "1" on the way to "150" is a valid percentage, so committing
   * on every keystroke would briefly say January costs 1% of normal.
   */
  const [seasonDraft, setSeasonDraft] = useState<string[]>(() =>
    (forecast.seasonalCostPercent ?? NEUTRAL_SEASONAL_COST_PERCENT).map(String),
  );
  const seasonValid = seasonDraft.every(isSeasonPercent);
  const endDate = horizonEndDate(forecast.startDate, forecast.horizon);

  const setMonthPercent = (index: number, raw: string): void => {
    const next = [...seasonDraft];
    next[index] = raw;
    setSeasonDraft(next);

    // Left uncommitted while any month is not a whole percentage.
    if (!next.every(isSeasonPercent)) return;
    update((current) => ({
      ...current,
      seasonalCostPercent: next.map((value) => Number(value)),
    }));
  };

  const resetSeasonality = (): void => {
    setSeasonDraft(NEUTRAL_SEASONAL_COST_PERCENT.map(String));
    update((current) => ({
      ...current,
      seasonalCostPercent: NEUTRAL_SEASONAL_COST_PERCENT.slice(),
    }));
  };

  const activeRecurring = forecast.recurringItems.filter((item) => item.isActive);
  const inactiveRecurring = forecast.recurringItems.filter((item) => !item.isActive);
  const expectedInvoices = forecast.invoices.filter((invoice) => invoice.status === "EXPECTED");
  const delayedInvoices = expectedInvoices.filter((invoice) => invoice.paymentDelayDays > 0);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>Forecast assumptions</CardTitle>
            <CardDescription>
              The starting point every projection is built from. Changing anything here recalculates
              the whole forecast.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <PencilIcon />
            Edit
          </Button>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            <Row label="Name">{forecast.name}</Row>
            <Row label="Currency">
              {forecast.currency}{" "}
              <span className="text-muted-foreground">({currencyName(forecast.currency)})</span>
            </Row>
            <Row label="Starting balance">
              <span className="tnum font-medium">
                {formatCents(forecast.startingBalanceCents, forecast.currency)}
              </span>
            </Row>
            <Row label="Start date">{formatIsoDate(forecast.startDate)}</Row>
            <Row label="Horizon">
              {HORIZON_LABELS[forecast.horizon]}{" "}
              <span className="text-muted-foreground">to {formatIsoDate(endDate)}</span>
            </Row>
            <Row label="Kind">
              {forecast.forecastKind === undefined ? (
                <span className="text-muted-foreground">Not specified</span>
              ) : (
                <Badge variant="muted">{KIND_LABELS[forecast.forecastKind]}</Badge>
              )}
            </Row>
            <Row label="Type">
              {forecast.baseForecastId === undefined ? (
                <Badge variant="muted">Base forecast</Badge>
              ) : (
                <Badge variant="default">Scenario</Badge>
              )}
            </Row>
          </dl>

          {forecast.notes !== undefined && forecast.notes.trim() !== "" ? (
            <div className="mt-4 flex flex-col gap-1 border-t pt-4">
              <dt className="text-muted-foreground text-xs font-medium">Notes</dt>
              <dd className="text-sm whitespace-pre-wrap">{forecast.notes}</dd>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When money moves</CardTitle>
          <CardDescription>
            Two assumptions that change the shape of the curve without changing the plan.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4 rounded-md border px-3 py-2.5">
            <Label htmlFor="weekend-shifting" className="flex-col items-start gap-0.5">
              <span className="text-xs font-medium">Nothing moves at the weekend</span>
              <span className="text-muted-foreground text-xs font-normal">
                Anything dated Saturday or Sunday is treated as happening on the Monday. Recurring
                items and expected invoices shift; a one-off keeps the exact date you gave it.
              </span>
            </Label>
            <Switch
              id="weekend-shifting"
              checked={forecast.weekendShifting === true}
              onCheckedChange={(checked) =>
                update((current) => ({ ...current, weekendShifting: checked }))
              }
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium">Seasonal running costs</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                100 is a normal month, so 150 makes that month's running costs half as expensive
                again. Transfers, tax, income and one-off items are never scaled. Every month at 100
                means nothing changes.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {MONTH_LABELS.map((month, index) => (
                <label key={month} className="flex flex-col gap-1">
                  <span className="text-muted-foreground font-mono text-[0.625rem] tracking-wide uppercase">
                    {month}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={1_000}
                    step={5}
                    inputMode="numeric"
                    value={seasonDraft[index] ?? "100"}
                    onChange={(event) => setMonthPercent(index, event.target.value)}
                    className="h-8 px-2 text-center text-xs"
                    aria-label={`${month} running cost percentage`}
                  />
                </label>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" size="sm" onClick={resetSeasonality}>
                Reset to normal
              </Button>
              {seasonValid ? null : (
                <span className="text-muted-foreground text-xs">
                  Whole percentages only — nothing is applied until all twelve are numbers.
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How this forecast is calculated</CardTitle>
          <CardDescription>Plain-language summary of what the projection assumes.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex list-disc flex-col gap-2 pl-4 text-sm">
            <li>
              {activeRecurring.length} active recurring item{activeRecurring.length === 1 ? "" : "s"}
              {inactiveRecurring.length > 0
                ? `, with ${inactiveRecurring.length} switched off`
                : ""}
              . Monthly entries keep their calendar day; when a month is too short, the last day of
              that month is used.
            </li>
            <li>
              {forecast.oneOffItems.length} one-off item
              {forecast.oneOffItems.length === 1 ? "" : "s"} placed on their exact date. Entries
              outside {formatIsoDate(forecast.startDate)} – {formatIsoDate(endDate)} do not affect the
              projection.
            </li>
            <li>
              {expectedInvoices.length} expected invoice
              {expectedInvoices.length === 1 ? "" : "s"}, of which {delayedInvoices.length} carry a
              payment-delay allowance. Each is counted on{" "}
              <span className="font-medium">expected payment date + delay</span>, never the issue
              date.
            </li>
            <li>
              Invoices marked paid are treated as already included in the starting balance, and
              cancelled invoices are ignored.
            </li>
            <li>
              Amounts are held as integer {forecast.currency} minor units, so balances never drift by
              a cent through rounding.
            </li>
          </ul>
        </CardContent>
      </Card>

      {editing ? (
        <ForecastForm
          forecast={forecast}
          onClose={() => setEditing(false)}
          onSubmit={(values: ForecastFormValues) => {
            update((current) => ({
              ...current,
              name: values.name.trim(),
              forecastKind: values.forecastKind,
              currency: values.currency as Currency,
              startingBalanceCents: values.startingBalanceCents,
              startDate: values.startDate,
              horizon: values.horizon,
              ...(values.notes.trim() === "" ? { notes: undefined } : { notes: values.notes }),
            }));
          }}
        />
      ) : null}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
