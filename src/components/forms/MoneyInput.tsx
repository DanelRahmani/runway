import { useState } from "react";

import { Input } from "@/components/ui/input";
import { centsToDecimalString, parseDecimalToCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Currency } from "@/types/forecast";

interface MoneyInputProps {
  id?: string;
  valueCents: number;
  onValueChange: (cents: number) => void;
  currency: Currency;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

/**
 * Amount field that accepts typed decimals and reports integer cents.
 *
 * The display text is derived rather than synchronised: a draft is kept only
 * while it still describes the incoming `valueCents`, and is dropped the moment
 * that value changes from outside (a scenario swap, a reset, a currency switch).
 * That removes the need for an effect that writes state on every prop change,
 * which React now flags because it forces a second render pass.
 *
 * Parsing goes through `parseDecimalToCents`, which works on digits rather than
 * `Number(x) * 100`, so `19.99` becomes exactly 1999 cents.
 */
export function MoneyInput({
  id,
  valueCents,
  onValueChange,
  currency,
  placeholder = "0.00",
  disabled,
  className,
  ...aria
}: MoneyInputProps) {
  /** `base` is the cents value the draft was typed against. */
  const [draft, setDraft] = useState<{ base: number; text: string } | null>(null);

  const active = draft !== null && draft.base === valueCents ? draft : null;
  const text = active?.text ?? centsToDecimalString(valueCents, currency);
  const invalid = active !== null && parseDecimalToCents(active.text) === null;

  return (
    <div className="relative">
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={aria["aria-invalid"] ?? (invalid ? true : undefined)}
        aria-describedby={aria["aria-describedby"]}
        className={cn("tnum pr-12 text-right", className)}
        onChange={(event) => {
          const raw = event.target.value;
          const parsed = parseDecimalToCents(raw);
          if (parsed === null) {
            // Show what was typed so the user can finish, but report nothing
            // upward — the parent keeps its last valid amount.
            setDraft({ base: valueCents, text: raw });
            return;
          }
          setDraft({ base: parsed, text: raw });
          onValueChange(parsed);
        }}
        onBlur={() => {
          // Drop the draft so an incomplete entry snaps back to a real amount.
          setDraft(null);
        }}
      />
      <span
        className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs"
        aria-hidden="true"
      >
        {currency}
      </span>
    </div>
  );
}
