import { describe, test, expect } from "vitest";
import {
  computeMonthlyTotals,
  computeCategoryBreakdown,
  computeFixedDiscretionaryBreakdown,
  filterTransactions,
  type TransactionForAggregation,
} from "../lib/budget/aggregate";

// Pure logic, no DB — a small local fixture with a Transfer row mixed
// in (the March 2026 fixture has none). Proves the double-counting
// trap discussed with Reg can't happen: a transfer must hit neither
// income nor expenses in any total, while still being visible when
// explicitly filtered for (same as YNAB's own pattern).

const TRANSACTIONS: TransactionForAggregation[] = [
  { id: "1", txn_date: "2026-03-01", description: "SALARY", amount: 6000, category: "Income", subcategory: "Salary" },
  { id: "2", txn_date: "2026-03-03", description: "WOOLWORTHS", amount: -150, category: "Food", subcategory: "Groceries" },
  { id: "3", txn_date: "2026-03-05", description: "TRANSFER TO SAVINGS", amount: -500, category: "Transfer", subcategory: null },
  { id: "4", txn_date: "2026-03-06", description: "TRANSFER FROM SAVINGS", amount: 500, category: "Transfer", subcategory: null },
];

describe("Phase 3 — Transfer exclusion from computeMonthlyTotals", () => {
  test("Transfer rows affect neither total income nor total expenses", () => {
    const totals = computeMonthlyTotals(TRANSACTIONS);
    expect(totals.totalIncome).toBe(6000);
    expect(totals.totalExpenses).toBe(150);
    expect(totals.surplus).toBe(5850);
  });
});

describe("Phase 3 — Transfer exclusion from breakdowns", () => {
  test("computeCategoryBreakdown has no Transfer group", () => {
    const breakdown = computeCategoryBreakdown(TRANSACTIONS);
    expect(breakdown.find((g) => g.category === "Transfer")).toBeUndefined();
  });

  test("computeFixedDiscretionaryBreakdown excludes Transfer from both sums", () => {
    const { fixed, discretionary } = computeFixedDiscretionaryBreakdown(TRANSACTIONS, []);
    const allLines = [...fixed.lines, ...discretionary.lines];
    expect(allLines.every((l) => l.category !== "Transfer")).toBe(true);
    expect(fixed.amount + discretionary.amount).toBe(150); // only the grocery expense
  });
});

describe("Phase 3 — Transfer rows stay visible when explicitly filtered for", () => {
  test("filtering the ledger to category:Transfer still returns them", () => {
    const result = filterTransactions(TRANSACTIONS, [], { kind: "category", category: "Transfer" });
    expect(result).toHaveLength(2);
  });

  test("Transfer rows never appear in a Fixed/Discretionary filter", () => {
    const fixed = filterTransactions(TRANSACTIONS, [], { kind: "fd-group", group: "fixed" });
    const discretionary = filterTransactions(TRANSACTIONS, [], { kind: "fd-group", group: "discretionary" });
    expect([...fixed, ...discretionary].some((t) => t.category === "Transfer")).toBe(false);
  });
});
