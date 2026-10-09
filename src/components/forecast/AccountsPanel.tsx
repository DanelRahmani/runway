import { CoinsIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { AnimatedMoney } from "@/components/forecast/AnimatedMoney";
import { Field } from "@/components/forms/Field";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { accountKindLabel, SPENDING_ACCOUNT_ID, type AccountProjection } from "@/lib/forecast/accounts";
import { formatCents } from "@/lib/money";
import { createId } from "@/lib/utils";
import type { Account, AccountKind, Currency, Forecast } from "@/types/forecast";

const KINDS: readonly AccountKind[] = ["SAVINGS", "INVESTMENT", "DEBT", "CASH"];

/** Basis points per percent, for the rate field. */
const BPS_PER_PERCENT = 100;

interface AccountsPanelProps {
  forecast: Forecast;
  balances: AccountProjection;
  currency: Currency;
  onAccountsChange: (accounts: Account[]) => void;
}

/**
 * Where the money sits, and what it is doing.
 *
 * The point of this card is the gap between the two totals: spendable cash is what
 * decides whether you run out, and everything together is what you are actually
 * worth. Collapsing them into one number hides exactly the problem this app exists
 * to find.
 */
export function AccountsPanel({
  forecast,
  balances,
  currency,
  onAccountsChange,
}: AccountsPanelProps) {
  const accounts = useMemo(() => forecast.accounts ?? [], [forecast.accounts]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("SAVINGS");
  const [startingCents, setStartingCents] = useState(0);
  const [ratePercent, setRatePercent] = useState("0");

  const spending = balances.accounts.find((entry) => entry.account.id === SPENDING_ACCOUNT_ID);
  const pots = balances.accounts.filter((entry) => entry.account.id !== SPENDING_ACCOUNT_ID);

  const parsedRate = Number(ratePercent.replace(",", "."));
  const rateValid = Number.isFinite(parsedRate) && parsedRate >= -20 && parsedRate <= 20;
  const canSave = name.trim() !== "" && rateValid;

  const save = (): void => {
    const rateBps = Math.round(parsedRate * BPS_PER_PERCENT);
    const account: Account = {
      id: createId(),
      name: name.trim(),
      kind,
      startingBalanceCents: startingCents,
      ...(rateBps === 0 ? {} : { annualRateBps: rateBps }),
    };
    onAccountsChange([...accounts, account]);
    setName("");
    setKind("SAVINGS");
    setStartingCents(0);
    setRatePercent("0");
    setAdding(false);
  };

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2">
            <CoinsIcon className="size-3.5" />
            Where the money sits
          </CardTitle>
          <CardDescription>
            Cash decides whether you run out. Everything together decides what you are worth. They
            are different questions, so they are reported apart.
          </CardDescription>
        </div>
        {!adding ? (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <PlusIcon />
            Add account
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Figure label="Spendable">
            <AnimatedMoney cents={balances.spendableClosingCents} currency={currency} />
          </Figure>
          <Figure label="In accounts">
            <AnimatedMoney
              cents={balances.totalClosingCents - balances.spendableClosingCents}
              currency={currency}
            />
          </Figure>
          <Figure label="Everything">
            <AnimatedMoney cents={balances.totalClosingCents} currency={currency} />
          </Figure>
        </dl>

        <ul className="flex flex-col gap-2">
          <AccountRow
            name="Spending"
            kind="CASH"
            closingCents={spending?.closingCents ?? 0}
            growthCents={0}
            currency={currency}
            derived
          />
          {pots.map((entry) => (
            <AccountRow
              key={entry.account.id}
              name={entry.account.name}
              kind={entry.account.kind}
              closingCents={entry.closingCents}
              growthCents={entry.growthCents}
              currency={currency}
              onRemove={() =>
                onAccountsChange(accounts.filter((account) => account.id !== entry.account.id))
              }
            />
          ))}
          {pots.length === 0 && !adding ? (
            <li className="text-muted-foreground rounded-lg border border-dashed p-4 text-xs leading-relaxed">
              No accounts yet, so everything you keep simply leaves the spending balance. Add a
              savings or investment account and transfers into it become two-sided: your spending
              money drops, your wealth does not.
            </li>
          ) : null}
        </ul>

        {adding ? (
          <form
            className="flex flex-col gap-3 rounded-lg border p-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (canSave) save();
            }}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Name" htmlFor="account-name" required>
                <Input
                  id="account-name"
                  value={name}
                  placeholder="e.g. Holiday fund"
                  autoComplete="off"
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
              <Field label="Type" htmlFor="account-kind" required>
                <select
                  id="account-kind"
                  value={kind}
                  onChange={(event) => setKind(event.target.value as AccountKind)}
                  className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                >
                  {KINDS.map((option) => (
                    <option key={option} value={option}>
                      {accountKindLabel(option)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Starting balance" htmlFor="account-start" hint="What is in it today.">
                <MoneyInput
                  valueCents={startingCents}
                  onValueChange={setStartingCents}
                  currency={currency}
                />
              </Field>
              <Field
                label="Annual rate"
                htmlFor="account-rate"
                error={rateValid ? undefined : "Use a rate between -20% and 20%"}
                hint="Percent a year. Leave at 0 for none."
              >
                <Input
                  id="account-rate"
                  value={ratePercent}
                  inputMode="decimal"
                  autoComplete="off"
                  onChange={(event) => setRatePercent(event.target.value)}
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={!canSave}>
                Add account
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}

        {balances.hasGrowth ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            Growth is a smooth average, compounded monthly. Real returns vary year to year, and a bad
            early year hurts more than the average suggests — treat these figures as a shape, not a
            promise.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AccountRow({
  name,
  kind,
  closingCents,
  growthCents,
  currency,
  derived = false,
  onRemove,
}: {
  name: string;
  kind: AccountKind;
  closingCents: number;
  growthCents: number;
  currency: Currency;
  /** The spending account is derived from the forecast and cannot be removed. */
  derived?: boolean;
  onRemove?: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-medium">{name}</span>
        <span className="text-muted-foreground font-mono text-[0.625rem] tracking-wide uppercase">
          {accountKindLabel(kind)}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-3">
        {growthCents !== 0 ? (
          <span
            className={growthCents > 0 ? "text-positive tnum text-xs" : "text-negative tnum text-xs"}
            title="Growth over the horizon"
          >
            {formatCents(growthCents, currency, { signed: true })}
          </span>
        ) : null}
        <span className="tnum text-sm font-medium">{formatCents(closingCents, currency)}</span>
        {!derived && onRemove !== undefined ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Remove ${name}`}
            onClick={onRemove}
          >
            <Trash2Icon className="size-3.5" />
          </Button>
        ) : null}
      </span>
    </li>
  );
}

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
