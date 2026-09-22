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
