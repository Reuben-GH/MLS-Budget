import { describe, test, expect } from "vitest";
import { resolveCategory, parseCorrectionsCsv } from "../lib/categories/other-corrections";

// Pure logic behind scripts/apply-other-corrections.ts (no DB) — the
// bulk-review workflow: export-other-patterns.ts hands a client a CSV
// of "Other" transaction patterns to fill in a Category/Subcategory
// for, and this is what turns their filled-in file back into concrete
// corrections. The DB-touching half (writing merchant_memory, custom
// subcategories, backfilling transactions) isn't unit-tested here for
// the same reason no Server Action in this codebase is — it needs a
// real request/DB context — but everything decidable from the file's
// content alone is.

describe("Phase 3 — resolveCategory()", () => {
  test("matches a valid category case-insensitively", () => {
    expect(resolveCategory("income")).toBe("Income");
    expect(resolveCategory("HOUSING")).toBe("Housing");
    expect(resolveCategory("  Food  ")).toBe("Food");
  });

  test("returns null for an unrecognised category", () => {
    expect(resolveCategory("Groceries")).toBeNull();
    expect(resolveCategory("")).toBeNull();
  });
});

describe("Phase 3 — parseCorrectionsCsv()", () => {
  test("a blank Category leaves the row out entirely — no correction, no skip reason", () => {
    const csv = "Pattern,Category,Subcategory\nEFTPOS DEBIT,,\n";
    const { corrections, skipped } = parseCorrectionsCsv(csv);
    expect(corrections).toHaveLength(0);
    expect(skipped).toHaveLength(0);
  });

  test("a valid category with no subcategory produces a correction", () => {
    const csv = "Pattern,Category,Subcategory\nOSKO DEPOSIT,Income,\n";
    const { corrections, skipped } = parseCorrectionsCsv(csv);
    expect(skipped).toHaveLength(0);
    expect(corrections).toEqual([
      { merchantKey: "OSKO DEPOSIT", category: "Income", subcategory: null, isNewCustomSubcategory: false },
    ]);
  });

  test("a built-in subcategory is recognised without needing to be created", () => {
    const csv = "Pattern,Category,Subcategory\nCOLES ONLINE,Food,Groceries\n";
    const { corrections } = parseCorrectionsCsv(csv);
    expect(corrections[0]).toEqual({
      merchantKey: "COLES ONLINE",
      category: "Food",
      subcategory: "Groceries",
      isNewCustomSubcategory: false,
    });
  });

  test("a subcategory that isn't one of the category's built-ins is flagged as new", () => {
    const csv = "Pattern,Category,Subcategory\nDESIGNATILE PTY LTD,Housing,Renovation\n";
    const { corrections } = parseCorrectionsCsv(csv);
    expect(corrections[0]).toEqual({
      merchantKey: "DESIGNATILE PTY LTD",
      category: "Housing",
      subcategory: "Renovation",
      isNewCustomSubcategory: true,
    });
  });

  test("an invalid category is skipped with a reason, not silently dropped or guessed", () => {
    const csv = "Pattern,Category,Subcategory\nSOME MERCHANT,Grocery,\n";
    const { corrections, skipped } = parseCorrectionsCsv(csv);
    expect(corrections).toHaveLength(0);
    expect(skipped[0]).toContain("SOME MERCHANT");
    expect(skipped[0]).toContain("Grocery");
  });

  test("Transfer with a subcategory is rejected, matching the app's own rule that Transfer has none", () => {
    const csv = "Pattern,Category,Subcategory\nLAMPE TARA,Transfer,Family\n";
    const { corrections, skipped } = parseCorrectionsCsv(csv);
    expect(corrections).toHaveLength(0);
    expect(skipped[0]).toContain("Transfer can't have a subcategory");
  });

  test("Transfer with no subcategory is fine", () => {
    const csv = "Pattern,Category,Subcategory\nLAMPE TARA,Transfer,\n";
    const { corrections, skipped } = parseCorrectionsCsv(csv);
    expect(skipped).toHaveLength(0);
    expect(corrections[0].category).toBe("Transfer");
    expect(corrections[0].subcategory).toBeNull();
  });

  test("multiple rows mix valid, blank, and invalid correctly", () => {
    const csv = [
      "Pattern,Category,Subcategory",
      "OSKO DEPOSIT,Income,",
      "EFTPOS DEBIT,,",
      "SOME MERCHANT,NotACategory,",
      "AFSH NOM REPAYMENT,Financial,Loan repayments other than mortgage",
    ].join("\n");
    const { corrections, skipped } = parseCorrectionsCsv(csv);
    expect(corrections).toHaveLength(2);
    expect(skipped).toHaveLength(1);
    expect(corrections.map((c) => c.merchantKey)).toEqual(["OSKO DEPOSIT", "AFSH NOM REPAYMENT"]);
  });
});
