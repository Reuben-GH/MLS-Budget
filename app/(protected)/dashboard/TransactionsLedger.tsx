import type { TransactionForAggregation, ActiveFilter } from "../../../lib/budget/aggregate";

interface TransactionsLedgerProps {
  transactions: TransactionForAggregation[];
  totalCount: number;
  activeFilter: ActiveFilter;
  onClearFilter: () => void;
}

const fmt = (n: number) =>
  (n < 0 ? "−$" : "+$") + Math.abs(n).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string) =>
  new Date(d + "T00:00:00Z").toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });

function titleCase(desc: string): string {
  return desc.length ? desc.charAt(0) + desc.slice(1).toLowerCase() : desc;
}

export function TransactionsLedger({ transactions, totalCount, activeFilter, onClearFilter }: TransactionsLedgerProps) {
  const filterLabel = !activeFilter
    ? null
    : activeFilter.kind === "category"
      ? activeFilter.category
      : activeFilter.kind === "fd-group"
        ? activeFilter.group === "fixed"
          ? "Fixed"
          : "Discretionary"
        : `${activeFilter.category} · ${activeFilter.subcategory ?? "(no subcategory)"}`;

  const displayRows = activeFilter ? transactions : transactions.slice(-8);

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Transactions</span>
        <span className="card-sub">{activeFilter ? "" : `${displayRows.length} of ${totalCount}`}</span>
      </div>

      {activeFilter && (
        <div className="filter-chip-row">
          <span className="filter-chip">
            Showing: {filterLabel}{" "}
            <button type="button" aria-label="Clear filter" onClick={onClearFilter}>
              ✕
            </button>
          </span>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table className="ledger">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th style={{ textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={4}>No transactions here yet.</td>
              </tr>
            ) : (
              displayRows.map((t) => (
                <tr key={t.id}>
                  <td className="date">{fmtDate(t.txn_date)}</td>
                  <td>{titleCase(t.description)}</td>
                  <td>
                    <span className="chip">
                      {t.category}
                      {t.subcategory ? ` · ${t.subcategory}` : ""}
                    </span>
                  </td>
                  <td className="amt">{fmt(t.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
