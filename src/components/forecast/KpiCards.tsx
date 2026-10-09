import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  CheckCircle2Icon,
  WalletIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { formatIsoDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Currency, Projection } from "@/types/forecast";

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "positive" | "negative";
  icon?: ReactNode;
}

export function KpiCard({ label, value, hint, tone = "neutral", icon }: KpiCardProps) {
  return (
    <Card className="gap-0">
      <CardContent className="flex flex-col gap-1 pt-5">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
          {icon}
          {label}
        </div>
        <p
          className={cn(
            "tnum text-lg font-semibold tracking-tight break-all sm:text-xl",
            tone === "positive" && "text-positive",
            tone === "negative" && "text-negative",
          )}
        >
          {value}
        </p>
        {hint !== undefined ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

/** The six headline numbers. Deliberately the first thing on the dashboard. */
export function KpiCards({
  projection,
  currency,
}: {
  projection: Projection;
  currency: Currency;
}) {
  const { summary } = projection;
  const netCents = summary.totalInflowCents - summary.totalOutflowCents;
  const runsOut = summary.cashOutDate !== null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <KpiCard
        label="Starting balance"
        value={formatCents(summary.startingBalanceCents, currency)}
        hint={`From ${formatIsoDate(projection.startDate)}`}
        icon={<WalletIcon className="size-3.5" />}
      />
      <KpiCard
        label="Projected ending balance"
        value={formatCents(summary.endingBalanceCents, currency)}
        tone={summary.endingBalanceCents < 0 ? "negative" : "positive"}
        hint={`On ${formatIsoDate(summary.endingDate)}`}
        icon={
          summary.endingBalanceCents < 0 ? (
            <ArrowDownRightIcon className="size-3.5" />
          ) : (
            <ArrowUpRightIcon className="size-3.5" />
          )
        }
      />
      <KpiCard
        label="Minimum balance"
        value={formatCents(summary.minimumBalanceCents, currency)}
        tone={summary.minimumBalanceCents < 0 ? "negative" : "positive"}
        hint={`Lowest on ${formatIsoDate(summary.minimumBalanceDate)}`}
      />
      <KpiCard
        label="Cash-out date"
        value={runsOut ? formatIsoDate(summary.cashOutDate ?? "") : "No projected shortfall"}
        tone={runsOut ? "negative" : "positive"}
        hint={
          runsOut
            ? `${summary.shortfallDays} day${summary.shortfallDays === 1 ? "" : "s"} below zero in this horizon`
            : "Balance stays at or above zero for the whole horizon"
        }
        icon={runsOut ? <ArrowDownRightIcon className="size-3.5" /> : <CheckCircle2Icon className="size-3.5" />}
      />
      <KpiCard
        label="Total inflows"
        value={formatCents(summary.totalInflowCents, currency)}
        tone="positive"
        hint="Expected income across the horizon"
        icon={<ArrowUpRightIcon className="size-3.5" />}
      />
      <KpiCard
        label="Total outflows"
        value={formatCents(summary.totalOutflowCents, currency)}
        tone="negative"
        hint={`Net change ${formatCents(netCents, currency, { signed: true })}`}
        icon={<ArrowDownRightIcon className="size-3.5" />}
      />
    </div>
  );
}
