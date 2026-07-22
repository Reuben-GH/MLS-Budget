import { isIncomeCategory, type TopLevelCategory } from "../categories/taxonomy";
import { classify, type ClassificationOverride } from "../categories/classification";

// Pure, DB-free aggregation. Takes transactions/overrides in, returns
// computed data out — no fetching — so these exact functions run
// identically from a Server Component and from a Vitest unit test.

export interface TransactionForAggregation {
  id: string;
  txn_date: string;
  description: string;
  amount: number; // positive = credit, negative = debit (docs/data-model.md)
  category: TopLevelCategory;
  subcategory: string | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeMonthlyTotals(transactions: TransactionForAggregation[]): {
  totalIncome: number;
  totalExpenses: number;
  surplus: number;
} {
  let totalIncome = 0;
  let totalExpenses = 0;
  for (const t of transactions) {
    if (isIncomeCategory(t.category)) {
      totalIncome += t.amount;
    } else {
      totalExpenses -= t.amount;
    }
  }
  return {
    totalIncome: round2(totalIncome),
    totalExpenses: round2(totalExpenses),
    surplus: round2(totalIncome - totalExpenses),
  };
}

export interface BreakdownLine {
  category: TopLevelCategory;
  subcategory: string | null;
  amount: number;
}

export interface CategoryBreakdownGroup {
  category: TopLevelCategory;
  amount: number;
  lines: BreakdownLine[];
}

// Category -> subcategory -> $ amount, expenses only (Income excluded
// — Fixed/Discretionary and this breakdown are both spend-only
// concepts). A positive refund nets against its own category/
// subcategory line automatically, same mechanism as the top-level
// total (docs/data-model.md).
function groupExpenses(
  transactions: TransactionForAggregation[]
): Map<TopLevelCategory, Map<string | null, number>> {
  const groups = new Map<TopLevelCategory, Map<string | null, number>>();
  for (const t of transactions) {
    if (isIncomeCategory(t.category)) continue;
    if (!groups.has(t.category)) groups.set(t.category, new Map());
    const subMap = groups.get(t.category)!;
    subMap.set(t.subcategory, (subMap.get(t.subcategory) ?? 0) - t.amount);
  }
  return groups;
}

export function computeCategoryBreakdown(
  transactions: TransactionForAggregation[]
): CategoryBreakdownGroup[] {
  const groups = groupExpenses(transactions);
  const result: CategoryBreakdownGroup[] = [];
  for (const [category, subMap] of groups) {
    const lines: BreakdownLine[] = [...subMap.entries()]
      .map(([subcategory, amount]) => ({ category, subcategory, amount: round2(amount) }))
      .sort((a, b) => b.amount - a.amount);
    const amount = round2(lines.reduce((sum, l) => sum + l.amount, 0));
    result.push({ category, amount, lines });
  }
  return result.sort((a, b) => b.amount - a.amount);
}

export interface FixedDiscretionaryGroup {
  group: "fixed" | "discretionary";
  amount: number;
  lines: BreakdownLine[];
}

export function computeFixedDiscretionaryBreakdown(
  transactions: TransactionForAggregation[],
  overrides: ClassificationOverride[]
): { fixed: FixedDiscretionaryGroup; discretionary: FixedDiscretionaryGroup } {
  const groups = groupExpenses(transactions);
  const buckets: Record<"fixed" | "discretionary", BreakdownLine[]> = { fixed: [], discretionary: [] };
  for (const [category, subMap] of groups) {
    for (const [subcategory, amount] of subMap) {
      const bucket = classify(category, subcategory, overrides);
      buckets[bucket].push({ category, subcategory, amount: round2(amount) });
    }
  }
  const build = (group: "fixed" | "discretionary"): FixedDiscretionaryGroup => {
    const lines = [...buckets[group]].sort((a, b) => b.amount - a.amount);
    return { group, amount: round2(lines.reduce((sum, l) => sum + l.amount, 0)), lines };
  };
  return { fixed: build("fixed"), discretionary: build("discretionary") };
}

export type ActiveFilter =
  | { kind: "category"; category: TopLevelCategory }
  | { kind: "subcategory"; category: TopLevelCategory; subcategory: string | null }
  | { kind: "fd-group"; group: "fixed" | "discretionary" }
  | null;

export function filterTransactions(
  transactions: TransactionForAggregation[],
  overrides: ClassificationOverride[],
  filter: ActiveFilter
): TransactionForAggregation[] {
  if (!filter) return transactions;
  if (filter.kind === "category") {
    return transactions.filter((t) => t.category === filter.category);
  }
  if (filter.kind === "subcategory") {
    return transactions.filter(
      (t) => t.category === filter.category && t.subcategory === filter.subcategory
    );
  }
  return transactions.filter(
    (t) => !isIncomeCategory(t.category) && classify(t.category, t.subcategory, overrides) === filter.group
  );
}
