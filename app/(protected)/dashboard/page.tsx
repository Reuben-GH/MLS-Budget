import { createClient } from "../../../lib/supabase/server";
import {
  computeMonthlyTotals,
  computeCategoryBreakdown,
  computeFixedDiscretionaryBreakdown,
  type TransactionForAggregation,
} from "../../../lib/budget/aggregate";
import { extractAvailableMonths, resolveTargetMonth, monthLabel, monthStartDate, monthEndExclusive } from "../../../lib/budget/months";
import { fromSentinel, type ClassificationOverride, type FDClassification } from "../../../lib/categories/classification";
import type { TopLevelCategory } from "../../../lib/categories/taxonomy";
import { StatTiles } from "./StatTiles";
import { GranularityToggle } from "./GranularityToggle";
import { MonthNav } from "./MonthNav";
import { DashboardInteractive } from "./DashboardInteractive";
import { DisclaimerFooter } from "../../../components/DisclaimerFooter";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null; // the (protected) layout already redirects; satisfies TypeScript

  // Every txn_date, not just the latest — this is the one place that
  // needs to know every month that has data, to build the picker and
  // to validate a requested ?month= against months that actually
  // exist (see resolveTargetMonth). A single narrow column, so this
  // stays cheap even as history grows.
  const { data: allDates } = await supabase
    .from("transactions")
    .select("txn_date")
    .eq("user_id", user.id)
    .order("txn_date", { ascending: false });

  if (!allDates || allDates.length === 0) {
    return (
      <>
        <div className="card">
          <p>No transactions yet. Once statements are uploaded, your dashboard will appear here.</p>
        </div>
        <DisclaimerFooter />
      </>
    );
  }

  const availableMonths = extractAvailableMonths(allDates.map((r) => r.txn_date));
  const { month: requestedMonth } = await searchParams;
  const currentMonth = resolveTargetMonth(availableMonths, requestedMonth)!; // non-null: availableMonths just confirmed non-empty

  const monthStart = monthStartDate(currentMonth);
  const monthEnd = monthEndExclusive(currentMonth);

  const { data: txnRows } = await supabase
    .from("transactions")
    .select("id, txn_date, description, amount, category, subcategory")
    .eq("user_id", user.id)
    .gte("txn_date", monthStart)
    .lt("txn_date", monthEnd)
    .order("txn_date", { ascending: true });

  const transactions: TransactionForAggregation[] = (txnRows ?? []).map((t) => ({
    id: t.id,
    txn_date: t.txn_date,
    description: t.description,
    amount: Number(t.amount),
    category: t.category as TopLevelCategory,
    subcategory: t.subcategory,
  }));

  const { data: classificationRows } = await supabase
    .from("category_classifications")
    .select("top_level_category, subcategory, classification")
    .eq("user_id", user.id);

  const overrides: ClassificationOverride[] = (classificationRows ?? []).map((r) => ({
    category: r.top_level_category as TopLevelCategory,
    subcategory: fromSentinel(r.subcategory),
    classification: r.classification as FDClassification,
  }));

  const { data: customSubRows } = await supabase
    .from("custom_subcategories")
    .select("top_level_category, name")
    .eq("user_id", user.id);

  const customSubcategories: Record<string, string[]> = {};
  for (const row of customSubRows ?? []) {
    if (!customSubcategories[row.top_level_category]) customSubcategories[row.top_level_category] = [];
    customSubcategories[row.top_level_category].push(row.name);
  }

  const totals = computeMonthlyTotals(transactions);
  const categoryBreakdown = computeCategoryBreakdown(transactions);
  const fdBreakdown = computeFixedDiscretionaryBreakdown(transactions, overrides);
  const incomeCount = transactions.filter((t) => t.category === "Income").length;
  const transferCount = transactions.filter((t) => t.category === "Transfer").length;
  const expenseCount = transactions.length - incomeCount - transferCount;

  const monthOptions = availableMonths.map((m) => ({ value: m, label: monthLabel(m) }));

  return (
    <>
      <div className="period-bar">
        <MonthNav currentMonth={currentMonth} options={monthOptions} />
        <div className="period-controls">
          <GranularityToggle />
        </div>
      </div>

      <StatTiles totals={totals} incomeCount={incomeCount} expenseCount={expenseCount} />

      <DashboardInteractive
        transactions={transactions}
        overrides={overrides}
        categoryBreakdown={categoryBreakdown}
        fdBreakdown={fdBreakdown}
        customSubcategories={customSubcategories}
      />

      <DisclaimerFooter />
    </>
  );
}
