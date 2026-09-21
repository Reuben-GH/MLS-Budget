import { describe, test, expect } from "vitest";
import { buildReassignUpdate } from "../lib/transactions/reassign";

describe("Phase 3 — buildReassignUpdate()", () => {
  test("first correction records original_category", () => {
    const update = buildReassignUpdate(
      { category: "Other", manually_overridden: false },
      { category: "Food", subcategory: "Groceries" }
    );
    expect(update).toEqual({
      category: "Food",
      subcategory: "Groceries",
      manually_overridden: true,
      original_category: "Other",
    });
  });

  test("a second correction does not clobber the already-recorded original", () => {
    const update = buildReassignUpdate(
      { category: "Food", manually_overridden: true },
      { category: "Personal", subcategory: "Shopping" }
    );
    expect(update).toEqual({
      category: "Personal",
      subcategory: "Shopping",
      manually_overridden: true,
    });
    expect(update.original_category).toBeUndefined();
  });

  test("reassigning to no subcategory is allowed", () => {
    const update = buildReassignUpdate(
      { category: "Other", manually_overridden: false },
      { category: "Recreation", subcategory: null }
    );
    expect(update.subcategory).toBeNull();
  });
});
