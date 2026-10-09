import { useState } from "react";

import { Input } from "@/components/ui/input";
import { centsToDecimalString, formatCents, parseAmount } from "@/lib/money";
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
 * Amount field that accepts typed money and reports whole cents.
 *
 * Tolerant by design. Anything recognisable as a number is accepted — decimals,
 * a comma or dot decimal point, thousands separators, a trailing separator
 * mid-keystroke, a currency symbol pasted in front. Values with more than two
 * decimals are **rounded** rather than rejected, and the field snaps to the
 * stored amount on blur, so what you see is exactly what was saved.
 *
 * The display text is derived rather than synchronised: a draft is kept only
 * while it still describes the incoming `valueCents`, and is dropped when that
 * value changes from outside. That avoids an effect writing state on every prop
 * change, which would force a second render pass.
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
  /** Set when the last entry had to be rounded, so the change is explained. */
  const [roundedFrom, setRoundedFrom] = useState<string | null>(null);

  const active = draft !== null && draft.base === valueCents ? draft : null;
  const text = active?.text ?? centsToDecimalString(valueCents, currency);
  const invalid = active !== null && parseAmount(active.text) === null;

  return (
    <div className="flex flex-col gap-1">
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
          /*
           * Tabular figures in the body face, not Geist Mono: mono is the label
           * register in this design language, and a 13px control would also make
           * iOS zoom the viewport on focus.
           */
          className={cn("tabular-nums pr-12 text-right", className)}
          onChange={(event) => {
            const raw = event.target.value;
            const parsed = parseAmount(raw);

            if (parsed === null) {
              // Keep showing what was typed so it can be finished or corrected,
              // but report nothing upward — the parent keeps its last valid amount.
              setDraft({ base: valueCents, text: raw });
              setRoundedFrom(null);
              return;
            }

            setDraft({ base: parsed.cents, text: raw });
            setRoundedFrom(parsed.rounded ? raw : null);
            onValueChange(parsed.cents);
          }}
          onBlur={() => {
            // Drop the draft so the field shows the stored, rounded amount.
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

      {roundedFrom !== null ? (
        <p className="text-muted-foreground font-mono text-[0.6875rem]">
          Rounded to {formatCents(valueCents, currency)}
        </p>
      ) : null}
    </div>
  );
}
