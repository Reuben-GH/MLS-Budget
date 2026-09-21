import * as XLSX from "xlsx";

// Reads an uploaded file's bytes into a workbook. No browser/File APIs
// here beyond the raw bytes — the caller (ImportWizard) is responsible
// for turning a File into an ArrayBuffer first — so this stays
// testable the same way as the rest of lib/statements.
export function parseWorkbook(buffer: ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(buffer, { type: "array" });
}

// Extracts a worksheet's header row + data rows in the same shape
// Papa.parse produces for CSV ({ header: true }) — a plain
// Record<string,string>[] keyed by the first row's column names — so
// the existing column-mapping pipeline (guessColumnMapping, mapRows
// in csv-mapping.ts) works identically regardless of whether the
// source file was a CSV or an Excel export.
//
// `raw: false` reads each cell's *formatted display* value rather
// than its underlying stored value — this matters most for dates:
// Excel stores a date as a serial number (e.g. 46000), and without
// `raw: false` that number would come through as "46000" instead of
// the date string parseDate() expects.
export function sheetToRows(worksheet: XLSX.WorkSheet): { headers: string[]; rows: Record<string, string>[] } {
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, { raw: false, defval: "" });
  const [headerRow] = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, raw: false });
  return { headers: (headerRow ?? []).map(String), rows };
}
