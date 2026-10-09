import { describe, expect, it } from "vitest";

import { dateFormat, numberFormat } from "@/lib/intl";
import { formatCents } from "@/lib/money";

describe("formatter cache", () => {
  it("hands back the same instance for the same key", () => {
    const first = numberFormat("test|same", undefined, { style: "decimal" });
    const second = numberFormat("test|same", undefined, { style: "decimal" });

    expect(first).toBe(second);
  });

  it("keeps different keys apart", () => {
    const a = numberFormat("test|a", undefined, { style: "decimal" });
    const b = numberFormat("test|b", undefined, { style: "decimal" });

    expect(a).not.toBe(b);
  });

  it("caches date formatters on the same terms", () => {
    const first = dateFormat("test|iso", undefined, { timeZone: "UTC" });
    const second = dateFormat("test|iso", undefined, { timeZone: "UTC" });

    expect(first).toBe(second);
  });

  it("still formats correctly across currencies and locales", () => {
    // The cache key includes the locale, so a shared instance can never leak one
    // locale's conventions into another's output.
    expect(formatCents(150_000, "EUR", { locale: "en-GB" })).toBe("€1,500.00");
    // Asserted on the digits rather than the whole string: German places the
    // symbol after the amount behind a non-breaking space, which is a detail of
    // the ICU data rather than something worth pinning.
    expect(formatCents(150_000, "EUR", { locale: "de-DE" })).toContain("1.500,00");
    expect(formatCents(150_000, "EUR", { locale: "en-GB" })).toBe("€1,500.00");
    expect(formatCents(150_000, "JPY", { locale: "en-US" })).toBe("¥1,500");
  });
});
