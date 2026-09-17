import Link from "next/link";
import { FIGURES, MORTGAGE_LOYALTY_FIGURE, CREDIT_CARD_LOYALTY_FIGURE } from "../../lib/figures/config";
import { DisclaimerFooter } from "../../components/DisclaimerFooter";
import { FigureCard } from "./FigureCard";
import { MortgageMethodologyCard } from "./MortgageMethodologyCard";
import { CreditCardMethodologyCard } from "./CreditCardMethodologyCard";

export const metadata = {
  title: "Methodology — My Life Sorted",
  description: "Every figure we cite, its source, and how we calculate it.",
};

export default function MethodologyPage() {
  const figures = Object.values(FIGURES);

  return (
    <div className="app-shell">
      <header className="mls-header">
        <div className="mls-header-left">
          <div className="logo-badge">MLS</div>
          <div>
            <div className="header-title">My Life Sorted</div>
            <div className="header-sub">Methodology</div>
          </div>
        </div>
        <Link href="/login" className="sign-out-btn" style={{ textDecoration: "none" }}>
          Sign in
        </Link>
      </header>

      <main>
        <div className="card">
          <p>
            Every dollar figure this product shows is either a real, dated, checkable statistic, or clearly labelled
            as our own rough estimate. Nothing is invented and passed off as research. This page lists every one of
            them, exactly as they appear in the app.
          </p>
        </div>

        <MortgageMethodologyCard figure={MORTGAGE_LOYALTY_FIGURE} />
        <CreditCardMethodologyCard figure={CREDIT_CARD_LOYALTY_FIGURE} />

        {figures.map((figure) => (
          <FigureCard key={figure.key} figure={figure} />
        ))}

        <DisclaimerFooter />
      </main>
    </div>
  );
}
