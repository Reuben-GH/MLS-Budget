import type { CategoryBreakdownGroup, FixedDiscretionaryGroup, ActiveFilter } from "../../../lib/budget/aggregate";

interface SpendByCategoryCardProps {
  mode: "category" | "fd";
  onModeChange: (mode: "category" | "fd") => void;
  categoryBreakdown: CategoryBreakdownGroup[];
  fdBreakdown: { fixed: FixedDiscretionaryGroup; discretionary: FixedDiscretionaryGroup };
  activeFilter: ActiveFilter;
  onSelect: (filter: NonNullable<ActiveFilter>) => void;
}

const fmtAmt = (n: number) =>
  "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function SpendByCategoryCard({
  mode,
  onModeChange,
  categoryBreakdown,
  fdBreakdown,
  activeFilter,
  onSelect,
}: SpendByCategoryCardProps) {
  const fixedTotal = fdBreakdown.fixed.amount;
  const discretionaryTotal = fdBreakdown.discretionary.amount;
  const grandTotal = fixedTotal + discretionaryTotal;
  const fixedPct = grandTotal ? (fixedTotal / grandTotal) * 100 : 0;

  const isFilteredSub = (category: string, subcategory: string | null) =>
    !!activeFilter &&
    activeFilter.kind === "subcategory" &&
    activeFilter.category === category &&
    activeFilter.subcategory === subcategory;

  let maxLine = 0;
  if (mode === "category") {
    for (const group of categoryBreakdown) for (const line of group.lines) maxLine = Math.max(maxLine, line.amount);
  } else {
    for (const line of [...fdBreakdown.fixed.lines, ...fdBreakdown.discretionary.lines]) {
      maxLine = Math.max(maxLine, line.amount);
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Spend by category</span>
        <span className="card-sub">Click a line to filter transactions</span>
      </div>

      <div className="split-bar-wrap">
        <div className="split-bar">
          <div className="split-seg-fixed" style={{ width: `${fixedPct.toFixed(1)}%` }} />
          <div className="split-seg-disc" style={{ width: `${(100 - fixedPct).toFixed(1)}%` }} />
        </div>
        <div className="split-legend">
          <div className="split-legend-item">
            <span className="split-swatch fixed" />
            Fixed <span className="split-legend-amt">{fmtAmt(fixedTotal)}</span>{" "}
            <span className="split-legend-pct">({fixedPct.toFixed(0)}%)</span>
          </div>
          <div className="split-legend-item">
            <span className="split-swatch disc" />
            Discretionary <span className="split-legend-amt">{fmtAmt(discretionaryTotal)}</span>{" "}
            <span className="split-legend-pct">({(100 - fixedPct).toFixed(0)}%)</span>
          </div>
        </div>
      </div>

      <div className="chart-mode-row">
        <div className="pill-toggle">
          <button type="button" className={mode === "category" ? "active" : ""} onClick={() => onModeChange("category")}>
            By category
          </button>
          <button type="button" className={mode === "fd" ? "active" : ""} onClick={() => onModeChange("fd")}>
            Fixed / Discretionary
          </button>
        </div>
      </div>

      {mode === "category"
        ? categoryBreakdown.map((group) => (
            <div className="cat-group" key={group.category}>
              <button
                type="button"
                className="cat-group-head"
                onClick={() => onSelect({ kind: "category", category: group.category })}
              >
                <span className="cat-group-name">{group.category}</span>
                <span className="cat-group-total">{fmtAmt(group.amount)}</span>
              </button>
              {group.lines.map((line) => (
                <button
                  type="button"
                  key={line.subcategory ?? "(none)"}
                  className={"cat-sub-row" + (isFilteredSub(line.category, line.subcategory) ? " filtered" : "")}
                  onClick={() => onSelect({ kind: "subcategory", category: line.category, subcategory: line.subcategory })}
                >
                  <span className="cat-sub-name">{line.subcategory ?? "(no subcategory)"}</span>
                  <span className="cat-track">
                    <span className="cat-fill" style={{ width: `${((line.amount / maxLine) * 100).toFixed(1)}%` }} />
                  </span>
                  <span className="cat-sub-amount">{fmtAmt(line.amount)}</span>
                </button>
              ))}
            </div>
          ))
        : [fdBreakdown.fixed, fdBreakdown.discretionary].map((groupData) => (
            <div className="cat-group" key={groupData.group}>
              <button
                type="button"
                className="cat-group-head"
                onClick={() => onSelect({ kind: "fd-group", group: groupData.group })}
              >
                <span className="cat-group-name">{groupData.group === "fixed" ? "Fixed" : "Discretionary"}</span>
                <span className="cat-group-total">{fmtAmt(groupData.amount)}</span>
              </button>
              {groupData.lines.map((line) => (
                <button
                  type="button"
                  key={`${line.category}::${line.subcategory ?? "(none)"}`}
                  className={"cat-sub-row" + (isFilteredSub(line.category, line.subcategory) ? " filtered" : "")}
                  onClick={() => onSelect({ kind: "subcategory", category: line.category, subcategory: line.subcategory })}
                >
                  <span className="cat-sub-name">
                    {line.category} · {line.subcategory ?? "(no subcategory)"}
                  </span>
                  <span className="cat-track">
                    <span
                      className={`cat-fill ${groupData.group}`}
                      style={{ width: `${((line.amount / maxLine) * 100).toFixed(1)}%` }}
                    />
                  </span>
                  <span className="cat-sub-amount">{fmtAmt(line.amount)}</span>
                </button>
              ))}
            </div>
          ))}
    </div>
  );
}
