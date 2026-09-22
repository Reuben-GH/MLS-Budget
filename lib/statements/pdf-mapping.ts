import * as pdfjsLib from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { parseDate, parseAmount, type DateFormat, type ImportRow } from "./csv-mapping";

// Only set once, and only matters in the browser (this file is only
// ever imported from the client-side ImportWizard) — points at the
// worker script copied into /public at build time from
// node_modules/pdfjs-dist/build/pdf.worker.min.mjs. Without this,
// pdfjs-dist can't parse anything.
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

// Decoupled from pdfjs-dist's own TextItem type so line reconstruction
// is testable without needing a real parsed PDF — mirrors how
// xlsx-mapping.ts's sheetToRows() is tested against directly-built
// XLSX.WorkSheet objects rather than only through real files.
export interface TextFragment {
  text: string;
  x: number;
  y: number;
}

// A PDF has no real notion of "rows" — text is just a bag of
// positioned fragments. This reconstructs visual lines the same way
// any table-from-PDF extractor has to: group fragments whose Y
// position is close together (same line), then sort each line
// left-to-right by X so it reads the way it visually appears. PDF Y
// coordinates increase upward, so the highest Y is the top of the
// page — sorting descending gives top-to-bottom reading order.
const LINE_TOLERANCE = 3; // points; fragments within this Y distance count as the same line

export function reconstructLines(fragments: TextFragment[]): string[] {
  if (fragments.length === 0) return [];
  const sorted = [...fragments].sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: TextFragment[][] = [];
  for (const frag of sorted) {
    const currentLine = lines[lines.length - 1];
    if (currentLine && Math.abs(currentLine[0].y - frag.y) <= LINE_TOLERANCE) {
      currentLine.push(frag);
    } else {
      lines.push([frag]);
    }
  }

  return lines.map((line) =>
    [...line]
      .sort((a, b) => a.x - b.x)
      .map((f) => f.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

const MONTH_NAMES: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

const NUMERIC_DATE = /^(\d{1,4}[/\-.]\d{1,2}[/\-.]\d{2,4})\b/;
// The year is optional — a real bank statement (e.g. BankSA) commonly
// prints just "28 MAY" on every transaction line, with the year
// stated once for the whole statement (in its period header) rather
// than repeated per row. See deriveStatementStartYear()/resolveDate()
// for how a missing year is inferred instead of just guessed.
const WRITTEN_DATE = /^(\d{1,2})\s+([A-Za-z]{3,9})(?:\s+(\d{2,4}))?\b/;

// Every number-shaped value found after the date, in order — not just
// the last one. A CSV/Excel row only ever has one amount, but a real
// bank-statement PDF very commonly prints two: the transaction amount
// and the balance immediately after it (no separate sign or column
// label survives text extraction to say which is which). Handles a
// leading "-" (a plain negative amount), a trailing DR/CR suffix, and
// a trailing "-" some statements use to mark a negative balance.
const AMOUNT_TOKEN = /-?\(?\$?[\d,]+\.\d{2}\)?(?:\s*(?:DR|CR))?\s*-?/gi;

export interface LineShape {
  dateToken:
    | { kind: "numeric"; raw: string }
    | { kind: "written"; day: string; month: string; year: string | null };
  description: string;
  amountTokens: string[];
}

// Identifies whether a reconstructed line looks like a transaction: a
// date-shaped token at the start, and at least one amount-shaped
// token somewhere after it, with something left over to use as the
// description. Everything else — headers, footers, page numbers,
// reference-number continuation lines — is noise and correctly
// returns null: dropped, not force-fit into a wrong row. This is the
// PDF equivalent of guessColumnMapping() for CSV/Excel, except there's
// no header row to read the intent from — each line has to prove it's
// a transaction on its own. Deliberately stateless (no date-year or
// running-balance context) so it's independently testable; resolving
// a line's meaning against that context is extractTransactionCandidates()'s job.
export function matchTransactionLine(line: string): LineShape | null {
  const trimmed = line.trim();

  const writtenMatch = trimmed.match(WRITTEN_DATE);
  let dateToken: LineShape["dateToken"] | null = null;
  let rest = "";

  if (writtenMatch && MONTH_NAMES[writtenMatch[2].slice(0, 3).toUpperCase()]) {
    dateToken = { kind: "written", day: writtenMatch[1], month: writtenMatch[2], year: writtenMatch[3] ?? null };
    rest = trimmed.slice(writtenMatch[0].length);
  } else {
    const numericMatch = trimmed.match(NUMERIC_DATE);
    if (numericMatch) {
      dateToken = { kind: "numeric", raw: numericMatch[1] };
      rest = trimmed.slice(numericMatch[0].length);
    }
  }
  if (!dateToken) return null;

  const rawAmountMatches = rest.match(AMOUNT_TOKEN) ?? [];
  if (rawAmountMatches.length === 0) return null;

  let description = rest;
  for (const m of rawAmountMatches) description = description.replace(m, " ");
  // A same-day timestamp is often glued straight onto the description
  // ("18JUN 08:40") — cosmetic clutter from the statement layout, not
  // part of the actual transaction description.
  description = description.replace(/\b\d{1,2}[A-Za-z]{3}\s+\d{1,2}:\d{2}\b/g, " ");
  description = description.replace(/\s+/g, " ").trim();
  if (!description) return null;

  return { dateToken, description, amountTokens: rawAmountMatches.map((t) => t.trim()) };
}

export interface PdfTransactionCandidate {
  // Either an already-resolved ISO date (written month name, once its
  // year is known) or raw ambiguous text (numeric) for parseDate() to
  // resolve against the wizard's chosen format.
  rawDate: string;
  description: string;
  // Always a plain string parseAmount() can parse directly — either
  // the original token as extracted, or (for a two-column
  // amount/balance line) a signed decimal string already computed
  // from the balance movement. See resolveTwoTokenAmount().
  rawAmount: string;
}

const BALANCE_ANCHOR = /^(OPENING BALANCE|CLOSING BALANCE|BALANCE B\/FWD|BALANCE C\/FWD|BALANCE BROUGHT FORWARD|BALANCE FORWARD)\b/i;

// Converts a statement's "-" -suffixed negative-balance convention
// ("345.97 -") into the leading-minus form parseAmount() already
// understands, so that shared parser is reused rather than
// duplicating its DR/CR and parenthesis logic here.
function normaliseTrailingMinus(token: string): string {
  const m = token.match(/^(.*\d)\s*-\s*$/);
  return m ? `-${m[1]}` : token;
}

function parseToken(token: string): number {
  return parseAmount(normaliseTrailingMinus(token));
}

const STATEMENT_PERIOD = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+to\s+\d{1,2}\/\d{1,2}\/\d{4}/i;
const ANY_YEAR = /\b(19|20)\d{2}\b/;

// A written date with no year on the line itself needs a starting
// point — bank statements state their period once, e.g. "Statement
// Period 28/05/2025 to 27/11/2025", so that's checked first. Falling
// back to any 4-digit year found anywhere, then to today's year, is a
// deliberately weak last resort — good enough that a malformed or
// unusual statement still produces *a* result the mandatory preview
// step can catch, rather than crashing the whole import.
export function deriveStatementStartYear(lines: string[]): number | null {
  const joined = lines.join(" ");
  const period = joined.match(STATEMENT_PERIOD);
  if (period) return Number(period[3]);
  const any = joined.match(ANY_YEAR);
  return any ? Number(any[0]) : null;
}

interface ExtractState {
  year: number;
  lastMonth: number | null;
  previousBalance: number | null;
}

// Resolves a line's date token to a concrete rawDate string, updating
// (and reading) the running year/month state along the way. A written
// date with an explicit year re-anchors the state directly; one
// without a year is assumed to belong to the statement's current
// year, incrementing it whenever the month goes backwards relative to
// the previous transaction (a December→January statement boundary).
function resolveDate(token: LineShape["dateToken"], state: ExtractState): string {
  if (token.kind === "numeric") return token.raw;

  const month = MONTH_NAMES[token.month.slice(0, 3).toUpperCase()];
  let year: number;
  if (token.year) {
    year = token.year.length === 2 ? 2000 + Number(token.year) : Number(token.year);
    state.year = year;
  } else {
    if (state.lastMonth !== null && month < state.lastMonth) state.year += 1;
    year = state.year;
  }
  state.lastMonth = month;

  return `${year}-${String(month).padStart(2, "0")}-${token.day.padStart(2, "0")}`;
}

// Turns a two-amount line (transaction amount, running balance) into
// a signed amount by trusting the balance movement rather than the
// unsigned magnitude token — there's no reliable debit/credit column
// label left once the PDF's text has been flattened to a line, but
// the balance itself is unambiguous ground truth, and correctly
// handles cases a naive column guess would get wrong (e.g. a dishonour
// reversal, which is a *credit* despite reversing what looked like a
// debit). Falls back to the plain magnitude token — unsigned, so
// worth flagging in the wizard's preview copy — only when no prior
// balance is known yet to compare against.
function resolveTwoTokenAmount(amountToken: string, balanceToken: string, state: ExtractState): string {
  try {
    const newBalance = parseToken(balanceToken);
    const rawAmount =
      state.previousBalance !== null
        ? (Math.round((newBalance - state.previousBalance) * 100) / 100).toFixed(2)
        : amountToken;
    state.previousBalance = newBalance;
    return rawAmount;
  } catch {
    return amountToken;
  }
}

// Turns reconstructed lines into transaction candidates, threading
// two pieces of context no single line can resolve on its own: the
// year for a "28 MAY"-style date, and the sign for a "transaction
// amount, then balance" pair of numbers. Lines whose description
// matches a balance-summary phrase (opening/closing balance, a
// carried-forward subtotal) only update that running balance — they
// are never transactions themselves.
export function extractTransactionCandidates(lines: string[]): PdfTransactionCandidate[] {
  const state: ExtractState = {
    year: deriveStatementStartYear(lines) ?? new Date().getFullYear(),
    lastMonth: null,
    previousBalance: null,
  };
  const candidates: PdfTransactionCandidate[] = [];

  for (const line of lines) {
    const shape = matchTransactionLine(line);
    if (!shape) continue;

    const rawDate = resolveDate(shape.dateToken, state);

    if (BALANCE_ANCHOR.test(shape.description)) {
      try {
        state.previousBalance = parseToken(shape.amountTokens[shape.amountTokens.length - 1]);
      } catch {
        // Unreadable balance figure — leave previousBalance as-is; the
        // next transaction's sign falls back to its own token.
      }
      continue;
    }

    if (shape.amountTokens.length >= 2) {
      const balanceToken = shape.amountTokens[shape.amountTokens.length - 1];
      const amountToken = shape.amountTokens[shape.amountTokens.length - 2];
      candidates.push({
        rawDate,
        description: shape.description,
        rawAmount: resolveTwoTokenAmount(amountToken, balanceToken, state),
      });
    } else {
      candidates.push({ rawDate, description: shape.description, rawAmount: shape.amountTokens[0] });
    }
  }

  return candidates;
}

// Turns extracted candidates into the same ImportRow[] shape
// CSV/Excel rows end up as, reusing parseDate()/parseAmount()
// directly rather than routing through mapRows() — there's no column
// to look up here, extraction already produced the three fields.
// Individual rows that fail to parse are skipped rather than failing
// the whole import (unlike CSV/Excel, there's no "fix the column
// mapping" recourse for a bad PDF row) — the mandatory preview step
// is what catches a statement that extracted badly overall.
export function toImportRows(candidates: PdfTransactionCandidate[], dateFormat: DateFormat): { rows: ImportRow[]; skipped: number } {
  const rows: ImportRow[] = [];
  let skipped = 0;
  for (const c of candidates) {
    try {
      rows.push({
        txn_date: parseDate(c.rawDate, dateFormat),
        description: c.description,
        amount: parseAmount(c.rawAmount),
      });
    } catch {
      skipped++;
    }
  }
  return { rows, skipped };
}

// Reads every page's text, with position, and reconstructs it into
// plain lines. This part can't be meaningfully unit-tested without a
// real parsed PDF (same reason xlsx-mapping.ts's parseWorkbook() isn't
// deeply unit-tested either) — verified instead via real generated
// PDFs (synthetic and a real bank statement) through the live import
// wizard.
export async function extractLinesFromPdf(buffer: ArrayBuffer): Promise<string[]> {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const allLines: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const fragments: TextFragment[] = textContent.items
      .filter((item): item is TextItem => "str" in item && item.str.trim().length > 0)
      .map((item) => ({ text: item.str, x: item.transform[4], y: item.transform[5] }));
    allLines.push(...reconstructLines(fragments));
  }
  return allLines;
}
