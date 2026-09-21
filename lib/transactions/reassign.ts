// Pure logic for correcting a transaction's category, extracted out of
// the Server Action so it's independently testable (Server Actions
// import next/headers, which throws outside a real request — the same
// reason no action in this codebase has a direct unit test).
//
// `original_category` is only ever set the FIRST time a transaction is
// overridden — a second correction must not clobber it, or the audit
// trail loses what the categorisation engine originally guessed.

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
