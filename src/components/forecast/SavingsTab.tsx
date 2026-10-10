import { PiggyBankIcon, TargetIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { DonutChart } from "@/components/charts/DonutChart";
import { GoalProgressChart } from "@/components/charts/GoalProgressChart";
import { StackedCompositionChart } from "@/components/charts/StackedCompositionChart";
import { AccountsPanel } from "@/components/forecast/AccountsPanel";
import { AnimatedMoney } from "@/components/forecast/AnimatedMoney";
import { GranularityToggle } from "@/components/forecast/GranularityToggle";
import { Field } from "@/components/forms/Field";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatIsoDate } from "@/lib/dates";
import { accountProjection } from "@/lib/forecast/accounts";
import { emergencyFund, compositionSeries, goalProgress, keptCurve, savingsSummary } from "@/lib/forecast/savings";
import { GOAL_PLAN_MAX_YEARS, planGoalSaving } from "@/lib/forecast/solvers";
import { formatCents } from "@/lib/money";
import { cn, formatPercent } from "@/lib/utils";
import type {
  Account,
  Currency,
  Forecast,
  ForecastGoal,
  Granularity,
  Projection,
} from "@/types/forecast";

interface SavingsTabProps {
  forecast: Forecast;
  projection: Projection;
  onGoalChange: (goal: ForecastGoal | undefined) => void;
  onAccountsChange: (accounts: Account[]) => void;
}

/**
 * Savings and investments, kept apart from the spending story.
 *
 * Everything here is a **flow over the horizon**, never a balance. Runway does
 * not yet know what was already in savings, because there are no accounts, so the
 * copy is careful to say what moved rather than what is held.
 */
export function SavingsTab({
  forecast,
  projection,
  onGoalChange,
  onAccountsChange,
}: SavingsTabProps) {
  const currency = forecast.currency;
  const summary = useMemo(() => savingsSummary(projection), [projection]);
  const balances = useMemo(() => accountProjection(forecast, projection), [forecast, projection]);

  /*
   * Cover is measured against what is actually spendable — the same figure the
   * accounts panel leads with — rather than against total wealth, because a
   * pension pot does not buy groceries this month.
   */
  const fund = useMemo(
    () => emergencyFund(projection, balances.spendableClosingCents),
    [projection, balances.spendableClosingCents],
  );
  // Monthly by default: the mix moves on a monthly rhythm, and weekly columns
  // make it hard to see that rhythm through the noise.
  const [compositionStep, setCompositionStep] = useState<Granularity>("monthly");

  const keptSlices = summary.keptByCategory.map((total) => ({
    key: `${total.direction}-${total.category}`,
    label: total.category,
    cents: total.totalCents,
  }));

  const outflowSlices = [
    { key: "spending", label: "Spending", cents: summary.spendingCents },
    { key: "kept", label: "Kept", cents: summary.keptCents },
    { key: "tax", label: "Tax", cents: summary.taxCents },
  ].filter((slice) => slice.cents > 0);

  const hasKept = summary.keptCents > 0;

  return (
    <div className="flex flex-col gap-4">
      <AccountsPanel
        forecast={forecast}
        balances={balances}
        currency={currency}
        onAccountsChange={onAccountsChange}
      />

      <Card className={cn(hasKept && "border-positive/30")}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PiggyBankIcon className="size-3.5" />
            Set aside over the horizon
          </CardTitle>
          <CardDescription>
            {hasKept
              ? `Money that left your current account but stayed yours — ${formatCents(summary.keptCents, currency)} across ${summary.keptByCategory.length} categor${summary.keptByCategory.length === 1 ? "y" : "ies"}.`
              : "Nothing is being set aside in this horizon yet."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <Figure label="Total kept">
              <AnimatedMoney cents={summary.keptCents} currency={currency} />
            </Figure>
            <Figure label="Savings rate">
              {summary.savingsRate === null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                formatPercent(summary.savingsRate)
              )}
            </Figure>
            <Figure label="Average per month">
              <AnimatedMoney cents={summary.monthlyKeptCents} currency={currency} />
            </Figure>
          </dl>

          <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
            {fund.coveredMonths === null
              ? "There is no essential spending in this horizon, so there is nothing to measure cover against."
              : fund.coveredMonths >= 24
                ? `Your spendable cash would cover over two years of essentials, which run at ${formatCents(fund.essentialMonthlyCents, currency)} a month.`
                : `Your spendable cash would cover about ${fund.coveredMonths.toFixed(1)} months of essentials, which run at ${formatCents(fund.essentialMonthlyCents, currency)} a month.`}
          </p>
        </CardContent>
      </Card>

      <GoalCard
        forecast={forecast}
        projection={projection}
        currency={currency}
        goal={forecast.goal}
        onGoalChange={onGoalChange}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>What you kept</CardTitle>
            <CardDescription>
              {hasKept
                ? "Savings, investments, pension and debt principal — money moved, not money spent."
                : "Tag an item as Savings, Investing, Pension or Debt repayment and it appears here."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasKept ? (
              <DonutChart
                slices={keptSlices}
                currency={currency}
                height={168}
              />
            ) : (
              <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-xs leading-relaxed">
                A transfer reduces your cash without being spending. Paying yourself into savings,
                buying investments, funding a pension and repaying debt principal all work this way,
                which is why they are counted separately.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Where your outflow goes</CardTitle>
            <CardDescription>
              {summary.outflowCents > 0
                ? `${formatCents(summary.outflowCents, currency)} left your accounts in total. Tax is shown apart from spending: it is neither a choice nor money kept.`
                : "No outflows in this horizon."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {outflowSlices.length > 0 ? (
              <DonutChart
                slices={outflowSlices}
                currency={currency}
                height={168}
              />
            ) : (
              <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-xs leading-relaxed">
                Add expenses to see how your outflow splits between spending, tax and money kept.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>How the mix changes</CardTitle>
            <CardDescription>
              The same three parts as above, kept apart by period. A tax quarter and a quiet month
              look identical once added up, which is the one thing a donut cannot show.
            </CardDescription>
          </div>
          <GranularityToggle
            value={compositionStep}
            onChange={setCompositionStep}
            options={["weekly", "monthly"]}
          />
        </CardHeader>
        <CardContent>
          <StackedCompositionChart
            periods={compositionSeries(projection, compositionStep)}
            currency={currency}
            granularity={compositionStep}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What this does not include</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground flex flex-col gap-2 text-xs leading-relaxed">
          <p>
            These are totals <em>moved</em> across the horizon, not balances you hold. Runway does
            not yet know what was already in savings before the forecast starts, so it will not
            guess at your net worth.
          </p>
          <p>
            Interest, investment growth and debt interest are also not modelled. Every figure here is
            a contribution, not a return.
          </p>
          <p>
            {summary.savingsRate === null
              ? "The savings rate needs income in the same horizon to divide by, which this forecast does not have."
              : `The savings rate is what you set aside divided by the ${formatCents(summary.inflowCents, currency)} of income in this horizon.`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * A savings target, and whether the current plan reaches it.
 *
 * The verdict is deliberately cautious: when the target date sits beyond the
 * horizon the projection simply cannot know, and it says so rather than
 * optimistically reporting "on track".
 */
function GoalCard({
  forecast,
  projection,
  currency,
  goal,
  onGoalChange,
}: {
  forecast: Forecast;
  projection: Projection;
  currency: Currency;
  goal: ForecastGoal | undefined;
  onGoalChange: (goal: ForecastGoal | undefined) => void;
}) {
  const [editing, setEditing] = useState(goal === undefined);
  const [label, setLabel] = useState(goal?.label ?? "");
  const [targetCents, setTargetCents] = useState(goal?.targetCents ?? 0);
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? projection.endDate);

  // Accumulates across every day in the horizon, so it is not free to repeat.
  const progress = useMemo(
    () => (goal === undefined ? null : goalProgress(projection, goal)),
    [projection, goal],
  );

  // The same accumulation for the chart below; empty until a goal exists.
  const kept = useMemo(
    () => (goal === undefined ? [] : keptCurve(projection)),
    [projection, goal],
  );

  /*
   * What it would take to get there, which is the question the progress bar provokes.
   * The horizon does not limit this: a target years out is projected out to its own
   * date, up to the calculator's ceiling.
   */
  const plan = useMemo(
    () => (goal === undefined ? null : planGoalSaving(forecast, goal)),
    [forecast, goal],
  );
  const neededCents = plan?.requiredMonthlyCents ?? null;
  const beyondLimit = plan?.beyondLimit === true;
  const extended = plan?.extended === true;
  const windowEnd = plan?.windowEnd;

  const save = (): void => {
    onGoalChange({ label: label.trim(), targetCents, targetDate });
    setEditing(false);
  };

  const canSave = label.trim() !== "" && targetCents > 0 && targetDate !== "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TargetIcon className="size-3.5" />
          Goal
        </CardTitle>
        <CardDescription>
          {progress === null
            ? "Name a target and Runway will say whether the plan reaches it."
            : `${progress.goal.label} — ${formatCents(progress.targetCents, currency)} by ${formatIsoDate(progress.goal.targetDate)}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {editing ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (canSave) save();
            }}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="What for" htmlFor="goal-label">
                <Input
                  id="goal-label"
                  value={label}
                  placeholder="e.g. Japan"
                  autoComplete="off"
                  onChange={(event) => setLabel(event.target.value)}
                />
              </Field>
              <Field label="Target" htmlFor="goal-amount">
                <MoneyInput
                  valueCents={targetCents}
                  onValueChange={setTargetCents}
                  currency={currency}
                />
              </Field>
              <Field label="By when" htmlFor="goal-date">
                <Input
                  id="goal-date"
                  type="date"
                  value={targetDate}
                  onChange={(event) => setTargetDate(event.target.value)}
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={!canSave}>
                Save goal
              </Button>
              {goal !== undefined ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        ) : progress !== null ? (
          <>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-muted-foreground">
                  <AnimatedMoney cents={progress.keptCents} currency={currency} /> kept of{" "}
                  {formatCents(progress.targetCents, currency)}
                </span>
                <span className="tnum font-medium">{formatPercent(progress.fraction)}</span>
              </div>
              <div
                className="bg-muted h-2 w-full overflow-hidden rounded-full"
                role="img"
                aria-label={`${formatPercent(progress.fraction)} of the goal reached`}
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-300",
                    progress.onTrack ? "bg-positive" : "bg-accent",
                  )}
                  style={{ width: `${Math.max(1, progress.fraction * 100)}%` }}
                />
              </div>
            </div>

            <GoalProgressChart
              points={kept}
              targetCents={progress.targetCents}
              currency={currency}
            />

            <p
              className={cn(
                "text-xs leading-relaxed",
                progress.onTrack ? "text-positive" : "text-muted-foreground",
              )}
            >
              {goalVerdict(progress, currency)}
            </p>

            {beyondLimit ? (
              <p className="text-xs leading-relaxed">
                That target is more than {GOAL_PLAN_MAX_YEARS} years out, which is further than the
                calculator will project. Past that point, income and costs holding steady is an
                assumption rather than a plan — bring the date in, or treat the target as a
                direction rather than a deadline.
              </p>
            ) : neededCents !== null && neededCents > 0 ? (
              <div className="flex flex-col gap-1">
                <p className="text-xs leading-relaxed">
                  Setting aside{" "}
                  <span className="font-medium">{formatCents(neededCents, currency)}</span> a month
                  from now would reach it by {formatIsoDate(progress.goal.targetDate)}.
                </p>
                {extended && windowEnd !== undefined ? (
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    That date sits past this forecast&apos;s own horizon, so the calculation was
                    projected out to {formatIsoDate(windowEnd)} instead. It assumes today&apos;s
                    income and costs hold all the way there — planning arithmetic, not a forecast.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Change goal
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onGoalChange(undefined)}>
                Remove goal
              </Button>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Says only what the projection can actually support. */
function goalVerdict(progress: ReturnType<typeof goalProgress>, currency: Currency): string {
  if (progress.onTrack && progress.reachedDate !== null) {
    return `On track. The plan reaches this on ${formatIsoDate(progress.reachedDate)}.`;
  }

  if (progress.reachedDate !== null) {
    return `Reached on ${formatIsoDate(progress.reachedDate)} — after your target date, so it arrives late.`;
  }

  const short = formatCents(progress.shortfallCents, currency);

  if (progress.inconclusive) {
    // Deliberately not "cannot say" any more: the calculator below answers exactly
    // this question. What this projection cannot do is judge the plan as it stands,
    // because it stops before the target date.
    return `The target date sits past the end of this horizon, so the projection cannot judge the plan against it. You are ${short} short by the last projected day — the calculator below works out what it would take.`;
  }

  return `Not on track — ${short} short by ${formatIsoDate(progress.goal.targetDate)}. Lower the target, push the date, or set more aside.`;
}

/** The engraved label register the KPI cards use, sized for a card body. */
function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground font-mono text-[0.6875rem] font-medium tracking-wide uppercase">
        {label}
      </dt>
      <dd className="font-display tnum text-xl leading-tight">{children}</dd>
    </div>
  );
}
