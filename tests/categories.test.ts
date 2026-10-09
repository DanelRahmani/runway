import { describe, expect, it } from "vitest";

import { categoryEmoji, categorySuggestions } from "@/lib/categories";
import { createStarterForecast } from "@/lib/sample";

const labels = (kind: "PERSONAL" | "BUSINESS" | undefined, direction?: "INFLOW" | "OUTFLOW") =>
  categorySuggestions(kind, direction).map((category) => category.label);

describe("categories are scoped to the forecast kind", () => {
  it("never offers business categories on a personal forecast", () => {
    for (const direction of ["INFLOW", "OUTFLOW"] as const) {
      const offered = labels("PERSONAL", direction);

      expect(offered).toContain("Housing");
      expect(offered).not.toContain("Payroll");
      expect(offered).not.toContain("Premises");
      expect(offered).not.toContain("Subcontractors");
      expect(offered).not.toContain("Hosting");
    }
  });

  it("never offers household categories on a business forecast", () => {
    for (const direction of ["INFLOW", "OUTFLOW"] as const) {
      const offered = labels("BUSINESS", direction);

      expect(offered).toContain("Payroll");
      expect(offered).not.toContain("Housing");
      expect(offered).not.toContain("Groceries");
      expect(offered).not.toContain("Fitness");
      expect(offered).not.toContain("Pets");
    }
  });

  it("offers the shared categories to both", () => {
    for (const kind of ["PERSONAL", "BUSINESS"] as const) {
      const offered = labels(kind, "OUTFLOW");

      expect(offered).toContain("Tax");
      expect(offered).toContain("Travel");
      expect(offered).toContain("Education");
      expect(offered).toContain("Pension");
    }
  });

  it("falls back to everything only when the kind is unknown", () => {
    // Documents the fallback: a forecast with no kind is an older record, and
    // showing the full list is the only honest option for it.
    const offered = labels(undefined, "OUTFLOW");

    expect(offered).toContain("Housing");
    expect(offered).toContain("Payroll");
  });

  it("leads with the direction being entered", () => {
    const income = categorySuggestions("BUSINESS", "INFLOW");
    const outflow = categorySuggestions("BUSINESS", "OUTFLOW");

    expect(income[0]?.direction).toBe("INFLOW");
    expect(outflow[0]?.direction).toBe("OUTFLOW");
  });

  it("keeps the starter forecasts on the taxonomy", () => {
    // The starters are the worked example people read first. A category they use
    // that the picker does not offer renders without an emoji and cannot be
    // reproduced by hand, which is how "Living" and "Tools" drifted in.
    for (const kind of ["PERSONAL", "BUSINESS"] as const) {
      const starter = createStarterForecast(kind);
      const used = [
        ...starter.recurringItems.map((item) => item.category),
        ...starter.oneOffItems.map((item) => item.category),
      ].filter((category): category is string => category !== undefined);

      expect(used.length).toBeGreaterThan(0);
      for (const label of used) {
        expect(categoryEmoji(label), `${kind} starter uses "${label}"`).not.toBeNull();
      }
    }
  });
});
