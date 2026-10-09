import { describe, expect, it } from "vitest";

import { withoutCategory } from "@/hooks/useSelection";

describe("clearing a category", () => {
  it("removes the key rather than setting it to undefined", () => {
    // This is the point. An `undefined` survives a structured clone into
    // IndexedDB but disappears through JSON.stringify, so the same record would
    // look different depending on how it left the app.
    const cleared = withoutCategory({ id: "a", name: "Rent", category: "Housing" });

    expect("category" in cleared).toBe(false);
    expect(JSON.parse(JSON.stringify(cleared))).toEqual({ id: "a", name: "Rent" });
  });

  it("leaves the rest of the item untouched", () => {
    const item = { id: "b", name: "Gym", category: "Fitness", amountCents: 4_500, isActive: true };
    const cleared = withoutCategory(item);

    expect(cleared).toEqual({ id: "b", name: "Gym", amountCents: 4_500, isActive: true });
  });

  it("is a no-op on an item that has no category", () => {
    // Typed rather than inline: the generic infers from the argument, and a bare
    // literal with no `category` property gives it nothing to infer from.
    const item: { id: string; name: string; category?: string } = { id: "c", name: "Misc" };
    const cleared = withoutCategory(item);

    expect(cleared).toEqual({ id: "c", name: "Misc" });
  });
});
