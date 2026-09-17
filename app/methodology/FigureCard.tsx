import type { FlatFigure } from "../../lib/figures/config";

interface FigureCardProps {
  figure: FlatFigure;
}

export function FigureCard({ figure }: FigureCardProps) {
  return (
    <div className="card figure-card">
      <div className="card-head">
        <span className="card-title">{figure.label}</span>
        {figure.statisticType === "cited" ? (
          <span className="figure-badge cited">Cited statistic</span>
        ) : (
          <span className="figure-badge estimate">Our estimate — not a cited statistic</span>
        )}
      </div>

      <div className="stat-value" style={{ marginBottom: 4 }}>
        {figure.displayValue}
      </div>
      <div className="stat-caption" style={{ marginBottom: 12 }}>
        {figure.appliesTo}
      </div>

      {figure.statisticType === "cited" ? (
        <div className="figure-source">
          Source: {figure.source.organisation}, {figure.source.report} — {figure.sourceDate}
        </div>
      ) : (
        <div className="figure-source">Basis for this estimate: {figure.estimateBasis}</div>
      )}

      <div className="figure-caveat">{figure.caveat}</div>

      {figure.historicalContext && <div className="figure-history">{figure.historicalContext}</div>}

      {figure.relatedFigure && (
        <div className="figure-caveat">
          {figure.relatedFigure.label}: {figure.relatedFigure.displayValue}
        </div>
      )}

      {figure.alternativeFigures && figure.alternativeFigures.length > 0 && (
        <div className="figure-caveat">
          Other sources report wider ranges:{" "}
          {figure.alternativeFigures.map((alt, i) => (
            <span key={alt.source}>
              {i > 0 && "; "}
              {alt.source}: {alt.displayValue}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
