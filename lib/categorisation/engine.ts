import type { TopLevelCategory } from "../categories/taxonomy";

export interface CategorisationResult {
  category: TopLevelCategory;
  subcategory: string | null;
  confidence: number;
}

interface Rule {
  id: string;
  category: TopLevelCategory;
  subcategory: string | null;
  confidence: number;
  test: (descriptionUpper: string, amount: number) => boolean;
}

// A flat, ordered list rather than nested conditionals, so adding a new
// keyword is always just one more line appended near the relevant block
// — never a restructure. Order matters: the first matching rule wins,
// which is why transfer patterns come first (a "BPAY" payment to a
// credit card shouldn't also match a spending keyword) and income
// patterns are gated on a positive amount (so a debit description that
// happens to contain "SALARY" — e.g. paying someone else's wages via a
// business account — can't get miscategorised as income).
//
// This is a first-pass, best-effort net, not a promise of catching
// everything — every result carries a confidence score, and the
// transaction-reassignment feature is the deliberate safety net for
// whatever this misses. Keyword sets here are a reasonable starting
// point, not verified against real bank CSV wording yet — expect to
// tune this once real test-client data comes through.
function kw(
  id: string,
  keywords: string[],
  category: TopLevelCategory,
  subcategory: string | null,
  confidence = 0.8,
  extra?: (amount: number) => boolean
): Rule {
  return {
    id,
    category,
    subcategory,
    confidence,
    test: (descriptionUpper, amount) =>
      keywords.some((k) => descriptionUpper.includes(k)) && (extra ? extra(amount) : true),
  };
}

const RULES: Rule[] = [
  // ── Transfers — checked first, sign-agnostic ──────────────────────
  kw("transfer-bpay", ["BPAY"], "Transfer", null, 0.85),
  kw("transfer-generic", ["TRANSFER TO", "TRANSFER FROM", "TFR TO", "TFR FROM", " TFR ", "INTERNAL TRANSFER"], "Transfer", null, 0.75),
  kw("transfer-cc-payment", ["CREDIT CARD PAYMENT", "PAYMENT TO CR CARD", "PAY CREDIT CARD", "CARD PAYMENT"], "Transfer", null, 0.8),
  kw("transfer-payid-osko", ["PAYID", "OSKO PAYMENT"], "Transfer", null, 0.6),

  // ── Income — gated to credits only ────────────────────────────────
  kw("income-salary", ["SALARY", "WAGES", "PAYROLL"], "Income", "Salary", 0.85, (a) => a > 0),
  kw("income-dividend", ["DIVIDEND"], "Income", "Investment", 0.85, (a) => a > 0),
  kw("income-centrelink", ["CENTRELINK"], "Income", "Government", 0.9, (a) => a > 0),
  kw("income-interest", ["INTEREST PAID", "INTEREST CREDIT"], "Income", "Other", 0.7, (a) => a > 0),

  // ── Housing ────────────────────────────────────────────────────────
  kw("housing-rent-mortgage", ["MORTGAGE", "HOME LOAN", "RENT PAYMENT", "REAL ESTATE"], "Housing", "Mortgage/Rent", 0.75),
  kw("housing-rates", ["COUNCIL RATES", "CITY OF ", "SHIRE OF "], "Housing", "Rates", 0.75),
  kw("housing-insurance", ["HOME INSURANCE", "CONTENTS INSURANCE", "BUILDING INSURANCE"], "Housing", "Insurance", 0.7),

  // ── Utilities ──────────────────────────────────────────────────────
  kw("utilities-electricity", ["ELECTRICITY", "AGL ", "ORIGIN ENERGY", "ENERGY AUSTRALIA"], "Utilities", "Electricity", 0.75),
  kw("utilities-gas", [" GAS ", "GAS SUPPLY"], "Utilities", "Gas", 0.6),
  kw("utilities-water", ["WATER CORP", " WATER "], "Utilities", "Water", 0.6),
  kw("utilities-internet", ["TELSTRA", "OPTUS", "INTERNET", "BROADBAND", "NBN"], "Utilities", "Internet/Phone", 0.7),

  // ── Transport ──────────────────────────────────────────────────────
  kw("transport-fuel", ["BP ", "SHELL", "CALTEX", "7-ELEVEN", "AMPOL", "FUEL"], "Transport", "Fuel", 0.65),
  kw("transport-tolls", ["LINKT", "TOLL", "E-TAG"], "Transport", "Tolls", 0.75),
  kw("transport-public", ["METRO", "OPAL", "MYKI", "GO CARD", "PUBLIC TRANSPORT"], "Transport", "Public Transport", 0.6),
  kw("transport-insurance", ["CAR INSURANCE", "COMPREHENSIVE INSURANCE", "CTP"], "Transport", "Insurance", 0.7),

  // ── Food ───────────────────────────────────────────────────────────
  kw("food-groceries", ["WOOLWORTHS", "COLES", "ALDI", "IGA ", "SUPERMARKET"], "Food", "Groceries", 0.85),
  kw("food-dining", ["RESTAURANT", "CAFE", "UBER EATS", "MENULOG", "DOORDASH", "MCDONALD", "KFC"], "Food", "Dining", 0.7),

  // ── Health ─────────────────────────────────────────────────────────
  kw("health-insurance", ["HEALTH INSURANCE", "BUPA", "MEDIBANK", "HCF", "NIB "], "Health", "Insurance", 0.75),
  kw("health-medical", ["MEDICAL CENTRE", "GP ", "DOCTOR", "MEDICARE"], "Health", "Medical", 0.6),
  kw("health-pharmacy", ["PHARMACY", "CHEMIST"], "Health", "Pharmacy", 0.75),

  // ── Personal ───────────────────────────────────────────────────────
  kw("personal-subscriptions", ["NETFLIX", "SPOTIFY", "DISNEY+", "STAN ", "AMAZON PRIME", "SUBSCRIPTION"], "Personal", "Subscriptions", 0.8),
  kw("personal-shopping", ["KMART", "TARGET", "JB HI-FI", "MYER", "DAVID JONES", "AMAZON"], "Personal", "Shopping", 0.65),

  // ── Financial ──────────────────────────────────────────────────────
  kw("financial-fees", ["ACCOUNT FEE", "MONTHLY FEE", "SERVICE FEE", "LATE FEE", "OVERDRAWN FEE"], "Financial", "Fees", 0.75),
  kw("financial-loan", ["PERSONAL LOAN", "CAR LOAN", "LOAN REPAYMENT"], "Financial", "Loan repayments other than mortgage", 0.65),
];

export function categoriseTransaction(description: string, amount: number): CategorisationResult {
  const descriptionUpper = description.toUpperCase();
  for (const rule of RULES) {
    if (rule.test(descriptionUpper, amount)) {
      return { category: rule.category, subcategory: rule.subcategory, confidence: rule.confidence };
    }
  }
  return { category: "Other", subcategory: null, confidence: 0.2 };
}
