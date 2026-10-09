import { PencilIcon } from "lucide-react";
import { useState } from "react";

import { ForecastForm, type ForecastFormValues } from "@/components/forms/ForecastForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatIsoDate, HORIZON_LABELS, horizonEndDate } from "@/lib/dates";
import { currencyName, formatCents } from "@/lib/money";
import type { Currency, Forecast } from "@/types/forecast";

interface AssumptionsTabProps {
  forecast: Forecast;
  update: (updater: (current: Forecast) => Forecast) => void;
}

/** The forecast's own setup, plus the derived facts a reader should know. */
export function AssumptionsTab({ forecast, update }: AssumptionsTabProps) {
  const [editing, setEditing] = useState(false);
  const endDate = horizonEndDate(forecast.startDate, forecast.horizon);

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
