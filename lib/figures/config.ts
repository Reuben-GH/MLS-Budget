import { z } from "zod";

// Every dollar figure this product ever cites lives here, and only
// here. The public /methodology page (and, later, the free-tier
// Disorganisation Audit quiz) both read from this one file, so the
// app's copy and its public methodology explanation can never drift
// apart. No dollar figure is allowed to appear in app copy except by
// reference to a key in this file.
//
// `statisticType` is the extension point for future non-dollar Audit
// answers — e.g. a later `"qualitative_flag"` variant for questions
// like "do you have a will?", or a `"no_clean_figure"` variant for
// cases like non-super unclaimed money, where only state-specific
// numbers exist (NSW ~$370, VIC ~$150) and no national figure is
// credible enough to cite. Neither is implemented yet — don't add
// entries for them until there's real content to back them.

export type FigureUnit =
  | "aud_per_year"
  | "aud_per_year_per_account"
  | "aud_one_off_per_account"
  | "aud_one_off_per_person";

export interface AlternativeFigure {
  source: string;
  displayValue: string;
  note?: string;
}
export interface RelatedFigure {
  label: string;
  value: number;
  unit: FigureUnit;
  displayValue: string;
}

interface FlatFigureBase {
  key: string;
  label: string;
  value: number;
  unit: FigureUnit;
  displayValue: string;
  appliesTo: string;
  caveat: string;
  historicalContext?: string;
  alternativeFigures?: AlternativeFigure[];
  relatedFigure?: RelatedFigure;
}
export interface CitedFigure extends FlatFigureBase {
  statisticType: "cited";
  source: { organisation: string; report: string };
  sourceDate: string;
}
export interface EstimatedFigure extends FlatFigureBase {
  statisticType: "estimate";
  estimateBasis: string;
  valueRange?: { min: number; max: number };
}
export type FlatFigure = CitedFigure | EstimatedFigure;

export const FIGURE_KEYS = [
  "energy_loyalty_gap",
  "car_insurance_loyalty_gap",
  "home_insurance_loyalty_gap",
  "subscriptions_wasted_spend",
  "food_waste_cost",
  "duplicate_super_cost",
  "lost_super_average",
  "unclaimed_medicare_average",
  "late_fees_estimate",
] as const;
export type FlatFigureKey = (typeof FIGURE_KEYS)[number];
export const figureKeySchema = z.enum(FIGURE_KEYS);

export const FIGURES: Record<FlatFigureKey, FlatFigure> = {
  energy_loyalty_gap: {
    key: "energy_loyalty_gap",
    label: "Energy provider loyalty gap",
    value: 221,
    unit: "aud_per_year",
    displayValue: "$221/yr",
    appliesTo: "Households on an electricity or gas plan that is 3+ years old",
    statisticType: "cited",
    source: { organisation: "ACCC", report: "Inquiry into the National Electricity Market" },
    sourceDate: "December 2025",
    caveat:
      "National average using typical-usage assumptions; excludes rebates and solar feed-in tariffs. The gap has been narrowing since 2024, so treat this as an upper-bound estimate rather than a current guarantee.",
  },
  car_insurance_loyalty_gap: {
    key: "car_insurance_loyalty_gap",
    label: "Car insurance loyalty gap",
    value: 300,
    unit: "aud_per_year",
    displayValue: "$300/yr average extra cost of auto-renewing vs switching",
    appliesTo: "Households who auto-renew car insurance without comparing",
    statisticType: "cited",
    source: { organisation: "Canstar Research", report: "Car insurance comparison-site analysis" },
    sourceDate: "2025 (ongoing comparison-site data)",
    caveat:
      "Industry (comparison-site) data, not a government statistic — Canstar's methodology is not fully disclosed. A stronger, government-sourced ACCC figure exists but is specific to Northern Australia and was judged non-representative for a national audience, so it isn't used here.",
    relatedFigure: {
      label: "Potential saving by switching",
      value: 651,
      unit: "aud_per_year",
      displayValue: "up to $651/yr",
    },
  },
  home_insurance_loyalty_gap: {
    key: "home_insurance_loyalty_gap",
    label: "Home insurance loyalty gap",
    value: 1072,
    unit: "aud_per_year",
    displayValue: "up to $1,072/yr potential saving by switching",
    appliesTo: "Households who haven't compared home insurance recently",
    statisticType: "cited",
    source: { organisation: "Canstar Research", report: "Home insurance comparison-site analysis" },
    sourceDate: "2025 (ongoing comparison-site data)",
    caveat:
      "Industry (comparison-site) data, not a government statistic. Presented as a potential saving, not a guaranteed one.",
  },
  subscriptions_wasted_spend: {
    key: "subscriptions_wasted_spend",
    label: "Wasted subscription spend",
    value: 600,
    unit: "aud_per_year",
    displayValue: "$600/yr",
    appliesTo: "Households with active paid subscriptions",
    statisticType: "cited",
    source: {
      organisation: "Westpac",
      report: "Subscription spending survey (1,995 people, combined with real transaction-data analysis)",
    },
    sourceDate: "August 2025",
    caveat:
      "Presented as the central estimate because it's the only source combining a survey with real transaction-data analysis, rather than pure self-report. Other survey-only sources report much higher, wider ranges — see alternatives — but that width reflects weaker methodology, not a more accurate number.",
    alternativeFigures: [
      { source: "ING (survey)", displayValue: "$1,261/yr", note: "Self-reported survey estimate." },
      { source: "Compare the Market (survey)", displayValue: "$1,600+/yr", note: "Self-reported survey estimate." },
    ],
  },
  food_waste_cost: {
    key: "food_waste_cost",
    label: "Household food waste cost",
    value: 1500,
    unit: "aud_per_year",
    displayValue: "$1,500/yr",
    appliesTo: "All households (national average)",
    statisticType: "cited",
    source: { organisation: "OzHarvest", report: '"Half Eaten" report (survey of 3,005+ households)' },
    sourceDate: "August 2025",
    caveat:
      "This is total household food waste cost, not narrowed to disorganisation specifically — over-buying and over-cooking also contribute, and no research supports a disorganisation-only split, so none is invented here. A NSW-specific figure of $2,100/yr exists if a regional breakdown is wanted later.",
  },
  duplicate_super_cost: {
    key: "duplicate_super_cost",
    label: "Cost per duplicate super account",
    value: 40,
    unit: "aud_per_year_per_account",
    displayValue: "$40/account/yr",
    appliesTo: "People with more than one active super account",
    statisticType: "cited",
    source: { organisation: "ASFA", report: "ASFA analysis of duplicate super account fees" },
    sourceDate: "approx. 2021–2023 (needs manual verification — see caveat)",
    caveat:
      "The source PDF could not be read during research, so this figure has not been directly confirmed against primary text — verify manually before relying on it.",
    historicalContext:
      "An earlier, more rigorously sourced 2018 Productivity Commission figure put this cost at $260/account/year. Reforms since then — Protecting Your Super (2019), Putting Members' Interests First (2019), and super account stapling (2021) — have substantially closed that gap, which is why the current estimate is much lower.",
  },
  lost_super_average: {
    key: "lost_super_average",
    label: "Average lost/unclaimed super per account",
    value: 2590,
    unit: "aud_one_off_per_account",
    displayValue: "$2,590 (one-off, per account)",
    appliesTo: "People with a lost or unclaimed super account",
    statisticType: "cited",
    source: { organisation: "ATO", report: "ATO Super Accounts Data" },
    sourceDate: "as at 30 June 2025",
    caveat:
      "One-off recovery amount, not annual — and an average per ACCOUNT, not per person (some people have more than one lost account). Corroborated via the ATO's own media release plus consistent secondary sources.",
  },
  unclaimed_medicare_average: {
    key: "unclaimed_medicare_average",
    label: "Average unclaimed Medicare rebate per person",
    value: 275,
    unit: "aud_one_off_per_person",
    displayValue: "$275 (one-off, per person)",
    appliesTo: "People with outdated bank details on file with Medicare",
    statisticType: "cited",
    source: { organisation: "Services Australia", report: "Medicare unclaimed rebates data" },
    sourceDate: "approx. March 2026",
    caveat:
      "Specifically rebates unclaimed because of outdated bank details on file — not a general 'forgot to claim a rebate' statistic. Word this precisely wherever it's used.",
  },
  late_fees_estimate: {
    key: "late_fees_estimate",
    label: "Estimated late-fee cost",
    value: 60,
    valueRange: { min: 30, max: 84 },
    unit: "aud_per_year",
    displayValue: "≈$60/yr (our estimate; range $30–$84)",
    appliesTo: "Households that regularly miss credit card or bill payment due dates",
    statisticType: "estimate",
    estimateBasis:
      "Built primarily from credit card late payment fees, which are the most common recurring source of late fees for a disorganised household: ANZ, CBA and NAB charge $20 per missed payment, Westpac charges $15, and Canstar's broader market average is $21. Multiplying that per-fee range ($15–$21) by an assumed 2–4 missed payments per year for a disorganised household gives $30–$84/yr; a Finder survey (December 2023) found 13% of Australians had fallen 30+ days behind on a credit card repayment, which is the kind of missed-payment behaviour this estimate is modelling. The per-fee amounts and the prevalence figure are sourced; the 2–4/year frequency applied to an individual household is still our own assumption, not researched — no credible aggregate source for a household's total annual late-fee cost across all bill types exists anywhere, which is why this figure is labelled our own estimate rather than a citation.",
    caveat:
      "No credible published source exists anywhere for a typical annual late-fee cost across all bill types — this is our own rough calculation built from real credit card late-fee amounts, not a research finding, and should be treated as indicative only. Late fees on other bills (utilities, loan repayments) can add further cost on top of this estimate.",
  },
};

// ── The mortgage entry: a rate-gap table, not a flat figure ────────
export interface LoanAgeBand {
  label: string;
  minYears: number;
  maxYears: number | null; // null = no upper bound
  ratePremiumPoints: number; // percentage points
}
export interface MortgageLoyaltyFigure {
  key: "mortgage_loyalty_rate_gap";
  label: string;
  appliesTo: string;
  bands: LoanAgeBand[];
  statisticType: "cited";
  source: { organisation: string; report: string };
  sourceDate: string;
  caveat: string;
  calculationCaveat: string;
}

export const MORTGAGE_LOYALTY_FIGURE: MortgageLoyaltyFigure = {
  key: "mortgage_loyalty_rate_gap",
  label: "Mortgage loyalty rate gap",
  appliesTo: "Mortgagor households only — not relevant to renters or outright owners",
  bands: [
    { label: "Less than 1 year", minYears: 0, maxYears: 1, ratePremiumPoints: 0.29 },
    { label: "1–3 years", minYears: 1, maxYears: 3, ratePremiumPoints: 0.47 },
    { label: "3–5 years", minYears: 3, maxYears: 5, ratePremiumPoints: 0.58 },
    { label: "5–10 years", minYears: 5, maxYears: 10, ratePremiumPoints: 0.71 },
    { label: "More than 10 years", minYears: 10, maxYears: null, ratePremiumPoints: 1.04 },
  ],
  statisticType: "cited",
  source: { organisation: "ACCC", report: "Home Loan Price Inquiry" },
  sourceDate: "2020 (no repeat inquiry since — treat as dated)",
  caveat:
    "This is a rate-gap table, not a dollar figure — the actual dollar cost depends on the household's own loan balance. No equivalent ACCC inquiry has been repeated since 2020, so these premiums may not reflect current lender behaviour.",
  calculationCaveat:
    "extra_annual_cost ≈ loan_balance × (rate_gap_percentage_points / 100). This is a simplification — it doesn't account for compounding or amortisation effects on a reducing loan balance — but is disclosed here in the same spirit as every other figure in this file: showing its working rather than hiding behind a single number.",
};

export const mortgageLoyaltyInputSchema = z.object({
  loanAgeYears: z.number().nonnegative(),
  loanBalance: z.number().nonnegative(),
});

export function getMortgageRateBand(loanAgeYears: number): LoanAgeBand {
  const band = MORTGAGE_LOYALTY_FIGURE.bands.find(
    (b) => loanAgeYears >= b.minYears && (b.maxYears === null || loanAgeYears < b.maxYears)
  );
  // Bands are authored to cover [0, ∞) with no gaps — this only trips
  // if that invariant is ever broken (see tests/phase3.figures-config.test.ts).
  if (!band) throw new Error(`No loan-age band covers ${loanAgeYears} years`);
  return band;
}

export interface MortgageLoyaltyCostEstimate {
  band: LoanAgeBand;
  extraAnnualCost: number;
}

export function estimateMortgageLoyaltyCost(input: {
  loanAgeYears: number;
  loanBalance: number;
}): MortgageLoyaltyCostEstimate {
  const { loanAgeYears, loanBalance } = mortgageLoyaltyInputSchema.parse(input);
  const band = getMortgageRateBand(loanAgeYears);
  return { band, extraAnnualCost: loanBalance * (band.ratePremiumPoints / 100) };
}

// ── Credit card loyalty gap: a flat rate-gap applied to the
// household's own revolving balance — no age bands, since this is
// about whether the card has ever been reviewed, not how old it is. ──
export interface CreditCardLoyaltyFigure {
  key: "credit_card_loyalty_rate_gap";
  label: string;
  appliesTo: string;
  averageRatePercent: number;
  lowRateBenchmarkPercent: number;
  ratePremiumPoints: number;
  statisticType: "cited";
  source: { organisation: string; report: string };
  sourceDate: string;
  caveat: string;
  calculationCaveat: string;
}

export const CREDIT_CARD_LOYALTY_FIGURE: CreditCardLoyaltyFigure = {
  key: "credit_card_loyalty_rate_gap",
  label: "Credit card loyalty rate gap",
  appliesTo: "Households carrying a revolving credit card balance (not paid off in full each statement)",
  averageRatePercent: 18.67,
  lowRateBenchmarkPercent: 10,
  ratePremiumPoints: 8.67,
  statisticType: "cited",
  source: {
    organisation: "Canstar",
    report: "Survey of 2,029 Australian cardholders, combined with RBA credit card interest rate data",
  },
  sourceDate: "March 2026 (RBA data to December 2025)",
  caveat:
    "31% of cardholders surveyed had never reviewed their credit card, and a further 24% hadn't reviewed it in over a year. The 10% benchmark is Canstar's 'low-rate card' threshold, not a rate guaranteed to be available to everyone — approval depends on individual circumstances. Only relevant to households who carry a balance month to month; this gap doesn't apply if the card is paid off in full each statement.",
  calculationCaveat:
    "extra_annual_cost ≈ revolving_balance × (rate_gap_percentage_points / 100). Same simplification as the mortgage figure — doesn't model a balance that changes over the year — disclosed for the same reason: showing the working rather than hiding behind a single number.",
};

export const creditCardLoyaltyInputSchema = z.object({
  revolvingBalance: z.number().nonnegative(),
});

export function estimateCreditCardLoyaltyCost(input: { revolvingBalance: number }): number {
  const { revolvingBalance } = creditCardLoyaltyInputSchema.parse(input);
  return revolvingBalance * (CREDIT_CARD_LOYALTY_FIGURE.ratePremiumPoints / 100);
}
