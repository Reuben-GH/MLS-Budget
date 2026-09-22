import { describe, test, expect } from "vitest";
import { guessColumnMapping, parseDate, parseAmount, mapRows } from "../lib/statements/csv-mapping";

describe("Phase 3 — guessColumnMapping() header heuristics", () => {
  test("recognises a single signed-amount format", () => {
    const guess = guessColumnMapping(["Date", "Description", "Amount"]);
    expect(guess.dateColumn).toBe("Date");
    expect(guess.descriptionColumn).toBe("Description");
    expect(guess.amountMode).toBe("single");
    expect(guess.amountColumn).toBe("Amount");
  });

  test("recognises a debit/credit split format", () => {
    const guess = guessColumnMapping(["Date", "Narrative", "Debit", "Credit", "Balance"]);
    expect(guess.descriptionColumn).toBe("Narrative");
    expect(guess.amountMode).toBe("debit-credit");
    expect(guess.debitColumn).toBe("Debit");
    expect(guess.creditColumn).toBe("Credit");
  });

  test("is case-insensitive and matches partial header names", () => {
    const guess = guessColumnMapping(["Transaction Date", "Transaction Details", "Amount (AUD)"]);
    expect(guess.dateColumn).toBe("Transaction Date");
    expect(guess.descriptionColumn).toBe("Transaction Details");
    expect(guess.amountColumn).toBe("Amount (AUD)");
  });
});

describe("Phase 3 — parseDate()", () => {
  test("DMY (Australian convention)", () => {
    expect(parseDate("03/04/2026", "DMY")).toBe("2026-04-03");
  });
  test("MDY (US convention)", () => {
    expect(parseDate("03/04/2026", "MDY")).toBe("2026-03-04");
  });
  test("YMD (ISO-ish)", () => {
    expect(parseDate("2026-04-03", "YMD")).toBe("2026-04-03");
  });
  test("2-digit years are assumed 20xx", () => {
    expect(parseDate("03/04/26", "DMY")).toBe("2026-04-03");
  });
  test("throws on an unparseable date", () => {
    expect(() => parseDate("not a date", "DMY")).toThrow();
  });
  // A real client statement (UBank, exported as .xlsx) had dates with
  // a trailing time-of-day, e.g. "9/20/26 17:10" — only the date
  // portion should ever be parsed.
  test("a trailing time-of-day component is ignored", () => {
    expect(parseDate("20/09/2026 17:10", "DMY")).toBe("2026-09-20");
    expect(parseDate("9/20/26 17:10", "MDY")).toBe("2026-09-20");
  });
  // Another real client statement had a mixed date column: some rows
  // were genuine Excel date cells (normalised to ISO by
  // xlsx-mapping.ts's sheetToRows before this ever runs), others were
  // plain text dates in the column's actual US format. One format
  // picker can't describe both — an already-ISO value must parse
  // correctly no matter what format is selected for the rest of the
  // column, since it was never ambiguous to begin with.
  test("an already-ISO date is used directly regardless of the selected format", () => {
    expect(parseDate("2026-09-03", "MDY")).toBe("2026-09-03");
    expect(parseDate("2026-09-03", "DMY")).toBe("2026-09-03");
  });
  test("a genuinely invalid ISO-shaped date still throws", () => {
    expect(() => parseDate("2026-13-40", "MDY")).toThrow();
  });
});

describe("Phase 3 — parseAmount()", () => {
  test("plain decimal", () => {
    expect(parseAmount("142.35")).toBeCloseTo(142.35, 2);
  });
  test("negative sign", () => {
    expect(parseAmount("-142.35")).toBeCloseTo(-142.35, 2);
  });
  test("dollar sign and thousands separator", () => {
    expect(parseAmount("$1,234.56")).toBeCloseTo(1234.56, 2);
  });
  test("accounting-style parentheses mean negative", () => {
    expect(parseAmount("(99.00)")).toBeCloseTo(-99.0, 2);
  });
});

describe("Phase 3 — mapRows()", () => {
  test("single-amount-column mapping", () => {
    const rows = [{ Date: "03/04/2026", Description: "WOOLWORTHS", Amount: "-142.35" }];
    const mapped = mapRows(rows, {
      dateColumn: "Date",
      descriptionColumn: "Description",
      amountMode: "single",
      amountColumn: "Amount",
      dateFormat: "DMY",
    });
    expect(mapped).toEqual([{ txn_date: "2026-04-03", description: "WOOLWORTHS", amount: -142.35 }]);
  });

  test("debit/credit-column mapping combines into a signed amount", () => {
    const rows = [
      { Date: "03/04/2026", Narrative: "WOOLWORTHS", Debit: "142.35", Credit: "" },
      { Date: "04/04/2026", Narrative: "SALARY", Debit: "", Credit: "6200.00" },
    ];
    const mapped = mapRows(rows, {
      dateColumn: "Date",
      descriptionColumn: "Narrative",
      amountMode: "debit-credit",
      debitColumn: "Debit",
      creditColumn: "Credit",
      dateFormat: "DMY",
    });
    expect(mapped[0].amount).toBeCloseTo(-142.35, 2);
    expect(mapped[1].amount).toBeCloseTo(6200.0, 2);
  });

  test("throws with a helpful row number on a missing description", () => {
    const rows = [{ Date: "03/04/2026", Description: "", Amount: "-10" }];
    expect(() =>
      mapRows(rows, {
        dateColumn: "Date",
        descriptionColumn: "Description",
        amountMode: "single",
        amountColumn: "Amount",
        dateFormat: "DMY",
      })
    ).toThrow(/Row 1/);
  });
});
