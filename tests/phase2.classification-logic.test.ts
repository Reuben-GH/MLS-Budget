import { describe, test, expect } from "vitest";
import { classify, type ClassificationOverride } from "../lib/categories/classification";

// Pure logic, no DB — the 3-tier cascade: explicit override wins,
// then the hardcoded default, then a safe 'discretionary' fallback
// for anything neither of those covers (e.g. a brand-new custom
// subcategory).

describe("Phase 2 — classify() 3-tier cascade", () => {
  test("hardcoded default wins when there's no override", () => {
    expect(classify("Housing", "Mortgage/Rent", [])).toBe("fixed");
    expect(classify("Personal", "Shopping", [])).toBe("discretionary");
  });

  test("bare-category default wins for categories with no subcategories", () => {
    expect(classify("Education", null, [])).toBe("fixed");
    expect(classify("Recreation", null, [])).toBe("discretionary");
  });

  test("an explicit override always wins over the hardcoded default", () => {
    const overrides: ClassificationOverride[] = [
      { category: "Housing", subcategory: "Mortgage/Rent", classification: "discretionary" },
    ];
    expect(classify("Housing", "Mortgage/Rent", overrides)).toBe("discretionary");
  });

  test("an override for one subcategory doesn't leak to another under the same category", () => {
    const overrides: ClassificationOverride[] = [
      { category: "Housing", subcategory: "Mortgage/Rent", classification: "discretionary" },
    ];
    expect(classify("Housing", "Rates", overrides)).toBe("fixed"); // untouched, still the default
  });

  test("a brand-new custom subcategory with no default and no override falls back to discretionary", () => {
    expect(classify("Recreation", "Streaming", [])).toBe("discretionary");
  });

  test("an override on a custom subcategory still wins over the safe fallback", () => {
    const overrides: ClassificationOverride[] = [
      { category: "Recreation", subcategory: "Streaming", classification: "fixed" },
    ];
    expect(classify("Recreation", "Streaming", overrides)).toBe("fixed");
  });

  test("a bare-category override uses subcategory: null, matching the sentinel translation", () => {
    const overrides: ClassificationOverride[] = [{ category: "Other", subcategory: null, classification: "fixed" }];
    expect(classify("Other", null, overrides)).toBe("fixed");
  });
});
