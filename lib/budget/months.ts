// Pure, DB-free month logic for the dashboard's month picker — no
// fetching, so these run identically from the Server Component and a
// Vitest unit test, same convention as lib/budget/aggregate.ts.

// Extracts the sorted (most recent first), de-duplicated list of
// "YYYY-MM" months present in a list of txn_date values ("YYYY-MM-DD").
export function extractAvailableMonths(txnDates: string[]): string[] {
  const months = new Set(txnDates.map((d) => d.slice(0, 7)));
  return [...months].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}

// The month to actually show: the requested one if it's a month that
// genuinely has data, otherwise the most recent available month
// (never silently fall back to an empty/invalid month string) —
// mirrors the "confirm, don't silently guess" pattern used elsewhere
// (e.g. csv-mapping.ts), just applied to a URL param instead of a
// column mapping. Returns null if there's no data at all.
export function resolveTargetMonth(availableMonths: string[], requested: string | undefined): string | null {
  if (availableMonths.length === 0) return null;
  if (requested && availableMonths.includes(requested)) return requested;
  return availableMonths[0];
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function monthStartDate(month: string): string {
  return `${month}-01`;
}

export function monthEndExclusive(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}
