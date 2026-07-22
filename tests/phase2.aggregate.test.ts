import { describe, test, expect } from "vitest";
import {
  computeMonthlyTotals,
  computeCategoryBreakdown,
  computeFixedDiscretionaryBreakdown,
  filterTransactions,
  type TransactionForAggregation,
} from "../lib/budget/aggregate";
import { MARCH_2026_TRANSACTIONS } from "./fixtures/march-2026-transactions";
import { MARCH_2026_EXPECTED } from "./fixtures/march-2026-expected";

// Pure logic, no DB — feeds the real March 2026 fixture (already
// proven correct against Phase 0's hosted-DB tests) through the
// aggregate.ts functions the real app pages call directly.

const TRANSACTIONS: TransactionForAggregation[] = MARCH_2026_TRANSACTIONS.map((row, i) => ({
  id: `fixture-${i}`,
  txn_date: row.txn_date,
  description: row.description,
  amount: row.amount,
  category: row.expected_category,
  subcategory: row.expected_subcategory,
}));

describe("Phase 2 — aggregate.ts against the March 2026 fixture", () => {
  test("computeMonthlyTotals matches the known-correct fixture totals", () => {
    const totals = computeMonthlyTotals(TRANSACTIONS);
    expect(totals.totalIncome).toBeCloseTo(MARCH_2026_EXPECTED.totalIncome, 2);
    expect(totals.totalExpenses).toBeCloseTo(MARCH_2026_EXPECTED.totalExpenses, 2);
    expect(totals.surplus).toBeCloseTo(MARCH_2026_EXPECTED.surplus, 2);
  });

  test("computeCategoryBreakdown nets the refund against Personal/Shopping, not against income", () => {
    const breakdown = computeCategoryBreakdown(TRANSACTIONS);
    const personal = breakdown.find((g) => g.category === "Personal");
    expect(personal).toBeDefined();
    const shoppingLine = personal!.lines.find((l) => l.subcategory === "Shopping");
    expect(shoppingLine).toBeDefined();
    // JB HI-FI -299.00 + Refund Amazon +45.00 = net expense of 254.00
    expect(shoppingLine!.amount).toBeCloseTo(254.0, 2);
  });

  test("computeCategoryBreakdown's line amounts sum to total expenses", () => {
    const breakdown = computeCategoryBreakdown(TRANSACTIONS);
    const sum = breakdown.reduce((total, g) => total + g.amount, 0);
    expect(sum).toBeCloseTo(MARCH_2026_EXPECTED.totalExpenses, 2);
  });

  test("computeFixedDiscretionaryBreakdown splits using the hardcoded defaults (no overrides)", () => {
    const { fixed, discretionary } = computeFixedDiscretionaryBreakdown(TRANSACTIONS, []);
    expect(fixed.amount).toBeCloseTo(5360.65, 2);
    expect(discretionary.amount).toBeCloseTo(460.39, 2);
    expect(fixed.amount + discretionary.amount).toBeCloseTo(MARCH_2026_EXPECTED.totalExpenses, 2);
  });

  test("filterTransactions by category returns only that category's rows", () => {
    const filtered = filterTransactions(TRANSACTIONS, [], { kind: "category", category: "Housing" });
    expect(filtered).toHaveLength(2); // Commbank home loan + council rates
    expect(filtered.every((t) => t.category === "Housing")).toBe(true);
  });

  test("filterTransactions by fd-group returns only Fixed transactions using an override", () => {
    // Override Recreation to Fixed so both its transactions (Netflix, Gym) move buckets.
    const overrides = [{ category: "Recreation" as const, subcategory: null, classification: "fixed" as const }];
    const fixedRows = filterTransactions(TRANSACTIONS, overrides, { kind: "fd-group", group: "fixed" });
    expect(fixedRows.some((t) => t.category === "Recreation")).toBe(true);
  });

  test("filterTransactions with no filter returns every transaction unchanged", () => {
    expect(filterTransactions(TRANSACTIONS, [], null)).toHaveLength(TRANSACTIONS.length);
  });
});
