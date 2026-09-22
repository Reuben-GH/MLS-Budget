import { describe, test, expect } from "vitest";
import {
  reconstructLines,
  matchTransactionLine,
  extractTransactionCandidates,
  toImportRows,
  deriveStatementStartYear,
  type TextFragment,
} from "../lib/statements/pdf-mapping";

describe("Phase 3 — reconstructLines()", () => {
  test("groups fragments on the same Y into one line, reading left to right", () => {
    // Deliberately out of both reading order and insertion order —
    // real PDF text streams aren't guaranteed to come out in visual
    // order, which is exactly why position-based reconstruction is
    // needed at all.
    const fragments: TextFragment[] = [
      { text: "142.35", x: 400, y: 700 },
      { text: "03/09/2026", x: 50, y: 700 },
      { text: "WOOLWORTHS", x: 150, y: 700 },
    ];
    expect(reconstructLines(fragments)).toEqual(["03/09/2026 WOOLWORTHS 142.35"]);
  });

  test("separates fragments on different Y into different lines, top to bottom", () => {
    // PDF Y increases upward — the higher Y value is the visually
    // higher (earlier) line on the page.
    const fragments: TextFragment[] = [
      { text: "second line", x: 50, y: 680 },
      { text: "first line", x: 50, y: 700 },
    ];
    expect(reconstructLines(fragments)).toEqual(["first line", "second line"]);
  });

  test("small Y jitter within tolerance still counts as the same line", () => {
    // Real PDFs commonly have sub-pixel Y variance between fragments
    // on the same visual line (different fonts/baselines).
    const fragments: TextFragment[] = [
      { text: "A", x: 50, y: 700.0 },
      { text: "B", x: 100, y: 701.5 },
    ];
    expect(reconstructLines(fragments)).toEqual(["A B"]);
  });

  test("empty input produces no lines", () => {
    expect(reconstructLines([])).toEqual([]);
  });
});

describe("Phase 3 — matchTransactionLine()", () => {
  test("a numeric date + single amount line is recognised, date left ambiguous for the picker", () => {
    const result = matchTransactionLine("03/09/2026 WOOLWORTHS 2145 142.35");
    expect(result).toEqual({
      dateToken: { kind: "numeric", raw: "03/09/2026" },
      description: "WOOLWORTHS 2145",
      amountTokens: ["142.35"],
    });
  });

  test("a written date with an explicit year is recognised", () => {
    const result = matchTransactionLine("03 Sep 2026 WOOLWORTHS 2145 142.35");
    expect(result).toEqual({
      dateToken: { kind: "written", day: "03", month: "Sep", year: "2026" },
      description: "WOOLWORTHS 2145",
      amountTokens: ["142.35"],
    });
  });

  // Real bank statements (e.g. BankSA) commonly print only "28 MAY" on
  // every transaction line — the year is stated once for the whole
  // statement, not repeated per row.
  test("a written date with no year at all is still recognised", () => {
    const result = matchTransactionLine("31 MAY CREDIT INTEREST 2.36 6,732.38");
    expect(result?.dateToken).toEqual({ kind: "written", day: "31", month: "MAY", year: null });
  });

  test("a negative amount (leading minus) is captured", () => {
    const result = matchTransactionLine("03/09/2026 AGL ELECTRICITY -210.00");
    expect(result?.amountTokens).toEqual(["-210.00"]);
  });

  test("a trailing DR/CR suffix is captured", () => {
    expect(matchTransactionLine("03/09/2026 EFTPOS PURCHASE 45.00 DR")?.amountTokens).toEqual(["45.00 DR"]);
    expect(matchTransactionLine("03/09/2026 SALARY DEPOSIT 2000.00 CR")?.amountTokens).toEqual(["2000.00 CR"]);
  });

  // Real running-balance statements print two numbers per line — the
  // transaction amount, then the balance after it — with nothing in
  // the extracted text to say which is which beyond position.
  test("two trailing amounts (transaction amount, then balance) are both captured in order", () => {
    const result = matchTransactionLine("18 JUN BUPA AUSTRALIA 367.04 7,615.34");
    expect(result?.amountTokens).toEqual(["367.04", "7,615.34"]);
    expect(result?.description).toBe("BUPA AUSTRALIA");
  });

  test("a glued same-day timestamp is stripped from the description", () => {
    const result = matchTransactionLine("06 JUN INTERNET DEPOSIT 06JUN 07:55 1,300.00 8,032.38");
    expect(result?.description).toBe("INTERNET DEPOSIT");
  });

  test("a header/footer/balance-summary line with no transaction shape is rejected", () => {
    expect(matchTransactionLine("Statement Period: 1 September 2025 to 30 September 2026")).toBeNull();
    expect(matchTransactionLine("Page 3 of 12")).toBeNull();
    expect(matchTransactionLine("Date Description Amount")).toBeNull(); // a header row, no amount shape
    expect(matchTransactionLine("Date Transaction Description Debit Credit Balance $")).toBeNull();
  });

  test("a date and amount with nothing in between (no description) is rejected", () => {
    expect(matchTransactionLine("03/09/2026 142.35")).toBeNull();
  });
});

describe("Phase 3 — deriveStatementStartYear()", () => {
  test("reads the start year out of a stated statement period", () => {
    const lines = ["Statement Period 28/05/2025 to 27/11/2025"];
    expect(deriveStatementStartYear(lines)).toBe(2025);
  });

  test("falls back to any 4-digit year found when there's no stated period", () => {
    expect(deriveStatementStartYear(["Some statement from 2024 with no period line"])).toBe(2024);
  });

  test("returns null when nothing looks like a year", () => {
    expect(deriveStatementStartYear(["No dates here at all"])).toBeNull();
  });
});

describe("Phase 3 — extractTransactionCandidates()", () => {
  test("filters a mix of real lines and noise down to just the transactions", () => {
    const lines = [
      "My Bank — Transaction Statement",
      "Date Description Amount",
      "03/09/2026 WOOLWORTHS 2145 142.35",
      "04/09/2026 AGL ELECTRICITY -210.00",
      "Closing Balance $1,234.56",
      "Page 1 of 1",
    ];
    const candidates = extractTransactionCandidates(lines);
    expect(candidates).toHaveLength(2);
    expect(candidates[0].description).toBe("WOOLWORTHS 2145");
    expect(candidates[1].description).toBe("AGL ELECTRICITY");
  });

  test("OPENING BALANCE / CLOSING BALANCE lines anchor the running balance but are never transactions", () => {
    const lines = [
      "Statement Period 01/01/2026 to 31/01/2026",
      "28 MAY OPENING BALANCE 1,000.00",
      "31 MAY CREDIT INTEREST 2.36 1,002.36",
      "27 NOV CLOSING BALANCE 1,002.36",
    ];
    const candidates = extractTransactionCandidates(lines);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].description).toBe("CREDIT INTEREST");
    expect(candidates[0].rawAmount).toBe("2.36");
  });

  test("a two-amount (transaction, balance) line resolves its sign from the balance movement, not the raw token", () => {
    const lines = [
      "Statement Period 01/01/2026 to 31/01/2026",
      "01 JAN OPENING BALANCE 1,000.00",
      "02 JAN WITHDRAWAL 200.00 800.00", // balance dropped -> debit
      "03 JAN DEPOSIT 50.00 850.00", // balance rose -> credit
    ];
    const candidates = extractTransactionCandidates(lines);
    expect(candidates.map((c) => c.rawAmount)).toEqual(["-200.00", "50.00"]);
  });

  // A real BankSA statement line: a debit that overdraws the account
  // (shown with a trailing "-" negative balance), reversed the next
  // day by a dishonour credit that restores the original balance.
  // Column position alone can't tell a "DISHONOUR" line's sign, but
  // the balance movement always can.
  test("a negative running balance and its reversal both resolve correctly via balance movement", () => {
    const lines = [
      "Statement Period 28/05/2025 to 27/11/2025",
      "28 MAY OPENING BALANCE 21.07",
      "20 OCT BUPA AUSTRALIA 367.04 345.97 -",
      "21 OCT DIRECT DEBIT DISHONOUR 367.04 21.07",
    ];
    const candidates = extractTransactionCandidates(lines);
    expect(candidates.map((c) => c.rawAmount)).toEqual(["-367.04", "367.04"]);
  });

  test("a written date with no year infers the year from the statement period, wrapping forward across a Dec/Jan boundary", () => {
    const lines = [
      "Statement Period 15/12/2025 to 15/01/2026",
      "20 DEC OPENING BALANCE 100.00",
      "22 DEC CHRISTMAS SHOPPING 20.00 80.00",
      "05 JAN NEW YEAR SALE 10.00 CR 90.00",
    ];
    const candidates = extractTransactionCandidates(lines);
    expect(candidates.map((c) => c.rawDate)).toEqual(["2025-12-22", "2026-01-05"]);
  });

  // The full transaction sequence of Reg's real BankSA "Incentive
  // Saver" statement — the file the app failed to read at all before
  // this rework (BankSA prints "28 MAY" with no year, and a running
  // balance instead of a signed amount, which the original
  // single-amount/explicit-year extraction never matched). Every
  // expected amount below is the actual delta between consecutive
  // balance figures as printed on the real statement, so this is also
  // an end-to-end check that chained balance resolution stays correct
  // over a long, realistic statement rather than just two-line
  // snippets.
  test("the full real BankSA statement extracts correctly end to end", () => {
    const lines = [
      "Statement Period 28/05/2025 to 27/11/2025",
      "28 MAY OPENING BALANCE 6,730.02",
      "31 MAY CREDIT INTEREST 2.36 6,732.38",
      "06 JUN INTERNET DEPOSIT 06JUN 07:55 1,300.00 8,032.38",
      "18 JUN INTERNET WITHDRAWAL 18JUN 08:40 10.00 8,022.38",
      "18 JUN INTERNET WITHDRAWAL 18JUN 11:21 40.00 7,982.38",
      "18 JUN BUPA AUSTRALIA 367.04 7,615.34",
      "30 JUN CREDIT INTEREST 2.51 7,617.85",
      "30 JUN BONUS INTEREST 26.85 7,644.70",
      "04 JUL INTERNET DEPOSIT 04JUL 08:31 1,000.00 8,644.70",
      "10 JUL INTERNET WITHDRAWAL 10JUL 12:23 600.00 8,044.70",
      "14 JUL INTERNET WITHDRAWAL 13JUL 16:26 500.00 7,544.70",
      "15 JUL INTERNET WITHDRAWAL 15JUL 10:07 500.00 7,044.70",
      "17 JUL INTERNET DEPOSIT 17JUL 09:17 1,000.00 8,044.70",
      "18 JUL TERM DEP FUNDS 12,000.00 20,044.70",
      "18 JUL BUPA AUSTRALIA 367.04 19,677.66",
      "31 JUL CREDIT INTEREST 4.51 19,682.17",
      "31 JUL BONUS INTEREST 47.93 19,730.10",
      "SUB TOTAL CARRIED FORWARD TO NEXT PAGE 19,730.10",
      "05 AUG INTERNET WITHDRAWAL 05AUG 15:03 1,700.00 18,030.10",
      "18 AUG INTERNET DEPOSIT 17AUG 09:16 1,100.00 19,130.10",
      "19 AUG BUPA AUSTRALIA 367.04 18,763.06",
      "25 AUG INTERNET WITHDRAWAL 24AUG 13:19 200.00 18,563.06",
      "30 AUG CREDIT INTEREST 6.31 18,569.37",
      "16 SEP INTERNET DEPOSIT 16SEP 08:55 1,200.00 19,769.37",
      "18 SEP BUPA AUSTRALIA 367.04 19,402.33",
      "30 SEP CREDIT INTEREST 5.29 19,407.62",
      "30 SEP BONUS INTEREST 63.45 19,471.07",
      "08 OCT INTERNET WITHDRAWAL 08OCT 13:12 300.00 19,171.07",
      "15 OCT INTERNET WITHDRAWAL 15OCT 19:06 500.00 18,671.07",
      "15 OCT INTERNET WITHDRAWAL 15OCT 19:08 18,650.00 21.07",
      "20 OCT BUPA AUSTRALIA 367.04 345.97 -",
      "21 OCT DIRECT DEBIT DISHONOUR 367.04 21.07",
      "22 OCT OSKO DEPOSIT 22OCT 12:35 50,000.00 50,021.07",
      "31 OCT CREDIT INTEREST 5.27 50,026.34",
      "31 OCT BONUS INTEREST 87.64 50,113.98",
      "03 NOV INTERNET WITHDRAWAL 03NOV 09:29 2,500.00 47,613.98",
      "05 NOV BUPA AUSTRALIA 379.14 47,234.84",
      "10 NOV INTERNET DEPOSIT 09NOV 09:10 800.00 48,034.84",
      "11 NOV INTERNET WITHDRAWAL 11NOV 16:36 24,000.00 24,034.84",
      "18 NOV BUPA AUSTRALIA 367.04 23,667.80",
      "27 NOV CLOSING BALANCE 23,667.80",
    ];
    const candidates = extractTransactionCandidates(lines);
    const { rows, skipped } = toImportRows(candidates, "DMY");
    expect(skipped).toBe(0);
    expect(rows).toEqual([
      { txn_date: "2025-05-31", description: "CREDIT INTEREST", amount: 2.36 },
      { txn_date: "2025-06-06", description: "INTERNET DEPOSIT", amount: 1300.0 },
      { txn_date: "2025-06-18", description: "INTERNET WITHDRAWAL", amount: -10.0 },
      { txn_date: "2025-06-18", description: "INTERNET WITHDRAWAL", amount: -40.0 },
      { txn_date: "2025-06-18", description: "BUPA AUSTRALIA", amount: -367.04 },
      { txn_date: "2025-06-30", description: "CREDIT INTEREST", amount: 2.51 },
      { txn_date: "2025-06-30", description: "BONUS INTEREST", amount: 26.85 },
      { txn_date: "2025-07-04", description: "INTERNET DEPOSIT", amount: 1000.0 },
      { txn_date: "2025-07-10", description: "INTERNET WITHDRAWAL", amount: -600.0 },
      { txn_date: "2025-07-14", description: "INTERNET WITHDRAWAL", amount: -500.0 },
      { txn_date: "2025-07-15", description: "INTERNET WITHDRAWAL", amount: -500.0 },
      { txn_date: "2025-07-17", description: "INTERNET DEPOSIT", amount: 1000.0 },
      { txn_date: "2025-07-18", description: "TERM DEP FUNDS", amount: 12000.0 },
      { txn_date: "2025-07-18", description: "BUPA AUSTRALIA", amount: -367.04 },
      { txn_date: "2025-07-31", description: "CREDIT INTEREST", amount: 4.51 },
      { txn_date: "2025-07-31", description: "BONUS INTEREST", amount: 47.93 },
      { txn_date: "2025-08-05", description: "INTERNET WITHDRAWAL", amount: -1700.0 },
      { txn_date: "2025-08-18", description: "INTERNET DEPOSIT", amount: 1100.0 },
      { txn_date: "2025-08-19", description: "BUPA AUSTRALIA", amount: -367.04 },
      { txn_date: "2025-08-25", description: "INTERNET WITHDRAWAL", amount: -200.0 },
      { txn_date: "2025-08-30", description: "CREDIT INTEREST", amount: 6.31 },
      { txn_date: "2025-09-16", description: "INTERNET DEPOSIT", amount: 1200.0 },
      { txn_date: "2025-09-18", description: "BUPA AUSTRALIA", amount: -367.04 },
      { txn_date: "2025-09-30", description: "CREDIT INTEREST", amount: 5.29 },
      { txn_date: "2025-09-30", description: "BONUS INTEREST", amount: 63.45 },
      { txn_date: "2025-10-08", description: "INTERNET WITHDRAWAL", amount: -300.0 },
      { txn_date: "2025-10-15", description: "INTERNET WITHDRAWAL", amount: -500.0 },
      { txn_date: "2025-10-15", description: "INTERNET WITHDRAWAL", amount: -18650.0 },
      { txn_date: "2025-10-20", description: "BUPA AUSTRALIA", amount: -367.04 },
      { txn_date: "2025-10-21", description: "DIRECT DEBIT DISHONOUR", amount: 367.04 },
      { txn_date: "2025-10-22", description: "OSKO DEPOSIT", amount: 50000.0 },
      { txn_date: "2025-10-31", description: "CREDIT INTEREST", amount: 5.27 },
      { txn_date: "2025-10-31", description: "BONUS INTEREST", amount: 87.64 },
      { txn_date: "2025-11-03", description: "INTERNET WITHDRAWAL", amount: -2500.0 },
      { txn_date: "2025-11-05", description: "BUPA AUSTRALIA", amount: -379.14 },
      { txn_date: "2025-11-10", description: "INTERNET DEPOSIT", amount: 800.0 },
      { txn_date: "2025-11-11", description: "INTERNET WITHDRAWAL", amount: -24000.0 },
      { txn_date: "2025-11-18", description: "BUPA AUSTRALIA", amount: -367.04 },
    ]);
  });
});

describe("Phase 3 — toImportRows()", () => {
  test("converts candidates to the same ImportRow shape CSV/Excel rows use", () => {
    const candidates = extractTransactionCandidates([
      "03/09/2026 WOOLWORTHS 2145 142.35",
      "18/03/2026 DIVIDEND CBA SHARES 185.40 CR",
    ]);
    const { rows, skipped } = toImportRows(candidates, "DMY");
    expect(skipped).toBe(0);
    expect(rows).toEqual([
      { txn_date: "2026-09-03", description: "WOOLWORTHS 2145", amount: 142.35 },
      { txn_date: "2026-03-18", description: "DIVIDEND CBA SHARES", amount: 185.4 },
    ]);
  });

  // Mirrors xlsx-mapping.ts's mixed-column scenario: a written-month
  // line (already ISO, unambiguous) alongside a numeric-date line
  // (genuinely ambiguous, resolved by whichever format is selected)
  // in the same statement — both must parse correctly together.
  test("a written-month row and a numeric-date row coexist correctly under one selected format", () => {
    const candidates = extractTransactionCandidates([
      "03 Sep 2026 CAFE PURCHASE 12.50",
      "9/18/26 TEXT US FORMAT PURCHASE 75.00",
    ]);
    const { rows, skipped } = toImportRows(candidates, "MDY");
    expect(skipped).toBe(0);
    expect(rows).toEqual([
      { txn_date: "2026-09-03", description: "CAFE PURCHASE", amount: 12.5 },
      { txn_date: "2026-09-18", description: "TEXT US FORMAT PURCHASE", amount: 75.0 },
    ]);
  });

  test("a candidate that fails to parse is skipped rather than failing the whole batch", () => {
    // 13 isn't a valid month under any format — matchTransactionLine
    // would have accepted "13/40/2026" as date-shaped, but parseDate
    // correctly rejects it once actually parsed.
    const candidates = extractTransactionCandidates([
      "03/09/2026 GOOD ROW 142.35",
      "13/40/2026 BAD DATE ROW 50.00",
    ]);
    const { rows, skipped } = toImportRows(candidates, "DMY");
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toBe("GOOD ROW");
    expect(skipped).toBe(1);
  });
});
