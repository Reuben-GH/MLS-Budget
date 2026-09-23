import { config } from "dotenv";
import * as fs from "node:fs";
import { clientAs } from "../tests/helpers/test-auth";
import { createAdminClient } from "../lib/supabase/admin";
import { parseCorrectionsCsv } from "../lib/categories/other-corrections";
import { applyMerchantMemory, type MemoryBackfillCandidate } from "../lib/transactions/reassign";

// Reads a filled-in copy of export-other-patterns.ts's output and
// applies it: each corrected pattern is written into merchant_memory
// (the same table the dashboard's "apply to all transactions from
// this merchant" checkbox writes to) and then backfilled onto every
// current transaction matching it — so this is permanent, not a
// one-time patch. A brand-new subcategory name is created on the fly,
// same as typing one into the Categories page would. Row-level parsing
// and validation lives in lib/categories/other-corrections.ts and is
// unit-tested there — this file is just the I/O around it.
config({ path: ".env.local" });

const EMAIL = "reg.grantham@gmail.com";
const PASSWORD = "MyLifeSortedDemo2026!";
const PAGE_SIZE = 1000;

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx scripts/apply-other-corrections.ts <filled-in-csv-path>");
    process.exit(1);
  }

  const csvText = fs.readFileSync(filePath, "utf-8");
  const { corrections, skipped } = parseCorrectionsCsv(csvText);

  if (corrections.length === 0) {
    console.log("No usable corrections found in that file.");
    if (skipped.length) console.log("\nSkipped:\n" + skipped.map((s) => `  - ${s}`).join("\n"));
    return;
  }

  const { userId } = await clientAs(EMAIL, PASSWORD);
  const admin = createAdminClient();

  const failedMerchantKeys = new Set<string>();
  for (const c of corrections) {
    if (!c.isNewCustomSubcategory || !c.subcategory) continue;
    const { error } = await admin.from("custom_subcategories").insert({
      user_id: userId,
      top_level_category: c.category,
      name: c.subcategory,
    });
    // 23505 = already exists (a prior run, or a different casing of an
    // existing custom name) — fine either way, carry on.
    if (error && error.code !== "23505") {
      skipped.push(`"${c.merchantKey}": couldn't save subcategory "${c.subcategory}" (${error.message})`);
      failedMerchantKeys.add(c.merchantKey);
    }
  }
  const usable = corrections.filter((c) => !failedMerchantKeys.has(c.merchantKey));

  const now = new Date().toISOString();
  for (const c of usable) {
    const { error } = await admin.from("merchant_memory").upsert(
      { user_id: userId, merchant_key: c.merchantKey, category: c.category, subcategory: c.subcategory, updated_at: now },
      { onConflict: "user_id,merchant_key" }
    );
    if (error) throw error;
  }

  // Supabase's silent 1000-row default cap — paginate the full
  // candidate pool before backfilling, or a wide correction would
  // quietly miss everything past the first page.
  const candidates: MemoryBackfillCandidate[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from("transactions")
      .select("id, description, category, manually_overridden, original_category")
      .eq("user_id", userId)
      .eq("manually_overridden", false)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    candidates.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  let totalUpdated = 0;
  for (const c of usable) {
    const updates = applyMerchantMemory(candidates, c.merchantKey, c.category, c.subcategory);
    for (const { id, ...fields } of updates) {
      const { error } = await admin.from("transactions").update(fields).eq("id", id).eq("user_id", userId);
      if (error) throw error;
    }
    totalUpdated += updates.length;
    console.log(
      `  "${c.merchantKey}" -> ${c.category}${c.subcategory ? " - " + c.subcategory : ""}  (${updates.length} transactions)`
    );
  }

  console.log(`\nApplied ${usable.length} corrections across ${totalUpdated} transactions.`);
  if (skipped.length) console.log("\nSkipped rows:\n" + skipped.map((s) => `  - ${s}`).join("\n"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
