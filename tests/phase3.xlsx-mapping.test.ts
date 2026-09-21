import { describe, test, expect } from "vitest";
import * as XLSX from "xlsx";
import { sheetToRows } from "../lib/statements/xlsx-mapping";
import { guessColumnMapping, mapRows } from "../lib/statements/csv-mapping";

describe("Phase 3 — sheetToRows()", () => {
  test("extracts headers and rows the same shape Papa.parse produces for CSV", () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Date", "Description", "Amount"],
      ["03/03/2026", "WOOLWORTHS 2145", -142.35],
      ["05/03/2026", "AGL ELECTRICITY", -210],
    ]);
    const { headers, rows } = sheetToRows(ws);
    expect(headers).toEqual(["Date", "Description", "Amount"]);
    expect(rows).toEqual([
      { Date: "03/03/2026", Description: "WOOLWORTHS 2145", Amount: "-142.35" },
      { Date: "05/03/2026", Description: "AGL ELECTRICITY", Amount: "-210" },
    ]);
  });

  // A genuine Excel date cell is stored as a serial number, not text —
  // `raw: false` must read its display format, not the underlying
  // number, or a real bank export's date column would come through as
  // e.g. "46094" instead of a parseable date string. Constructed here
  // the way a real exported file's cell actually looks (explicit
  // number format, no stale cached text) rather than relying on
  // aoa_to_sheet's own default date formatting for a raw JS Date.
  test("a native Excel date cell is read using its own display format, not the raw serial number", () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Date", "Description", "Amount"],
      [new Date(2026, 2, 3), "WOOLWORTHS 2145", -142.35],
    ]);
    ws["A2"].z = "dd/mm/yyyy";
    delete ws["A2"].w;

    const { rows } = sheetToRows(ws);
    expect(rows[0].Date).toBe("03/03/2026");
  });

  test("empty cells default to an empty string, not undefined", () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Date", "Description", "Amount"],
      ["03/03/2026", "WOOLWORTHS 2145", -142.35],
      ["05/03/2026", "", -210], // description left blank
    ]);
    const { rows } = sheetToRows(ws);
    expect(rows[1].Description).toBe("");
  });

  test("an empty sheet returns empty headers and rows rather than throwing", () => {
    const ws = XLSX.utils.aoa_to_sheet([[]]);
    const { headers, rows } = sheetToRows(ws);
    expect(headers).toEqual([]);
    expect(rows).toEqual([]);
  });

  test("output feeds directly into the existing CSV mapping pipeline unchanged", () => {
    const ws = XLSX.utils.aoa_to_sheet([
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
});
