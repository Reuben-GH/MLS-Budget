"use client";

import { useState, useTransition } from "react";
import Papa from "papaparse";
import {
  guessColumnMapping,
  mapRows,
  type ColumnMapping,
  type DateFormat,
  type ImportRow,
} from "../../../lib/statements/csv-mapping";
import { importTransactions } from "./actions";

type Step = "pick" | "map" | "done";

const DATE_FORMAT_LABELS: Record<DateFormat, string> = {
  DMY: "DD/MM/YYYY (Australian)",
  MDY: "MM/DD/YYYY (US)",
  YMD: "YYYY-MM-DD",
};

export function ImportWizard() {
  const [step, setStep] = useState<Step>("pick");
  const [filename, setFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({});
  const [mapError, setMapError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skippedDuplicates: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedHeaders = results.meta.fields ?? [];
        setHeaders(parsedHeaders);
        setRawRows(results.data);
        setMapping(guessColumnMapping(parsedHeaders));
        setStep("map");
      },
    });
  }

  // Deliberately not calling setMapError here — this runs during
  // render (see its call site below), and calling a state setter
  // synchronously during render triggers React's "too many re-renders"
  // loop-detection. Preview errors are purely derived from
  // mapping/rawRows, so they don't need to be state at all; mapError
  // (the state) is reserved for handleConfirm's own validation, which
  // runs from an event handler, not render.
  function previewRows(): { rows: ImportRow[] | null; error: string | null } {
    if (!isMappingComplete(mapping)) return { rows: null, error: null };
    try {
      return { rows: mapRows(rawRows.slice(0, 10), mapping as ColumnMapping), error: null };
    } catch (err) {
      return { rows: null, error: err instanceof Error ? err.message : "Couldn't read those columns." };
    }
  }

  function handleConfirm() {
    if (!isMappingComplete(mapping)) {
      setMapError("Fill in every field above first.");
      return;
    }
    let rows: ImportRow[];
    try {
      rows = mapRows(rawRows, mapping as ColumnMapping);
    } catch (err) {
      setMapError(err instanceof Error ? err.message : "Couldn't read those columns.");
      return;
    }
    startTransition(async () => {
      const res = await importTransactions(filename, rows);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setError(null);
      setResult(res);
      setStep("done");
    });
  }

  if (step === "pick") {
    return (
      <div className="card">
        <div className="card-title">1. Choose a file</div>
        <p className="stat-caption" style={{ marginBottom: 12 }}>
          Export a transaction list from your client&apos;s online banking as a CSV file, then choose it
          here.
        </p>
        <input type="file" accept=".csv" onChange={handleFile} />
      </div>
    );
  }

  if (step === "map") {
    const { rows: sample, error: previewError } = previewRows();
    return (
      <div className="card">
        <div className="card-title">2. Match the columns</div>
        <p className="stat-caption" style={{ marginBottom: 12 }}>
          {filename} — {rawRows.length} rows found. Confirm which column is which; this varies by
          bank, so nothing here is guessed silently.
        </p>

        <div className="form-grid">
          <div className="form-group">
            <label>Date column</label>
            <select
              value={mapping.dateColumn ?? ""}
              onChange={(e) => setMapping((m) => ({ ...m, dateColumn: e.target.value }))}
            >
              <option value="" disabled>
                Choose…
              </option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Date format</label>
            <select
              value={mapping.dateFormat ?? "DMY"}
              onChange={(e) => setMapping((m) => ({ ...m, dateFormat: e.target.value as DateFormat }))}
            >
              {(Object.keys(DATE_FORMAT_LABELS) as DateFormat[]).map((f) => (
                <option key={f} value={f}>
                  {DATE_FORMAT_LABELS[f]}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Description column</label>
            <select
              value={mapping.descriptionColumn ?? ""}
              onChange={(e) => setMapping((m) => ({ ...m, descriptionColumn: e.target.value }))}
            >
              <option value="" disabled>
                Choose…
              </option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Amount columns</label>
            <select
              value={mapping.amountMode ?? "single"}
              onChange={(e) =>
                setMapping((m) => ({ ...m, amountMode: e.target.value as "single" | "debit-credit" }))
              }
            >
              <option value="single">One amount column (+ / −)</option>
              <option value="debit-credit">Separate Debit / Credit columns</option>
            </select>
          </div>

          {mapping.amountMode === "debit-credit" ? (
            <>
              <div className="form-group">
                <label>Debit column (money out)</label>
                <select
                  value={mapping.debitColumn ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, debitColumn: e.target.value }))}
                >
                  <option value="" disabled>
                    Choose…
                  </option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Credit column (money in)</label>
                <select
                  value={mapping.creditColumn ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, creditColumn: e.target.value }))}
                >
                  <option value="" disabled>
                    Choose…
                  </option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div className="form-group">
              <label>Amount column</label>
              <select
                value={mapping.amountColumn ?? ""}
                onChange={(e) => setMapping((m) => ({ ...m, amountColumn: e.target.value }))}
              >
                <option value="" disabled>
                  Choose…
                </option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {(mapError || previewError) && <div className="form-error mt16">{mapError ?? previewError}</div>}

        {sample && (
          <>
            <div className="section-divider mt16">3. Preview (first {sample.length} rows)</div>
            <div style={{ overflowX: "auto" }}>
              <table className="ledger">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {sample.map((r, i) => (
                    <tr key={i}>
                      <td>{r.txn_date}</td>
                      <td>{r.description}</td>
                      <td className="amt">{r.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {error && <div className="form-error mt16">{error}</div>}

        <div className="calc-bar mt16">
          <button className="btn-primary" type="button" onClick={handleConfirm} disabled={isPending || !sample}>
            {isPending ? "Importing…" : `Import all ${rawRows.length} rows`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title">Import complete</div>
      <p>
        Imported <strong>{result?.imported}</strong> transactions
        {result && result.skippedDuplicates > 0 ? (
          <> — skipped {result.skippedDuplicates} already in the system.</>
        ) : (
          "."
        )}
      </p>
      <a href="/dashboard" className="calculator-link" style={{ marginTop: 12 }}>
        View the Dashboard →
      </a>
    </div>
  );
}

function isMappingComplete(m: Partial<ColumnMapping>): m is ColumnMapping {
  if (!m.dateColumn || !m.descriptionColumn || !m.dateFormat) return false;
  if (m.amountMode === "debit-credit") return !!m.debitColumn && !!m.creditColumn;
  return !!m.amountColumn;
}
