import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  CheckCircle2Icon,
  WalletIcon,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { AnimatedMoney } from "@/components/forecast/AnimatedMoney";
import { Card, CardContent } from "@/components/ui/card";
import { describeDays, formatIsoDate } from "@/lib/dates";
import { runwayDays } from "@/lib/forecast/engine";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Currency, Projection } from "@/types/forecast";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "neutral" | "positive" | "negative";
  icon?: ReactNode;
  /** Milliseconds to hold this card back, so a group arrives in sequence. */
  delayMs?: number;
}

export function KpiCard({ label, value, hint, tone = "neutral", icon, delayMs = 0 }: KpiCardProps) {
  return (
    <Card
      className="rise gap-0"
      style={{ "--rise-delay": `${delayMs}ms` } as CSSProperties}
    >
      <CardContent className="flex flex-col gap-1.5 pt-5">
        {/* The engraved label register: mono, small, letterspaced, uppercase. */}
        <div className="text-muted-foreground flex items-center gap-1.5 font-mono text-[0.6875rem] font-medium tracking-wide uppercase">
          {icon}
          {label}
        </div>
        {/*
         * Figures use the display face. Geist Mono is capped at label sizes in
         * this design language, so a large number belongs to Bodoni — which is
         * also the more editorial answer for a hero figure.
         */}
        <p
          className={cn(
            "font-display text-2xl leading-none break-all sm:text-3xl",
            tone === "positive" && "text-positive",
            tone === "negative" && "text-negative",
          )}
        >
          {value}
        </p>
        {hint !== undefined ? (
          <p className="text-muted-foreground text-xs leading-relaxed">{hint}</p>
        ) : null}
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
  // Null when cash never runs out; the hint below is the only place it is read.
  const runway = runwayDays(projection);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <KpiCard
        delayMs={0}
        label="Starting balance"
        value={<AnimatedMoney cents={summary.startingBalanceCents} currency={currency} />}
        hint={`From ${formatIsoDate(projection.startDate)}`}
        icon={<WalletIcon className="size-3.5" />}
      />
      <KpiCard
        delayMs={70}
        label="Projected ending balance"
        value={<AnimatedMoney cents={summary.endingBalanceCents} currency={currency} />}
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
        delayMs={140}
        label="Minimum balance"
        value={<AnimatedMoney cents={summary.minimumBalanceCents} currency={currency} />}
        tone={summary.minimumBalanceCents < 0 ? "negative" : "positive"}
        hint={`Lowest on ${formatIsoDate(summary.minimumBalanceDate)}`}
      />
      <KpiCard
        delayMs={210}
        label="Cash-out date"
        value={runsOut ? formatIsoDate(summary.cashOutDate ?? "") : "No projected shortfall"}
        tone={runsOut ? "negative" : "positive"}
        hint={
          runsOut
            ? `Runs out after ${describeDays(runway ?? 0)}; ${summary.shortfallDays} day${summary.shortfallDays === 1 ? "" : "s"} below zero in this horizon`
            : "Balance stays at or above zero for the whole horizon"
        }
        icon={runsOut ? <ArrowDownRightIcon className="size-3.5" /> : <CheckCircle2Icon className="size-3.5" />}
      />
      <KpiCard
        delayMs={280}
        label="Total inflows"
        value={<AnimatedMoney cents={summary.totalInflowCents} currency={currency} />}
        tone="positive"
        hint="Expected income across the horizon"
        icon={<ArrowUpRightIcon className="size-3.5" />}
      />
      <KpiCard
        delayMs={350}
        label="Total outflows"
        value={<AnimatedMoney cents={summary.totalOutflowCents} currency={currency} />}
        tone="negative"
        hint={`Net change ${formatCents(netCents, currency, { signed: true })}`}
        icon={<ArrowDownRightIcon className="size-3.5" />}
      />
    </div>
  );
}
