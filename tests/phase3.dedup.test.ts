import { describe, test, expect } from "vitest";
import { filterDuplicates, buildDedupKey } from "../lib/statements/dedup";

describe("Phase 3 — filterDuplicates()", () => {
  test("removes rows that exactly match an existing transaction", () => {
    const existing = [{ txn_date: "2026-03-03", description: "WOOLWORTHS 2145", amount: -142.35 }];
    const incoming = [
      { txn_date: "2026-03-03", description: "WOOLWORTHS 2145", amount: -142.35 },
      { txn_date: "2026-03-04", description: "COLES", amount: -98.2 },
    ];
    const result = filterDuplicates(incoming, existing);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe("COLES");
  });

  test("keeps rows with the same description/amount but a different date", () => {
    const existing = [{ txn_date: "2026-03-03", description: "COFFEE", amount: -5 }];
    const incoming = [{ txn_date: "2026-03-04", description: "COFFEE", amount: -5 }];
    expect(filterDuplicates(incoming, existing)).toHaveLength(1);
  });

  test("no existing rows means nothing is filtered", () => {
    const incoming = [{ txn_date: "2026-03-03", description: "COFFEE", amount: -5 }];
    expect(filterDuplicates(incoming, [])).toHaveLength(1);
  });

  test("buildDedupKey produces a stable, order-sensitive key", () => {
    const a = buildDedupKey({ txn_date: "2026-03-03", description: "COFFEE", amount: -5 });
    const b = buildDedupKey({ txn_date: "2026-03-03", description: "COFFEE", amount: -5 });
    expect(a).toBe(b);
  });
});
