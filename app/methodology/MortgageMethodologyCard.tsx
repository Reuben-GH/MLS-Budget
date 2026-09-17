import { estimateMortgageLoyaltyCost, type MortgageLoyaltyFigure } from "../../lib/figures/config";

interface MortgageMethodologyCardProps {
  figure: MortgageLoyaltyFigure;
}

const ASSUMED_BALANCE = 800_000;
const fmtAmt = (n: number) => "$" + n.toLocaleString("en-AU", { maximumFractionDigits: 0 });

export function MortgageMethodologyCard({ figure }: MortgageMethodologyCardProps) {
  const rows = figure.bands.map((band) => ({
    band,
    cost: estimateMortgageLoyaltyCost({ loanAgeYears: band.minYears, loanBalance: ASSUMED_BALANCE }).extraAnnualCost,
  }));
  // Highlight the largest, most compelling gap — the oldest-loan band —
  // rather than an arbitrary middle one, since the whole point of this
  // card is to make the loyalty gap impossible to miss.
  const headlineBand = figure.bands[figure.bands.length - 1];
  const headlineCost = rows[rows.length - 1].cost;

  return (
    <div className="card figure-card">
      <div className="card-head">
        <span className="card-title">{figure.label}</span>
        <span className="figure-badge cited">Cited statistic</span>
      </div>

      <div className="figure-headline">up to {fmtAmt(headlineCost)}/yr</div>
      <div className="figure-headline-caption">
        extra, on an {fmtAmt(ASSUMED_BALANCE)} loan held {headlineBand.label.toLowerCase()} without refinancing or
        renegotiating
      </div>

      <div className="stat-caption" style={{ marginBottom: 12 }}>
        {figure.appliesTo}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="ledger rate-band-table">
          <thead>
            <tr>
              <th>Loan age</th>
              <th style={{ textAlign: "right" }}>Extra interest rate paid</th>
              <th style={{ textAlign: "right" }}>Extra paid per year (on an {fmtAmt(ASSUMED_BALANCE)} loan)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ band, cost }) => (
              <tr key={band.label}>
                <td>{band.label}</td>
                <td className="amt">{band.ratePremiumPoints.toFixed(2)} percentage points</td>
                <td className="amt">{fmtAmt(Math.round(cost))}/yr</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="figure-source">
        Source: {figure.source.organisation}, {figure.source.report} — {figure.sourceDate}
      </div>
      <div className="figure-caveat">{figure.caveat}</div>

      <div className="figure-history">
        <strong>How we turn this into a dollar figure:</strong> {figure.calculationCaveat}
      </div>

      <a
        href="/tools/mortgage-calculator.html"
        target="_blank"
        rel="noopener noreferrer"
        className="calculator-link"
      >
        Try the Mortgage Reduction Calculator →
      </a>
    </div>
  );
}
