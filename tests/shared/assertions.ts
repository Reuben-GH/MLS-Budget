import { expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidTopLevelCategory, isValidSubcategory, type TopLevelCategory } from "../../lib/categories/taxonomy";

const CENT_TOLERANCE = 0.01;

interface TransactionLike {
  category: string;
  subcategory?: string | null;
}

// Guards against the categoriser inventing new top-level categories —
// same check whether categories were hand-seeded (Phase 0) or
// machine-assigned (Phase 3+), so this function's signature and
// behaviour never change across phases.
export function assertCategoryTaxonomyValid(transactions: TransactionLike[]): void {
  for (const txn of transactions) {
    expect(
      isValidTopLevelCategory(txn.category),
      `"${txn.category}" is not one of the fixed top-level categories`
    ).toBe(true);

    if (isValidTopLevelCategory(txn.category)) {
      expect(
        isValidSubcategory(txn.category as TopLevelCategory, txn.subcategory),
        `"${txn.subcategory}" is not a valid subcategory of "${txn.category}"`
      ).toBe(true);
    }
  }
}

function monthEndExclusive(month: string): string {
  const [year, m] = month.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year, m, 1)); // m is 1-indexed already -> next month
  return nextMonth.toISOString().slice(0, 10);
}

async function computeMonthlyTotals(
  client: SupabaseClient,
  userId: string,
  month: string
): Promise<{ totalIncome: number; totalExpenses: number; surplus: number }> {
  const { data, error } = await client
    .from("transactions")
    .select("amount, category")
    .eq("user_id", userId)
    .gte("txn_date", month)
    .lt("txn_date", monthEndExclusive(month));

  if (error) throw error;

  // Sign convention (docs/data-model.md): debits negative, credits
  // positive. total_expenses is the negated sum of non-Income rows,
  // so a positive refund nets against its category without touching
  // total_income. This is the same formula Phase 4's aggregation job
  // will use — this function queries raw transactions directly so it
  // works identically before and after monthly_summaries is populated.
  let totalIncome = 0;
  let totalExpenses = 0;
  for (const row of data ?? []) {
    if (row.category === "Income") {
      totalIncome += row.amount;
    } else {
      totalExpenses -= row.amount;
    }
  }

  return {
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    surplus: Math.round((totalIncome - totalExpenses) * 100) / 100,
  };
}

// Signature deliberately takes data (a client + userId + month), not
// an implementation — Phase 0 seeds categories by hand, Phase 3+ seeds
// them via the real categoriser, but this function's call sites and
// behaviour never change.
export async function assertMonthlyTotals(
  client: SupabaseClient,
  userId: string,
  month: string,
  expected: { totalIncome: number; totalExpenses: number; surplus: number }
): Promise<void> {
  const actual = await computeMonthlyTotals(client, userId, month);
  expect(Math.abs(actual.totalIncome - expected.totalIncome)).toBeLessThanOrEqual(CENT_TOLERANCE);
  expect(Math.abs(actual.totalExpenses - expected.totalExpenses)).toBeLessThanOrEqual(CENT_TOLERANCE);
  expect(Math.abs(actual.surplus - expected.surplus)).toBeLessThanOrEqual(CENT_TOLERANCE);
}

export async function assertSurplus(
  client: SupabaseClient,
  userId: string,
  month: string,
  expectedSurplus: number
): Promise<void> {
  const actual = await computeMonthlyTotals(client, userId, month);
  expect(Math.abs(actual.surplus - expectedSurplus)).toBeLessThanOrEqual(CENT_TOLERANCE);
}
