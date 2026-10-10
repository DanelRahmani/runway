import { describe, expect, it } from "vitest";

import { SCENARIO_PRESETS, scenarioPresets } from "@/lib/forecast/scenarios";
import { createStarterForecast } from "@/lib/sample";

/**
 * Presets are the one place a change is made to a forecast the user never sees,
 * so the tests here are about scope and safety rather than about arithmetic: a
 * preset must know which kind of forecast it applies to, must be applicable to a
 * real forecast of that kind, and must not touch the forecast it was handed.
 */
describe("scenario presets", () => {
  it("declares at least one kind for every preset", () => {
    for (const preset of SCENARIO_PRESETS) {
      expect(preset.kinds.length, `preset "${preset.id}" declares no kind`).toBeGreaterThan(0);
    }
  });

  it("gives a household only questions a household can be asked", () => {
    const starter = createStarterForecast("PERSONAL", "2026-01-01");
    const forHouseholds = scenarioPresets("PERSONAL");

    expect(forHouseholds.length).toBeGreaterThan(0);
    for (const preset of forHouseholds) {
      // A household raises no invoices, so an invoice-driven preset must not be
      // offered — and every offered preset must actually apply.
      expect(preset.apply(starter), `"${preset.id}" does not apply to a household`).not.toBeNull();
    }
  });

  it("gives a business only questions a business can be asked", () => {
    const starter = createStarterForecast("BUSINESS", "2026-01-01");

    for (const preset of scenarioPresets("BUSINESS")) {
      expect(preset.apply(starter), `"${preset.id}" does not apply to a business`).not.toBeNull();
    }
  });

  it("offers everything to a forecast saved before the kind existed", () => {
    expect(scenarioPresets(undefined)).toHaveLength(SCENARIO_PRESETS.length);
  });

  it("never mutates the base forecast", () => {
    // `copy` spreads the forecast, but a preset that reached for `.sort()` or
    // pushed onto an array would corrupt the base case in place — and the base is
    // the user's own saved forecast.
    const base = createStarterForecast("BUSINESS", "2026-01-01");
    const snapshot = structuredClone(base);

    for (const preset of scenarioPresets("BUSINESS")) preset.apply(base);

    expect(base).toEqual(snapshot);
  });

  it("labels the scenario it produced", () => {
    const base = createStarterForecast("PERSONAL", "2026-01-01");

    for (const preset of scenarioPresets("PERSONAL")) {
      const applied = preset.apply(base);
      expect(applied?.scenarioLabel).not.toBeUndefined();
      // The copy is a scenario of the base, not a replacement for it.
      expect(applied?.id).toBe(base.id);
    }
  });
});
