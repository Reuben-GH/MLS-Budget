import { describe, test, expect } from "vitest";
import {
  FIGURES,
  FIGURE_KEYS,
  MORTGAGE_LOYALTY_FIGURE,
  estimateMortgageLoyaltyCost,
  CREDIT_CARD_LOYALTY_FIGURE,
  estimateCreditCardLoyaltyCost,
} from "../lib/figures/config";

// Pure logic, no DB — figures.config is the single source of truth for
// every dollar figure this product cites, so these tests exist to
// catch a malformed or incomplete entry before it ever reaches the
// methodology page or the (future) Audit quiz.

describe("Phase 3 — figures.config structural integrity", () => {
  test("every flat figure has the fields its statisticType requires", () => {
    for (const key of FIGURE_KEYS) {
      const figure = FIGURES[key];
      expect(figure.key).toBe(key);

      if (figure.statisticType === "cited") {
        expect(figure.source.organisation.length).toBeGreaterThan(0);
        expect(figure.source.report.length).toBeGreaterThan(0);
        expect(figure.sourceDate.length).toBeGreaterThan(0);
      } else {
        expect(figure.estimateBasis.length).toBeGreaterThan(0);
      }

      // Every figure, cited or estimated, must disclose its caveat —
      // that's the whole point of this file.
      expect(figure.caveat.length).toBeGreaterThan(0);
      expect(figure.displayValue.length).toBeGreaterThan(0);
    }
  });

  test("exactly one figure is flagged as our own estimate (late fees)", () => {
    const estimates = FIGURE_KEYS.filter((key) => FIGURES[key].statisticType === "estimate");
    expect(estimates).toEqual(["late_fees_estimate"]);
  });

  test("duplicate_super_cost carries the required historical-context paragraph", () => {
    expect(FIGURES.duplicate_super_cost.historicalContext).toBeTruthy();
    expect(FIGURES.duplicate_super_cost.historicalContext).toContain("Productivity Commission");
  });
});

describe("Phase 3 — mortgage loyalty rate-gap bands", () => {
  test("bands cover [0, ∞) with no gaps or overlaps", () => {
    const sorted = [...MORTGAGE_LOYALTY_FIGURE.bands].sort((a, b) => a.minYears - b.minYears);
    expect(sorted[0].minYears).toBe(0);
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].maxYears).toBe(sorted[i + 1].minYears);
    }
    expect(sorted[sorted.length - 1].maxYears).toBeNull();
  });

  test("estimateMortgageLoyaltyCost picks the correct band and computes the dollar cost", () => {
    const result = estimateMortgageLoyaltyCost({ loanAgeYears: 4, loanBalance: 500_000 });
    expect(result.band.label).toBe("3–5 years");
    expect(result.extraAnnualCost).toBeCloseTo(2900, 2); // 500,000 × 0.0058
  });

  test("boundary years land in the correct band (upper bound is exclusive)", () => {
    expect(estimateMortgageLoyaltyCost({ loanAgeYears: 1, loanBalance: 100_000 }).band.label).toBe("1–3 years");
    expect(estimateMortgageLoyaltyCost({ loanAgeYears: 10, loanBalance: 100_000 }).band.label).toBe(
      "More than 10 years"
    );
  });

  test("rejects negative inputs", () => {
    expect(() => estimateMortgageLoyaltyCost({ loanAgeYears: -1, loanBalance: 100_000 })).toThrow();
    expect(() => estimateMortgageLoyaltyCost({ loanAgeYears: 1, loanBalance: -100 })).toThrow();
  });
});

describe("Phase 3 — credit card loyalty rate gap", () => {
  test("rate premium points equals the average rate minus the low-rate benchmark", () => {
    const expectedGap = CREDIT_CARD_LOYALTY_FIGURE.averageRatePercent - CREDIT_CARD_LOYALTY_FIGURE.lowRateBenchmarkPercent;
    expect(CREDIT_CARD_LOYALTY_FIGURE.ratePremiumPoints).toBeCloseTo(expectedGap, 2);
  });

  test("estimateCreditCardLoyaltyCost matches Canstar's own worked example ($4,000 balance ≈ $347/yr)", () => {
    const extraAnnualCost = estimateCreditCardLoyaltyCost({ revolvingBalance: 4_000 });
    expect(Math.round(extraAnnualCost)).toBe(347);
  });

  test("rejects negative balances", () => {
    expect(() => estimateCreditCardLoyaltyCost({ revolvingBalance: -1 })).toThrow();
  });
});
