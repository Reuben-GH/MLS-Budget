import { describe, test, expect } from "vitest";
import { categoriseTransaction } from "../lib/categorisation/engine";

// Pure logic, no DB — the categorisation engine is a first-pass,
// keyword-based net over transaction descriptions. These tests check
// the rule-matching mechanics (transfer patterns win, income requires
// a credit, unmatched falls back to Other/low-confidence) rather than
// asserting every possible bank-wording variant is caught.

describe("Phase 3 — categoriseTransaction() transfer detection", () => {
  test("BPAY payments are flagged as Transfer", () => {
    const result = categoriseTransaction("BPAY PAYMENT TO ABC PTY LTD", -150);
    expect(result.category).toBe("Transfer");
    expect(result.subcategory).toBeNull();
    expect(result.confidence).toBeGreaterThan(0);
  });

  test("generic transfer wording is flagged as Transfer, regardless of sign", () => {
    expect(categoriseTransaction("TRANSFER TO SAVINGS", -500).category).toBe("Transfer");
    expect(categoriseTransaction("TRANSFER FROM HOLIDAY FUND", 500).category).toBe("Transfer");
  });

  test("credit card payment wording is flagged as Transfer", () => {
    expect(categoriseTransaction("CREDIT CARD PAYMENT VISA", -300).category).toBe("Transfer");
  });

  // Reproduces real client statement wording (ANZ) that the old
  // exact-phrase rule ("TRANSFER TO"/"TRANSFER FROM") missed
  // entirely: a reference number sits between "TRANSFER" and
  // "TO"/"FROM", so the two words are never actually adjacent.
  test("a transfer reference number between TRANSFER and TO/FROM still matches", () => {
    expect(
      categoriseTransaction("ANZ M-BANKING FUNDS TFER TRANSFER 097247  FROM       801990833", 1500).category
    ).toBe("Transfer");
    expect(
      categoriseTransaction("ANZ M-BANKING FUNDS TFER TRANSFER 097247  TO  015140803983506", -1500).category
    ).toBe("Transfer");
  });

  // Real client statement wording with no "to"/"from" at all.
  test("a bare 'Transfer' description (with or without Deposit/Withdrawal) matches", () => {
    expect(categoriseTransaction("Transfer", -580).category).toBe("Transfer");
    expect(categoriseTransaction("Transfer Deposit", 2000).category).toBe("Transfer");
    expect(categoriseTransaction("Transfer Withdrawal", -2000).category).toBe("Transfer");
  });

  // The real bug that made this worth fixing properly rather than
  // just adding a missed keyword: "ANZ INTERNET BANKING TRANSFER..."
  // was being actively miscategorised as Utilities/Internet-Phone,
  // because the generic "INTERNET" keyword matched "Internet Banking"
  // before any transfer rule ever got a chance to. Transfer rules run
  // first specifically to prevent this.
  test("'ANZ Internet Banking Transfer' is not miscategorised as an internet/phone bill", () => {
    const result = categoriseTransaction("ANZ INTERNET BANKING TRANSFER MVNC MCLAREN VALE NET", 386.57);
    expect(result.category).toBe("Transfer");
    expect(result.category).not.toBe("Utilities");
  });

  // The same collision as above, but without the word "TRANSFER" at
  // all — BankSA's own wording for an online-banking move between a
  // customer's own linked accounts. Reg's real statement had these
  // inflating "Utilities · Internet/Phone" by over $21,000 in a
  // single month before this rule existed.
  test("'Internet Deposit'/'Internet Withdrawal' (BankSA wording) are Transfer, not an internet/phone bill", () => {
    expect(categoriseTransaction("INTERNET DEPOSIT 06JUN 07:55", 1300).category).toBe("Transfer");
    expect(categoriseTransaction("INTERNET WITHDRAWAL 18JUN 08:40", -10).category).toBe("Transfer");
  });

  // A real client statement showed a home sale/purchase in progress —
  // these one-off capital movements were landing in Other (or, worse,
  // would have skewed Income/Expenses badly if left unclassified) for
  // amounts in the hundreds of thousands.
  test("property settlement/loan-drawdown/deposit wording is Transfer, not income or spending", () => {
    expect(categoriseTransaction("SETTLEMENT FUNDS 8A FIELD ST", 596648.25).category).toBe("Transfer");
    expect(categoriseTransaction("SETTLEMENT FUNDS 2385374 SALE", 267521.55).category).toBe("Transfer");
    expect(categoriseTransaction("LOAN DRAWDOWN", -1029802).category).toBe("Transfer");
    expect(categoriseTransaction("PROCEEDS OF LOAN DRAWDOWN FROM 7379-22149", 47457.43).category).toBe("Transfer");
    expect(categoriseTransaction("House Deposit", 50000).category).toBe("Transfer");
  });

  // "AFSH NOM" is a renovation finance facility for a bathroom
  // renovation on the new property — the drawdown (credit) is
  // borrowed money, not income, so it's Transfer like the other
  // property-related capital movements above. Its own repayments
  // (debit) are a different story — see the Financial describe block
  // below, since those ARE a genuine ongoing cost.
  test("an AFSH NOM drawdown (credit) is Transfer, not income", () => {
    const result = categoriseTransaction("Direct Credit Afsh Nom - 702234", 22956);
    expect(result.category).toBe("Transfer");
  });

  // Tara Lampe is a joint account holder (the client) — money moving
  // to/from her own name, and the matching "Loan Payment" credit that
  // precedes it, are internal transfers, not third-party spending.
  test("payments to/from a named joint account holder are Transfer", () => {
    expect(categoriseTransaction("Payment to Lampe Tara", -6120.57).category).toBe("Transfer");
    expect(categoriseTransaction("Payment from Tara Lampe", 1769).category).toBe("Transfer");
    expect(categoriseTransaction("Loan Payment", 6120.57).category).toBe("Transfer");
  });

  // The credit-only gate on "Loan Payment" must not swallow an
  // unrelated debit — an actual outgoing loan repayment worded that
  // way elsewhere is a real expense, not a transfer.
  test("a debit worded 'Loan Payment' is not swept into Transfer by the credit-gated rule", () => {
    const result = categoriseTransaction("Loan Payment", -500);
    expect(result.category).not.toBe("Transfer");
  });
});

describe("Phase 3 — categoriseTransaction() income requires a credit", () => {
  test("a credit matching SALARY is categorised as Income/Salary", () => {
    const result = categoriseTransaction("SALARY XYZ PTY LTD", 6200);
    expect(result.category).toBe("Income");
    expect(result.subcategory).toBe("Salary");
  });

  test("a debit that happens to contain SALARY does not match the income rule", () => {
    // e.g. a business account paying wages out — must not be miscategorised as household income.
    const result = categoriseTransaction("SALARY PAYMENT RUN", -6200);
    expect(result.category).not.toBe("Income");
  });

  // Real BankSA statement wording — reversed from the original
  // "Interest Credit" phrasing this rule only used to catch, which
  // silently sent every real interest payment to Other instead.
  test("'Credit Interest' and 'Bonus Interest' (BankSA wording) are categorised as Income", () => {
    expect(categoriseTransaction("CREDIT INTEREST", 2.36).category).toBe("Income");
    expect(categoriseTransaction("BONUS INTEREST", 26.85).category).toBe("Income");
  });

  // The SA Department for Education's payroll system doesn't say
  // "SALARY" at all — just a bare "EDU" or "Direct Credit EDU - <ref>".
  test("'EDU' payroll wording (SA Dept for Education) is categorised as Income/Salary", () => {
    expect(categoriseTransaction("EDU", 3169.6).category).toBe("Income");
    expect(categoriseTransaction("Direct Credit Edu - 4213243", 3391.47).subcategory).toBe("Salary");
  });

  // "EDU" is deliberately word-bounded, not a plain substring match —
  // this must NOT fire on an unrelated word that happens to contain
  // "edu" in the middle, e.g. "SCHEDULED".
  test("a word merely containing 'edu' (not the standalone SA payroll code) is not miscategorised as income", () => {
    const result = categoriseTransaction("SCHEDULED PAYMENT TO LANDLORD", 1200);
    expect(result.category).not.toBe("Income");
  });
});

describe("Phase 3 — categoriseTransaction() home loan interest (debit)", () => {
  // Distinct from the Income "Credit Interest" rule above — this is
  // the mortgage's interest CHARGE, money going the other way, from a
  // real client statement mid home purchase.
  test("a debit 'Interest' line is categorised as Housing/Mortgage-Rent, not Income", () => {
    const result = categoriseTransaction("INTEREST", -2625.4);
    expect(result.category).toBe("Housing");
    expect(result.subcategory).toBe("Mortgage/Rent");
  });
});

describe("Phase 3 — categoriseTransaction() AFSH NOM renovation facility (debit)", () => {
  // The repayment side of the same AFSH NOM renovation facility whose
  // drawdown (credit) is tested as Transfer above — unlike the
  // one-off drawdown, these recurring repayments are a genuine
  // ongoing cost and belong in the budget as a real expense.
  test("an AFSH NOM repayment (debit) is Financial/Loan repayments, not Transfer", () => {
    const result = categoriseTransaction("Direct Debit Afsh Nom - Afsh Nom", -297.95);
    expect(result.category).toBe("Financial");
    expect(result.subcategory).toBe("Loan repayments other than mortgage");
  });
});

describe("Phase 3 — categoriseTransaction() spending categories", () => {
  test("supermarket descriptions map to Food/Groceries", () => {
    expect(categoriseTransaction("WOOLWORTHS 2145", -142.35).category).toBe("Food");
    expect(categoriseTransaction("WOOLWORTHS 2145", -142.35).subcategory).toBe("Groceries");
  });

  test("fuel descriptions map to Transport/Fuel", () => {
    expect(categoriseTransaction("SHELL COLES EXPRESS", -78.5).category).toBe("Transport");
  });

  test("subscription services map to Personal/Subscriptions", () => {
    expect(categoriseTransaction("NETFLIX.COM", -22.99).subcategory).toBe("Subscriptions");
  });
});

describe("Phase 3 — categoriseTransaction() fallback", () => {
  test("an unrecognised description falls back to Other with low confidence", () => {
    const result = categoriseTransaction("XKCD RANDOM MERCHANT 9182", -47.5);
    expect(result.category).toBe("Other");
    expect(result.subcategory).toBeNull();
    expect(result.confidence).toBeLessThan(0.5);
  });
});
