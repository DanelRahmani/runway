import { useEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { formatCents } from "@/lib/money";
import type { Currency } from "@/types/forecast";

interface AnimatedMoneyProps {
  cents: number;
  currency: Currency;
  /** Kept short: the brief asks for motion that is barely seen. */
  durationMs?: number;
}

/**
 * Counts a figure to its new value when it changes.
 *
 * Two deliberate restraints:
 *
 * - **It does not animate on mount.** The first paint shows the real number, so
 *   opening a forecast is instant and the animation only ever signals a change
 *   the user just caused. Animating on load would make the dashboard feel slower
 *   for no informational gain.
 * - **It animates cents, not major units.** Each frame is rounded to a whole
 *   number of cents and formatted from there, so the printed figure is always a
 *   real amount rather than a floating-point artefact.
 *
 * With reduced motion enabled the target value is rendered directly and no
 * animation frame is ever scheduled.
 */
export function AnimatedMoney({ cents, currency, durationMs = 220 }: AnimatedMoneyProps) {
  const prefersReduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(cents);
  const fromRef = useRef(cents);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = cents;
    fromRef.current = to;

    if (prefersReduced || from === to) return;

    const startedAt = performance.now();

    const step = (now: number): void => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      // Ease-out cubic: decelerates into the final figure, no overshoot or bounce.
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [cents, currency, durationMs, prefersReduced]);

  const shown = prefersReduced ? cents : display;

  return <>{formatCents(shown, currency)}</>;
}
