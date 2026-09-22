import * as XLSX from "xlsx";

// Reads an uploaded file's bytes into a workbook. No browser/File APIs
// here beyond the raw bytes — the caller (ImportWizard) is responsible
// for turning a File into an ArrayBuffer first — so this stays
// testable the same way as the rest of lib/statements.
//
// `cellDates: true` matters a lot more than it looks: a date cell
// parsed from real file bytes (as opposed to one built in-memory via
// XLSX.utils.aoa_to_sheet, which behaves differently) comes back as a
// plain numeric cell with a date-shaped display format, NOT a
// genuine Date value, unless this option is set at read time — it's
// not something sheetToRows can fix afterwards by reading the cell
// differently. Confirmed by testing the actual write-bytes-then-
// read-bytes round trip a real upload goes through, not just an
// in-memory worksheet object (which misleadingly behaves as if dates
// already "just worked").
export function parseWorkbook(buffer: ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(buffer, { type: "array", cellDates: true });
}

// SheetJS constructs a genuine Excel date cell's JS Date using UTC
// semantics from the underlying serial number — confirmed empirically
// (the same cell's getUTCDate() is stable across TZ=America/Los_Angeles
// and TZ=Australia/Sydney, while getDate() shifts by a day between
// them). Reading it back with the LOCAL getters would silently shift
// the calendar date near midnight depending on which timezone this
// code happens to run in. UTC getters are the only correct choice
// here, despite that feeling backwards for a "local calendar date."
function formatCellDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Extracts a worksheet's header row + data rows in the same shape
// Papa.parse produces for CSV ({ header: true }) — a plain
// Record<string,string>[] keyed by the first row's column names — so
// the existing column-mapping pipeline (guessColumnMapping, mapRows
// in csv-mapping.ts) works identically regardless of whether the
// source file was a CSV or an Excel export.
//
// Genuine Excel date/datetime cells are normalised straight to
// YYYY-MM-DD here rather than passed through as formatted text. Two
// real problems that would otherwise hit every Excel import:
// (1) a cell with no explicit number format displays using SheetJS's
// own generic default ("m/d/yy[ h:mm]") regardless of the workbook's
// actual locale, so an Australian bank's date column can render as
// US-ordered text — not something the wizard's DMY/MDY picker can
// distinguish from a genuinely US-formatted file; (2) a date+time
// cell's trailing time-of-day component isn't a date format
// csv-mapping.ts's parser was ever written to expect. Reading each
// cell's real stored value sidesteps both — we already know the exact
// calendar date, no text-format guessing required. Plain text cells
// (unaffected by either problem) still pass through as formatted text
// for the existing DMY/MDY/YMD picker to handle, unchanged.
//
// `hasNormalizedDates` tells the caller at least one cell was handled
// this way, so it can default the date-format picker to YYYY-MM-DD —
// still fully overridable, never silently assumed.
export function sheetToRows(worksheet: XLSX.WorkSheet): {
  headers: string[];
  rows: Record<string, string>[];
  hasNormalizedDates: boolean;
} {
  const rawGrid = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, raw: true, defval: "" });
  const textGrid = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, raw: false, defval: "" });

  const headers = (textGrid[0] ?? []).map(String);
  if (headers.length === 0) return { headers: [], rows: [], hasNormalizedDates: false };

  let hasNormalizedDates = false;
  const rows: Record<string, string>[] = [];
  for (let r = 1; r < textGrid.length; r++) {
    const rawRow = rawGrid[r] ?? [];
    const textRow = textGrid[r] ?? [];
    const row: Record<string, string> = {};
    headers.forEach((header, c) => {
      const rawValue = rawRow[c];
      if (rawValue instanceof Date) {
        row[header] = formatCellDate(rawValue);
        hasNormalizedDates = true;
      } else {
        row[header] = textRow[c] ?? "";
      }
    });
    rows.push(row);
  }

  return { headers, rows, hasNormalizedDates };
}
