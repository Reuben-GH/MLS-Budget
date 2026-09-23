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
  // Matches the bare word "TRANSFER" (and its bank-abbreviated forms
  // TFR/TFER), not just an exact "TRANSFER TO"/"TRANSFER FROM" phrase
  // — real bank descriptions often insert a reference number between
  // "TRANSFER" and "TO"/"FROM" (e.g. "FUNDS TFER TRANSFER 097247
  // FROM 801990833"), or have no TO/FROM at all ("Transfer Deposit",
  // "Transfer Withdrawal"). Checked before every other rule (Transfer
  // is first in this list) specifically so "ANZ INTERNET BANKING
  // TRANSFER..." can't be caught by the Utilities "INTERNET" keyword
  // instead — that collision was a real miscategorisation, not just
  // a missed one.
  kw("transfer-generic", ["TRANSFER", "TFER", "TFR TO", "TFR FROM", " TFR "], "Transfer", null, 0.75),
  kw("transfer-cc-payment", ["CREDIT CARD PAYMENT", "PAYMENT TO CR CARD", "PAY CREDIT CARD", "CARD PAYMENT"], "Transfer", null, 0.8),
  kw("transfer-payid-osko", ["PAYID", "OSKO PAYMENT"], "Transfer", null, 0.6),
  // "Internet Deposit"/"Internet Withdrawal" (BankSA wording) mean a
  // transfer made via online banking, not an internet/phone bill —
  // without this, the bare "INTERNET" keyword in the Utilities rule
  // below catches them first, the same class of collision the
  // transfer-generic rule above was already fixed to prevent.
  kw("transfer-internet-banking", ["INTERNET DEPOSIT", "INTERNET WITHDRAWAL"], "Transfer", null, 0.6),
  // A property sale/purchase in progress: proceeds from selling the
  // old home, drawing down the new mortgage, and the deposit paid —
  // one-off capital events, not regular income or discretionary
  // spending. Left in Other/Income/Expenses they'd badly distort a
  // single month's totals (a $596k "income" month); Transfer is
  // already excluded from both, same as any other money movement
  // that isn't really a household's ongoing cashflow.
  kw(
    "transfer-property-settlement",
    ["SETTLEMENT FUNDS", "LOAN DRAWDOWN", "PROCEEDS OF LOAN DRAWDOWN", "HOUSE DEPOSIT"],
    "Transfer",
    null,
    0.7
  ),
  // A renovation finance facility ("AFSH NOM") for the bathroom
  // renovation on the new property: the drawdown itself is borrowed
  // money, not income — gated to credits only so it doesn't also
  // swallow the facility's own repayments (see financial-afsh-nom
  // below, further down, which is gated the other way).
  kw("transfer-afsh-nom-drawdown", ["AFSH NOM"], "Transfer", null, 0.65, (a) => a > 0),
  // Tara Lampe is a joint account holder (the client herself) — money
  // moving to or from her own name is an internal transfer between
  // the couple's own accounts, not third-party spending or income.
  kw("transfer-tara-lampe", ["LAMPE TARA", "TARA LAMPE"], "Transfer", null, 0.6),
  // Paired with the transfer above: a same-amount "Loan Payment"
  // credit lands first, then moves straight across to Tara's account.
  // Gated to credits only so an unrelated debit "loan payment" (an
  // actual outgoing repayment) isn't swept up here instead of being
  // treated as a real expense.
  kw("transfer-loan-payment-credit", ["LOAN PAYMENT"], "Transfer", null, 0.6, (a) => a > 0),

  // ── Income — gated to credits only ────────────────────────────────
  kw("income-salary", ["SALARY", "WAGES", "PAYROLL"], "Income", "Salary", 0.85, (a) => a > 0),
  // The SA Department for Education's payroll system posts as a bare
  // "EDU" or "Direct Credit EDU - <ref>" — no "SALARY" wording at
  // all. Word-bounded (\bEDU\b) rather than a plain substring match,
  // since "EDU" alone as a bare .includes() check would also fire on
  // an unrelated word like "SCHEDULED" ("...SCH[EDU]LED...").
  {
    id: "income-sa-education-dept",
    category: "Income",
    subcategory: "Salary",
    confidence: 0.75,
    test: (d, a) => a > 0 && /\bEDU\b/.test(d),
  },
  kw("income-dividend", ["DIVIDEND"], "Income", "Investment", 0.85, (a) => a > 0),
  kw("income-centrelink", ["CENTRELINK"], "Income", "Government", 0.9, (a) => a > 0),
  // BankSA (and likely other banks) write this the other way round —
  // "Credit Interest" / "Bonus Interest" — which the original
  // "Interest Credit" phrasing never matched, silently dumping real
  // interest income into Other.
  kw("income-interest", ["INTEREST PAID", "INTEREST CREDIT", "CREDIT INTEREST", "BONUS INTEREST"], "Income", "Other", 0.7, (a) => a > 0),

  // ── Housing ────────────────────────────────────────────────────────
  kw("housing-rent-mortgage", ["MORTGAGE", "HOME LOAN", "RENT PAYMENT", "REAL ESTATE"], "Housing", "Mortgage/Rent", 0.75),
  kw("housing-rates", ["COUNCIL RATES", "CITY OF ", "SHIRE OF "], "Housing", "Rates", 0.75),
  kw("housing-insurance", ["HOME INSURANCE", "CONTENTS INSURANCE", "BUILDING INSURANCE"], "Housing", "Insurance", 0.7),
  // A bare "Interest" debit is the home loan's interest charge — the
  // Income section above already claims a credit "Interest" line
  // (bank-paid savings interest) first, so by the time a description
  // reaches this rule it's only ever the money going the other way.
  kw("housing-loan-interest", ["INTEREST"], "Housing", "Mortgage/Rent", 0.55, (a) => a < 0),

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
  // The AFSH NOM renovation facility's own repayments (the debit side
  // — see transfer-afsh-nom-drawdown above for the credit/drawdown
  // side) are a genuine ongoing cost, unlike the one-off drawdown, so
  // they belong in the budget as a real expense rather than Transfer.
  kw("financial-afsh-nom-repayment", ["AFSH NOM"], "Financial", "Loan repayments other than mortgage", 0.65, (a) => a < 0),
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
