import { describe, expect, it } from "vitest";

import { COLLAPSED_SUGGESTIONS, selectVisibleSuggestions } from "@/lib/suggestions";

const chips = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ value: `Category ${index + 1}` }));

describe("suggestion visibility", () => {
  it("shortens a long list rather than showing it all", () => {
    const { visible, hiddenCount } = selectVisibleSuggestions(chips(20), {
      query: "",
      expanded: false,
    });

    expect(visible).toHaveLength(COLLAPSED_SUGGESTIONS);
    expect(hiddenCount).toBe(20 - COLLAPSED_SUGGESTIONS);
  });

  it("shows everything once expanded", () => {
    const { visible, hiddenCount } = selectVisibleSuggestions(chips(20), {
      query: "",
      expanded: true,
    });

    expect(visible).toHaveLength(20);
    expect(hiddenCount).toBe(0);
  });

  it("leaves a short list alone and offers no toggle", () => {
    const { visible, hiddenCount } = selectVisibleSuggestions(chips(3), {
      query: "",
      expanded: false,
    });

    expect(visible).toHaveLength(3);
    expect(hiddenCount).toBe(0);
  });

  it("filters to matches while the user is typing", () => {
    const suggestions = [{ value: "Housing" }, { value: "Groceries" }, { value: "Fuel" }];
    const { visible } = selectVisibleSuggestions(suggestions, { query: "gro", expanded: false });

    expect(visible.map((suggestion) => suggestion.value)).toEqual(["Groceries"]);
  });

  it("matches anywhere in the value, not only at the start", () => {
    const suggestions = [{ value: "Housing" }, { value: "Fuel" }];
    const { visible } = selectVisibleSuggestions(suggestions, { query: "sing", expanded: false });

    expect(visible.map((suggestion) => suggestion.value)).toEqual(["Housing"]);
  });

  it("ignores case and surrounding space when filtering", () => {
    const suggestions = [{ value: "Debt repayment" }];
    const { visible } = selectVisibleSuggestions(suggestions, {
      query: "  DEBT ",
      expanded: false,
    });

    expect(visible).toHaveLength(1);
  });

  it("keeps a chosen chip visible even when it falls past the shortlist", () => {
    const { visible } = selectVisibleSuggestions(chips(20), {
      query: "",
      expanded: false,
      activeValue: "Category 18",
    });

    expect(visible.some((suggestion) => suggestion.value === "Category 18")).toBe(true);
  });

  it("does not duplicate a chosen chip that is already in the shortlist", () => {
    const { visible } = selectVisibleSuggestions(chips(20), {
      query: "",
      expanded: false,
      activeValue: "Category 2",
    });

    expect(visible.filter((suggestion) => suggestion.value === "Category 2")).toHaveLength(1);
  });

  it("returns nothing when the typed text matches no suggestion", () => {
    const suggestions = [{ value: "Housing" }];
    const { visible } = selectVisibleSuggestions(suggestions, {
      query: "zzz",
      expanded: false,
    });

    expect(visible).toEqual([]);
  });
});
