import { createAdminClient } from "../../lib/supabase/admin";
import type { FixtureTransaction } from "../fixtures/march-2026-transactions";

// Seeds a statement + its transactions for a user, using the
// service-role client (RLS bypass is fine here — Phase 0 is about
// validating the aggregation contract, not RLS; RLS itself is
// Phase 1's dedicated test). Categories are seeded directly from
// `expected_category`/`expected_subcategory`, as if categorisation had
// already run correctly — Phase 0 exists to prove the aggregation
// contract independent of the categorisation contract (Phase 3).
export async function loadFixture(
  userId: string,
  periodStart: string,
  periodEnd: string,
  rows: FixtureTransaction[]
): Promise<{ statementId: string }> {
  const admin = createAdminClient();

  const { data: statement, error: statementError } = await admin
    .from("statements")
    .insert({
      user_id: userId,
      file_path: `test-fixtures/${userId}/march-2026.csv`,
      original_filename: "march-2026.csv",
      period_start: periodStart,
      period_end: periodEnd,
      status: "parsed",
    })
    .select()
    .single();
  if (statementError) throw statementError;

  const { error: txnError } = await admin.from("transactions").insert(
    rows.map((row) => ({
      statement_id: statement.id,
      user_id: userId,
      txn_date: row.txn_date,
      description: row.description,
      amount: row.amount,
      category: row.expected_category,
      subcategory: row.expected_subcategory,
      confidence: 1.0,
    }))
  );
  if (txnError) throw txnError;

  return { statementId: statement.id };
}

// Removes everything for a user across all six tables — used to
// reset state between test runs so re-running the suite doesn't
// double-count fixture rows.
export async function wipeUserData(userId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("transactions").delete().eq("user_id", userId);
  await admin.from("statements").delete().eq("user_id", userId);
  await admin.from("monthly_summaries").delete().eq("user_id", userId);
  await admin.from("custom_subcategories").delete().eq("user_id", userId);
  await admin.from("category_classifications").delete().eq("user_id", userId);
  await admin.from("merchant_memory").delete().eq("user_id", userId);
}
