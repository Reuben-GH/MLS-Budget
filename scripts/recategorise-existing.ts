import { config } from "dotenv";
import { clientAs } from "../tests/helpers/test-auth";
import { createAdminClient } from "../lib/supabase/admin";
import { categoriseTransaction } from "../lib/categorisation/engine";

// Re-runs the categorisation engine (lib/categorisation/engine.ts)
// against every transaction that hasn't been manually corrected, and
// updates any whose category/subcategory the CURRENT rules would now
// assign differently. Existing transactions only ever get categorised
// once, at import time — when a rule changes (a fix, a new keyword),
// nothing retroactively re-applies it unless this is run. Deliberately
// skips manually_overridden rows: a user's own correction always wins
// over whatever the automatic rules now say, exactly like
// applyMerchantMemory's backfill does for the same reason.
config({ path: ".env.local" });

const DEMO_EMAIL = "reg.grantham@gmail.com";
const DEMO_PASSWORD = "MyLifeSortedDemo2026!";

async function main() {
  const { userId } = await clientAs(DEMO_EMAIL, DEMO_PASSWORD);
  const admin = createAdminClient();

  // Supabase caps a single select at 1000 rows by default — silently,
  // no error, no warning — so a straight .select() misses everything
  // past the first 1000 once an account's history grows past that.
  // Paginate in batches until a page comes back short of the page
  // size, which is the only reliable "that was the last page" signal.
  const PAGE_SIZE = 1000;
  const rows: { id: string; description: string; amount: string; category: string; subcategory: string | null }[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: page, error } = await admin
      .from("transactions")
      .select("id, description, amount, category, subcategory")
      .eq("user_id", userId)
      .eq("manually_overridden", false)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(page ?? []));
    if (!page || page.length < PAGE_SIZE) break;
  }

  const changes: { id: string; description: string; from: string; to: string }[] = [];
  for (const row of rows) {
    const { category, subcategory, confidence } = categoriseTransaction(row.description, Number(row.amount));
    if (category === row.category && subcategory === row.subcategory) continue;
    changes.push({
      id: row.id,
      description: row.description,
      from: `${row.category}${row.subcategory ? " · " + row.subcategory : ""}`,
      to: `${category}${subcategory ? " · " + subcategory : ""}`,
    });
    const { error: updateError } = await admin
      .from("transactions")
      .update({ category, subcategory, confidence })
      .eq("id", row.id);
    if (updateError) throw updateError;
  }

  console.log(`Checked ${rows?.length ?? 0} transactions, updated ${changes.length}.\n`);
  const byChange: Record<string, number> = {};
  for (const c of changes) {
    const key = `${c.from}  →  ${c.to}`;
    byChange[key] = (byChange[key] ?? 0) + 1;
  }
  for (const [key, count] of Object.entries(byChange).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count.toString().padStart(4)}  ${key}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
