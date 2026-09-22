import { describe, test, expect } from "vitest";
import * as XLSX from "xlsx";
import { sheetToRows, parseWorkbook } from "../lib/statements/xlsx-mapping";
import { guessColumnMapping, mapRows } from "../lib/statements/csv-mapping";

// Builds a real .xlsx file's bytes and reads them back through the
// exact same parseWorkbook() a real upload goes through. This
// matters more than it looks: a worksheet built in-memory via
// XLSX.utils.aoa_to_sheet and used directly (no write/read round
// trip) behaves differently from a genuinely parsed file — a date
// cell only comes back as a real Date value if parseWorkbook's
// cellDates option is doing its job at *read* time. A test that
// skips this round trip would pass even if that option were removed,
// which is exactly the bug this suite exists to catch.
function roundTripSheet(rows: unknown[][]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as unknown as ArrayBuffer;
  const parsed = parseWorkbook(buf);
  return parsed.Sheets[parsed.SheetNames[0]];
}

describe("Phase 3 — sheetToRows()", () => {
  test("extracts headers and text-cell rows the same shape Papa.parse produces for CSV", () => {
    const ws = roundTripSheet([
      ["Date", "Description", "Amount"],
      ["03/03/2026", "WOOLWORTHS 2145", -142.35],
      ["05/03/2026", "AGL ELECTRICITY", -210],
    ]);
    const { headers, rows, hasNormalizedDates } = sheetToRows(ws);
    expect(headers).toEqual(["Date", "Description", "Amount"]);
    expect(rows).toEqual([
      { Date: "03/03/2026", Description: "WOOLWORTHS 2145", Amount: "-142.35" },
      { Date: "05/03/2026", Description: "AGL ELECTRICITY", Amount: "-210" },
    ]);
    // These date cells are plain text strings in the source array, not
    // genuine Excel date cells, so no normalisation applies.
    expect(hasNormalizedDates).toBe(false);
  });

  // Reproduces the real bug a client statement (UBank, exported as
  // .xlsx) hit: a genuine date+time cell with no explicit number
  // format. Before this was fixed, SheetJS's own generic default
  // format ("m/d/yy h:mm", US-ordered regardless of the file's actual
  // locale) rendered it as e.g. "9/20/26 17:10", which
  // csv-mapping.ts's parseDate() couldn't parse at all under any
  // DMY/MDY/YMD picker choice — "Unrecognised date". Reading the
  // cell's real stored value sidesteps the formatting question
  // entirely: we already know the exact calendar date. Must go
  // through the real write/read round trip (roundTripSheet) — this
  // exact scenario silently "worked" against an in-memory-only
  // worksheet while still being broken for a real uploaded file.
  test("a native Excel date+time cell with no explicit format is normalised to an unambiguous ISO date", () => {
    const ws = roundTripSheet([
      ["Date", "Description", "Amount"],
      [new Date(Date.UTC(2026, 8, 20, 17, 10)), "CAFE PURCHASE", -12.5],
    ]);
    const { rows, hasNormalizedDates } = sheetToRows(ws);
    expect(rows[0].Date).toBe("2026-09-20");
    expect(hasNormalizedDates).toBe(true);
  });

  test("a native Excel date cell with an explicit display format is still normalised the same way", () => {
    const ws = roundTripSheet([
      ["Date", "Description", "Amount"],
      [new Date(Date.UTC(2026, 2, 3)), "WOOLWORTHS 2145", -142.35],
    ]);
    const { rows, hasNormalizedDates } = sheetToRows(ws);
    expect(rows[0].Date).toBe("2026-03-03");
    expect(hasNormalizedDates).toBe(true);
  });

  test("a mixed sheet only normalises the genuine date cells, leaving text cells alone", () => {
    const ws = roundTripSheet([
      ["Date", "Description", "Amount"],
      [new Date(Date.UTC(2026, 8, 20)), "CAFE PURCHASE", -12.5],
      ["20/09/2026", "TEXT DATE ROW", -5],
    ]);
    const { rows, hasNormalizedDates } = sheetToRows(ws);
    expect(rows[0].Date).toBe("2026-09-20");
    expect(rows[1].Date).toBe("20/09/2026");
    expect(hasNormalizedDates).toBe(true);
  });

  test("empty cells default to an empty string, not undefined", () => {
    const ws = roundTripSheet([
      ["Date", "Description", "Amount"],
      ["03/03/2026", "WOOLWORTHS 2145", -142.35],
      ["05/03/2026", "", -210], // description left blank
    ]);
    const { rows } = sheetToRows(ws);
    expect(rows[1].Description).toBe("");
  });

  test("an empty sheet returns empty headers and rows rather than throwing", () => {
    const ws = roundTripSheet([[]]);
    const { headers, rows, hasNormalizedDates } = sheetToRows(ws);
    expect(headers).toEqual([]);
    expect(rows).toEqual([]);
    expect(hasNormalizedDates).toBe(false);
  });

  test("output feeds directly into the existing CSV mapping pipeline unchanged", () => {
    const ws = roundTripSheet([
      ["Transaction Date", "Narrative", "Debit", "Credit"],
      ["03/03/2026", "WOOLWORTHS 2145", "142.35", ""],
      ["18/03/2026", "DIVIDEND CBA SHARES", "", "185.40"],
    ]);
    const { headers, rows } = sheetToRows(ws);

    const guess = guessColumnMapping(headers);
    expect(guess.amountMode).toBe("debit-credit");

    const mapped = mapRows(rows, { ...guess, dateFormat: "DMY" } as Parameters<typeof mapRows>[1]);
    expect(mapped).toEqual([
      { txn_date: "2026-03-03", description: "WOOLWORTHS 2145", amount: -142.35 },
      { txn_date: "2026-03-18", description: "DIVIDEND CBA SHARES", amount: 185.4 },
    ]);
  });

  // The exact end-to-end scenario ImportWizard.tsx's loadSheet()
  // relies on: hasNormalizedDates=true tells it to default the
  // picker to "YMD", and that default must actually parse cleanly.
  test("a real client statement's date+time cells map straight through to valid txn_date values", () => {
    const ws = roundTripSheet([
      ["Date", "Description", "Amount"],
      [new Date(Date.UTC(2026, 8, 20, 17, 10)), "CAFE PURCHASE", -12.5],
      [new Date(Date.UTC(2026, 8, 21, 9, 5)), "SALARY", 2000],
    ]);
    const { headers, rows, hasNormalizedDates } = sheetToRows(ws);
    expect(hasNormalizedDates).toBe(true);

    const guess = { ...guessColumnMapping(headers), dateFormat: "YMD" as const };
    const mapped = mapRows(rows, guess as Parameters<typeof mapRows>[1]);
    expect(mapped).toEqual([
      { txn_date: "2026-09-20", description: "CAFE PURCHASE", amount: -12.5 },
      { txn_date: "2026-09-21", description: "SALARY", amount: 2000 },
    ]);
  });
});
