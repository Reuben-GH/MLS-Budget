import { estimateCreditCardLoyaltyCost, type CreditCardLoyaltyFigure } from "../../lib/figures/config";

interface CreditCardMethodologyCardProps {
  figure: CreditCardLoyaltyFigure;
}

const fmtAmt = (n: number) => "$" + n.toLocaleString("en-AU", { maximumFractionDigits: 0 });

export function CreditCardMethodologyCard({ figure }: CreditCardMethodologyCardProps) {
  const workedExampleBalance = 4_000;
  const extraAnnualCost = estimateCreditCardLoyaltyCost({ revolvingBalance: workedExampleBalance });

  return (
    <div className="card figure-card">
      <div className="card-head">
        <span className="card-title">{figure.label}</span>
        <span className="figure-badge cited">Cited statistic</span>
      </div>

      <div className="figure-headline">{fmtAmt(Math.round(extraAnnualCost))}/yr</div>
      <div className="figure-headline-caption">
        extra, on a {fmtAmt(workedExampleBalance)} revolving balance carried at the average rate instead of a
        low-rate card
      </div>

      <div className="stat-caption" style={{ marginBottom: 12 }}>
        {figure.appliesTo}
      </div>

      <div className="figure-caveat" style={{ marginBottom: 8 }}>
        Average rate paid: <strong>{figure.averageRatePercent}%</strong> · Low-rate benchmark:{" "}
        <strong>{figure.lowRateBenchmarkPercent}%</strong> · Gap: <strong>{figure.ratePremiumPoints} percentage points</strong>
      </div>

      <div className="figure-source">
        Source: {figure.source.organisation}, {figure.source.report} — {figure.sourceDate}
      </div>
      <div className="figure-caveat">{figure.caveat}</div>

      <div className="figure-history">
        <strong>How we turn this into a dollar figure:</strong> {figure.calculationCaveat}
      </div>

      <a
        href="/tools/credit-card-calculator.html"
        target="_blank"
        rel="noopener noreferrer"
        className="calculator-link"
      >
        Try the Credit Card Reduction Calculator →
      </a>
    </div>
  );
}
