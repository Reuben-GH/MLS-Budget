// Pure CSV-mapping helpers — no browser/File APIs here, so these are
// fully unit-testable. The import wizard (a client component) calls
// these against rows papaparse has already turned into plain objects.
//
// Every Australian bank's CSV export differs: some use one signed
// "Amount" column, others split Debit/Credit into two; header names
// vary ("Description" vs "Narrative" vs "Transaction Details"); date
// format is genuinely ambiguous for a value like "03/04/2026" and
// can't be guessed from the data alone. So this file only ever
// *suggests* a mapping — the wizard always lets the user confirm or
// override it before anything gets imported.

export type DateFormat = "DMY" | "MDY" | "YMD";

export interface ColumnMapping {
  dateColumn: string;
  descriptionColumn: string;
  amountMode: "single" | "debit-credit";
  amountColumn?: string;
  debitColumn?: string;
  creditColumn?: string;
  dateFormat: DateFormat;
}

export interface ImportRow {
  txn_date: string; // YYYY-MM-DD
  description: string;
  amount: number; // positive = credit, negative = debit
}

const DATE_HEADER_HINTS = ["date"];
const DESCRIPTION_HEADER_HINTS = ["description", "narrative", "details", "particulars", "payee", "merchant"];
const AMOUNT_HEADER_HINTS = ["amount", "value"];
const DEBIT_HEADER_HINTS = ["debit", "withdrawal", "money out", "paid out"];
const CREDIT_HEADER_HINTS = ["credit", "deposit", "money in", "paid in"];

function findHeader(headers: string[], hints: string[]): string | undefined {
  const lower = headers.map((h) => h.toLowerCase());
  for (const hint of hints) {
    const idx = lower.findIndex((h) => h.includes(hint));
    if (idx !== -1) return headers[idx];
  }
  return undefined;
}

// Best-effort guess only — every field is user-overridable in the
// wizard, and dateFormat always defaults to the most common
// Australian convention (DMY) rather than trying to infer it, since
// an ambiguous date can't be inferred from header names at all.
export function guessColumnMapping(headers: string[]): Partial<ColumnMapping> {
  const debitColumn = findHeader(headers, DEBIT_HEADER_HINTS);
  const creditColumn = findHeader(headers, CREDIT_HEADER_HINTS);
  const hasDebitCredit = !!debitColumn && !!creditColumn;

  return {
    dateColumn: findHeader(headers, DATE_HEADER_HINTS),
    descriptionColumn: findHeader(headers, DESCRIPTION_HEADER_HINTS),
    amountMode: hasDebitCredit ? "debit-credit" : "single",
    amountColumn: hasDebitCredit ? undefined : findHeader(headers, AMOUNT_HEADER_HINTS),
    debitColumn: hasDebitCredit ? debitColumn : undefined,
    creditColumn: hasDebitCredit ? creditColumn : undefined,
    dateFormat: "DMY",
  };
}

export function parseDate(raw: string, format: DateFormat): string {
  // Some exports append a time-of-day component after the date (e.g.
  // "20/09/2026 17:10") — bank statements commonly include this for
  // exact same-day ordering. Only the date portion is ever needed
  // here; the date is always the first whitespace-separated token.
  const datePart = raw.trim().split(/\s+/)[0];

  // A genuine Excel date cell (see xlsx-mapping.ts's sheetToRows) is
  // already normalised to an unambiguous ISO date at read time —
  // recognise and use it directly here, regardless of which format
  // is selected for the rest of the column. This matters for a
  // column with mixed cell types: some rows are real Excel date
  // cells, others are plain text dates in a different format (e.g.
  // "9/18/26") — one format picker can't correctly describe both at
  // once, but an ISO value never needed the picker's help in the
  // first place, since it isn't ambiguous.
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    if (Number.isNaN(new Date(datePart + "T00:00:00Z").getTime())) {
      throw new Error(`Unrecognised date: "${raw}"`);
    }
    return datePart;
  }

  const parts = datePart.split(/[/\-.]/).map((p) => p.trim());
  if (parts.length !== 3) throw new Error(`Unrecognised date: "${raw}"`);

  let day: string, month: string, year: string;
  if (format === "DMY") [day, month, year] = parts;
  else if (format === "MDY") [month, day, year] = parts;
  else [year, month, day] = parts;

  if (year.length === 2) year = `20${year}`;
  if (year.length !== 4) throw new Error(`Unrecognised date: "${raw}"`);

  const dayNum = day.padStart(2, "0");
  const monthNum = month.padStart(2, "0");
  const iso = `${year}-${monthNum}-${dayNum}`;

  if (Number.isNaN(new Date(iso + "T00:00:00Z").getTime())) {
    throw new Error(`Unrecognised date: "${raw}"`);
  }
  return iso;
}

// Handles "$1,234.56", "-123.45", "(123.45)" (accounting-style
// negative), and plain "123.45".
export function parseAmount(raw: string): number {
  const trimmed = raw.trim();
  const isParenNegative = trimmed.startsWith("(") && trimmed.endsWith(")");
  const cleaned = trimmed.replace(/[()$,]/g, "").trim();
  const value = Number(cleaned);
  if (Number.isNaN(value)) throw new Error(`Unrecognised amount: "${raw}"`);
  return isParenNegative ? -Math.abs(value) : value;
}

export function mapRows(rawRows: Record<string, string>[], mapping: ColumnMapping): ImportRow[] {
  return rawRows.map((row, i) => {
    const dateRaw = row[mapping.dateColumn];
    const description = (row[mapping.descriptionColumn] ?? "").trim();
    if (!dateRaw || !description) {
      throw new Error(`Row ${i + 1}: missing date or description.`);
    }

    let amount: number;
    if (mapping.amountMode === "single") {
      amount = parseAmount(row[mapping.amountColumn!] ?? "");
    } else {
      const debitRaw = (row[mapping.debitColumn!] ?? "").trim();
      const creditRaw = (row[mapping.creditColumn!] ?? "").trim();
      if (creditRaw) amount = Math.abs(parseAmount(creditRaw));
      else if (debitRaw) amount = -Math.abs(parseAmount(debitRaw));
      else amount = 0;
    }

    return { txn_date: parseDate(dateRaw, mapping.dateFormat), description, amount };
  });
}
