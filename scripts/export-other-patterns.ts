import { config } from "dotenv";
import * as fs from "node:fs";
import * as path from "node:path";
import Papa from "papaparse";
import { clientAs } from "../tests/helpers/test-auth";
import { deriveMerchantKey } from "../lib/categories/merchant-key";
import { TOP_LEVEL_CATEGORIES } from "../lib/categories/taxonomy";

// Exports the "Other" transactions worth a client's time to review, as
// a small CSV they can fill in and hand back — grouped by merchant
// pattern (the same key merchant memory uses) rather than one row per
// transaction, so one answer fixes every matching transaction at once,
// past and future. Read-only — makes no changes on its own; pair with
// apply-other-corrections.ts once the file comes back filled in.
config({ path: ".env.local" });

const EMAIL = "reg.grantham@gmail.com";
const PASSWORD = "MyLifeSortedDemo2026!";
const PAGE_SIZE = 1000;
const OUT_DIR = path.join(process.cwd(), "exports");

async function main() {
  const threshold = Number(process.argv[2] ?? 500);

  const { client, userId } = await clientAs(EMAIL, PASSWORD);

  const rows: { description: string; amount: number }[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from("transactions")
      .select("description, amount")
      .eq("user_id", userId)
      .eq("category", "Other")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  const groups = new Map<string, { sample: string; count: number; total: number }>();
  for (const r of rows) {
    const key = deriveMerchantKey(r.description);
    const g = groups.get(key) ?? { sample: r.description, count: 0, total: 0 };
    g.count++;
    g.total += Number(r.amount);
    groups.set(key, g);
  }

  const ranked = [...groups.entries()]
    .filter(([, g]) => Math.abs(g.total) >= threshold)
    .sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total))
    .map(([key, g]) => ({
      Pattern: key,
      "Sample description": g.sample,
      Count: g.count,
      "Total $": g.total.toFixed(2),
      Category: "",
      Subcategory: "",
    }));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const csvPath = path.join(OUT_DIR, "other-transactions-for-review.csv");
  fs.writeFileSync(csvPath, Papa.unparse(ranked));

  const instructionsPath = path.join(OUT_DIR, "instructions.txt");
  fs.writeFileSync(
    instructionsPath,
    [
      "HOW TO FILL IN THIS FILE",
      "",
      "Each row is a group of transactions that share the same description",
      "pattern — fixing one row fixes every matching transaction, past AND",
      "future statements alike.",
      "",
      "For any row you recognise, type the category into the 'Category'",
      "column, using EXACTLY one of these names (capitalisation doesn't matter):",
      "",
      ...TOP_LEVEL_CATEGORIES.filter((c) => c !== "Other").map((c) => `  - ${c}`),
      "",
      "'Subcategory' is optional. Use an existing one (e.g. 'Groceries' under",
      "Food) or make up a new one — just leave it blank for Transfer, which",
      "doesn't use subcategories.",
      "",
      "Leave a row's Category blank to leave it as 'Other' — you don't need to",
      "fill in every row, only the ones you recognise.",
      "",
      "Please don't edit the Pattern, Sample description, Count, or Total $",
      "columns — they're just there for reference; only Category and",
      "Subcategory are read back in.",
      "",
      `This file only includes patterns worth at least $${threshold} in total —`,
      "smaller one-off purchases aren't included, since there's rarely enough",
      "in the bank description to identify them anyway.",
    ].join("\n")
  );

  const covered = ranked.reduce((s, r) => s + r.Count, 0);
  console.log(`Wrote ${ranked.length} patterns (>= $${threshold} total) to:`);
  console.log(`  ${csvPath}`);
  console.log(`  ${instructionsPath}`);
  console.log(`\n${rows.length} "Other" transactions in total; this file covers ${covered} of them.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
