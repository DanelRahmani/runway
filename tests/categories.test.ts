import { describe, expect, it } from "vitest";

import { categoryEmoji, categorySuggestions } from "@/lib/categories";
import { ITEM_NAMES } from "@/lib/itemNames";
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

/*
 * The starter forecasts are checked above because they are written by hand. The
 * name chips are the other way a category gets written without the user picking
 * it, and they had drifted the same way: "Salary" filled in "Client work", which
 * is business-only, so a personal forecast ended up with a category its own
 * picker never offers. The item still renders and still totals, which is why it
 * went unnoticed — it just cannot be seen or chosen again.
 */
describe("item name chips only fill categories their own forecast offers", () => {
  it("points every chip at a category that is in scope for its kind and direction", () => {
    for (const chip of ITEM_NAMES) {
      if (chip.category === undefined) continue;

      for (const kind of chip.kinds) {
        const match = categorySuggestions(kind, chip.direction).find(
          (category) => category.label === chip.category,
        );

        expect(match, `"${chip.name}" fills in "${chip.category}", not offered to ${kind}`).toBeDefined();
        expect(match?.direction, `"${chip.name}" fills in a ${match?.direction} category`).toBe(
          chip.direction,
        );
      }
    }
  });

  it("leaves the deliberately uncategorised chips uncategorised", () => {
    // "Refund" has no honest single category, and the picker is the user's job.
    const refund = ITEM_NAMES.find((chip) => chip.name === "Refund");

    expect(refund).toBeDefined();
    expect(refund?.category).toBeUndefined();
  });
});
