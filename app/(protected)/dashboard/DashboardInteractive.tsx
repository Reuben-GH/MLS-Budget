"use client";

import { useState } from "react";
import {
  filterTransactions,
  type TransactionForAggregation,
  type CategoryBreakdownGroup,
  type FixedDiscretionaryGroup,
  type ActiveFilter,
} from "../../../lib/budget/aggregate";
import type { ClassificationOverride } from "../../../lib/categories/classification";
import { SpendByCategoryCard } from "./SpendByCategoryCard";
import { TransactionsLedger } from "./TransactionsLedger";

interface DashboardInteractiveProps {
  transactions: TransactionForAggregation[];
  overrides: ClassificationOverride[];
  categoryBreakdown: CategoryBreakdownGroup[];
  fdBreakdown: { fixed: FixedDiscretionaryGroup; discretionary: FixedDiscretionaryGroup };
}

// The one client component on the dashboard — owns the shared
// activeFilter state driving both the breakdown chart and the
// ledger, mirroring the approved mockup's single shared variable.
export function DashboardInteractive({
  transactions,
  overrides,
  categoryBreakdown,
  fdBreakdown,
}: DashboardInteractiveProps) {
  const [mode, setMode] = useState<"category" | "fd">("category");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>(null);

  function toggleFilter(filter: NonNullable<ActiveFilter>) {
    setActiveFilter((current) => {
      if (!current) return filter;
      const same = JSON.stringify(current) === JSON.stringify(filter);
      return same ? null : filter;
    });
  }

  const visibleTransactions = filterTransactions(transactions, overrides, activeFilter);

  return (
    <div className="two-col">
      <SpendByCategoryCard
        mode={mode}
        onModeChange={setMode}
        categoryBreakdown={categoryBreakdown}
        fdBreakdown={fdBreakdown}
        activeFilter={activeFilter}
        onSelect={toggleFilter}
      />
      <TransactionsLedger
        transactions={visibleTransactions}
        totalCount={transactions.length}
        activeFilter={activeFilter}
        onClearFilter={() => setActiveFilter(null)}
      />
    </div>
  );
}
