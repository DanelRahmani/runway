import { LineChartIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { BalanceChart, ChartLegend } from "@/components/charts/BalanceChart";
import { AnimatedMoney } from "@/components/forecast/AnimatedMoney";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { formatIsoDate, formatIsoDateRange } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Currency, Projection } from "@/types/forecast";

interface GraphDrawerProps {
  projection: Projection;
  currency: Currency;
}

/**
 * The projection graph as a panel you can leave open while you work.
 *
 * Deliberately non-modal: the whole reason to have it is to move an assumption
 * and watch the curve answer back, so it must not block the tabs behind it. It
 * re-reads the same `projection` the rest of the page renders, which means it
 * cannot show stale figures.
 */
export function GraphDrawer({ projection, currency }: GraphDrawerProps) {
  const [open, setOpen] = useState(false);
  const { summary } = projection;

  const chartData = projection.days.map((day) => ({
    date: day.date,
    label: day.date,
    balanceCents: day.closingCents,
  }));

  const runsOut = summary.cashOutDate !== null;

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" size="sm">
          <LineChartIcon />
          Graph
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Projection graph</DrawerTitle>
          <DrawerDescription>
            {formatIsoDateRange(projection.startDate, projection.endDate)} · {projection.days.length}{" "}
            days. Stays open while you edit, so you can change an assumption and watch it move.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <dl className="mb-5 grid grid-cols-2 gap-x-4 gap-y-4">
            <Figure label="Ending balance">
              <AnimatedMoney cents={summary.endingBalanceCents} currency={currency} />
            </Figure>
            <Figure label="Lowest point">
              <AnimatedMoney cents={summary.minimumBalanceCents} currency={currency} />
            </Figure>
            <Figure
              label="Cash runs out"
              valueClassName={runsOut ? "text-negative" : "text-positive"}
            >
              {runsOut ? formatIsoDate(summary.cashOutDate ?? "") : "Not in this horizon"}
            </Figure>
            <Figure label="Net movement">
              <AnimatedMoney
                cents={summary.totalInflowCents - summary.totalOutflowCents}
                currency={currency}
              />
            </Figure>
          </dl>

          <BalanceChart
            data={chartData}
            currency={currency}
            minimumDate={summary.minimumBalanceDate}
            minimumCents={summary.minimumBalanceCents}
            height={260}
          />
          <ChartLegend minimumCents={summary.minimumBalanceCents} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** The same engraved-label register the KPI cards use, sized for the panel. */
function Figure({
  label,
  children,
  valueClassName,
}: {
  label: string;
  children: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground font-mono text-[0.6875rem] font-medium tracking-wide uppercase">
        {label}
      </dt>
      <dd className={cn("font-display tnum text-lg leading-tight", valueClassName)}>{children}</dd>
    </div>
  );
}
