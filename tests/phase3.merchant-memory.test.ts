import { describe, test, expect } from "vitest";
import { deriveMerchantKey } from "../lib/categories/merchant-key";
import { applyMerchantMemory } from "../lib/transactions/reassign";

describe("Phase 3 — deriveMerchantKey()", () => {
  test("strips a trailing store number", () => {
    expect(deriveMerchantKey("WOOLWORTHS 2145")).toBe("WOOLWORTHS");
  });

  test("leaves a description with no trailing digits alone (aside from normalising case)", () => {
    expect(deriveMerchantKey("NETFLIX.COM")).toBe("NETFLIX.COM");
  });

  test("collapses repeated whitespace and trims", () => {
    expect(deriveMerchantKey("  SHELL   COLES EXPRESS  ")).toBe("SHELL COLES EXPRESS");
  });

  test("two different store numbers for the same merchant produce the same key", () => {
    expect(deriveMerchantKey("WOOLWORTHS 2145")).toBe(deriveMerchantKey("WOOLWORTHS 8890"));
  });
});

describe("Phase 3 — applyMerchantMemory()", () => {
  const candidates = [
    { id: "1", description: "WOOLWORTHS 2145", category: "Other", manually_overridden: false, original_category: null },
    { id: "2", description: "WOOLWORTHS 8890", category: "Other", manually_overridden: false, original_category: null },
    { id: "3", description: "COLES SUPERMARKETS", category: "Food", manually_overridden: false, original_category: null },
    { id: "4", description: "WOOLWORTHS 1111", category: "Personal", manually_overridden: true, original_category: null },
  ];

  test("only matching, non-manually-overridden rows are updated", () => {
    const updates = applyMerchantMemory(candidates, "WOOLWORTHS", "Food", "Groceries");
    expect(updates.map((u) => u.id).sort()).toEqual(["1", "2"]);
  });

  test("a manually-overridden row matching the merchant key is left alone", () => {
    const updates = applyMerchantMemory(candidates, "WOOLWORTHS", "Food", "Groceries");
    expect(updates.some((u) => u.id === "4")).toBe(false);
  });

  test("a non-matching merchant is left alone", () => {
    const updates = applyMerchantMemory(candidates, "WOOLWORTHS", "Food", "Groceries");
    expect(updates.some((u) => u.id === "3")).toBe(false);
  });

  test("original_category is set from each row's own current category, not clobbered if already present", () => {
    const withExistingOriginal = [
      { id: "5", description: "WOOLWORTHS 2145", category: "Personal", manually_overridden: false, original_category: "Other" },
    ];
    const updates = applyMerchantMemory(withExistingOriginal, "WOOLWORTHS", "Food", "Groceries");
    expect(updates[0].original_category).toBeUndefined();
  });

  test("updates carry full confidence, matching a direct prior correction", () => {
    const updates = applyMerchantMemory(candidates, "WOOLWORTHS", "Food", "Groceries");
    expect(updates.every((u) => u.confidence === 1.0)).toBe(true);
  });
});
