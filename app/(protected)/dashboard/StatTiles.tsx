interface StatTilesProps {
  totals: { totalIncome: number; totalExpenses: number; surplus: number };
  incomeCount: number;
  expenseCount: number;
}

const fmtAmt = (n: number) =>
  "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Plain Server Component — factual labels only, no evaluative
// language ("great job", "on track") per the product's compliance
// constraint. Surplus is captioned with its formula, not a verdict.
export function StatTiles({ totals, incomeCount, expenseCount }: StatTilesProps) {
  return (
    <div className="stat-row">
      <div className="stat-tile">
        <div className="stat-label">
          <span className="dir-arrow dir-in">▲</span> Total income
        </div>
        <div className="stat-value">{fmtAmt(totals.totalIncome)}</div>
        <div className="stat-caption">
          {incomeCount} income transaction{incomeCount === 1 ? "" : "s"}
        </div>
      </div>
      <div className="stat-tile">
        <div className="stat-label">
          <span className="dir-arrow dir-out">▼</span> Total expenses
        </div>
        <div className="stat-value">{fmtAmt(totals.totalExpenses)}</div>
        <div className="stat-caption">
          {expenseCount} expense transaction{expenseCount === 1 ? "" : "s"}
        </div>
      </div>
      <div className="stat-tile">
        <div className="stat-label">Surplus</div>
        <div className="stat-value">{fmtAmt(totals.surplus)}</div>
        <div className="stat-caption">Total income minus total expenses</div>
      </div>
    </div>
  );
}
