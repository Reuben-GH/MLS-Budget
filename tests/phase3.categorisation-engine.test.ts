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
