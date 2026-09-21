// Guards against re-uploading an overlapping CSV export (e.g. a client
// re-exports "last 3 months" that overlaps a file already imported).
// Matched on date + description + amount, which is not perfectly
// precise: two genuinely identical transactions on the same day (e.g.
// two separate $5 coffees, same cafe, same day) will under-count by
// one if the file is re-uploaded. That's an accepted tradeoff — the
// alternative, no dedup at all, produces the worse failure (silent
// double-counting of an entire re-imported statement).

export interface DedupKey {
  txn_date: string;
  description: string;
  amount: number;
}

export function buildDedupKey(t: DedupKey): string {
  return `${t.txn_date}|${t.description}|${t.amount}`;
}

export function filterDuplicates<T extends DedupKey>(incoming: T[], existing: DedupKey[]): T[] {
  const seen = new Set(existing.map(buildDedupKey));
  return incoming.filter((t) => !seen.has(buildDedupKey(t)));
}
