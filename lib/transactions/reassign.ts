// Pure logic for correcting a transaction's category, extracted out of
// the Server Action so it's independently testable (Server Actions
// import next/headers, which throws outside a real request — the same
// reason no action in this codebase has a direct unit test).
//
// `original_category` is only ever set the FIRST time a transaction is
// overridden — a second correction must not clobber it, or the audit
// trail loses what the categorisation engine originally guessed.

import { deriveMerchantKey } from "../categories/merchant-key";

export interface ReassignInput {
  category: string;
  subcategory: string | null;
}

export function buildReassignUpdate(
  existing: { category: string; manually_overridden: boolean },
  next: ReassignInput
): { category: string; subcategory: string | null; manually_overridden: true; original_category?: string } {
  return {
    category: next.category,
    subcategory: next.subcategory,
    manually_overridden: true,
    ...(existing.manually_overridden ? {} : { original_category: existing.category }),
  };
}

export interface MemoryBackfillCandidate {
  id: string;
  description: string;
  category: string;
  manually_overridden: boolean;
  original_category: string | null;
}

export interface MemoryBackfillUpdate {
  id: string;
  category: string;
  subcategory: string | null;
  confidence: number;
  original_category?: string;
}

// Applies a freshly-learned merchant rule to every OTHER transaction
// that matches it, once a correction has taught the app what this
// merchant should be. Deliberately excludes anything already
// manually_overridden — that flag means the user intervened on that
// specific transaction on purpose, independent of what the merchant
// rule says, so a bulk backfill must never silently undo a deliberate
// one-off exception. Backfilled rows are NOT themselves marked
// manually_overridden, so a later correction to this same merchant's
// rule will backfill them again rather than skipping them forever.
export function applyMerchantMemory(
  candidates: MemoryBackfillCandidate[],
  merchantKey: string,
  category: string,
  subcategory: string | null
): MemoryBackfillUpdate[] {
  return candidates
    .filter((t) => !t.manually_overridden && deriveMerchantKey(t.description) === merchantKey)
    .map((t) => ({
      id: t.id,
      category,
      subcategory,
      confidence: 1.0,
      ...(t.original_category ? {} : { original_category: t.category }),
    }));
}
