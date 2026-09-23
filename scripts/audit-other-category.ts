import { config } from "dotenv";
import { clientAs } from "../tests/helpers/test-auth";
import { deriveMerchantKey } from "../lib/categories/merchant-key";

// Read-only diagnostic — makes no changes. "Other" is the category's
// catch-all for anything the keyword engine didn't recognise, which
// after a real, growing account gets too large to review one
// transaction at a time. Reading every row in date order (2900+ of
// them) is the wrong shape of work for a human OR an LLM to review
// well; grouping by merchant pattern turns it into a short, ranked
// list of *decisions* instead — "is this recurring pattern really
// income/a transfer/fine as Other" — which is the part that actually
// needs a person's judgement. Rerunnable any time the account grows.
config({ path: ".env.local" });

const EMAIL = "reg.grantham@gmail.com";
const PASSWORD = "MyLifeSortedDemo2026!";
const LARGE_THRESHOLD = 2000;
const PAGE_SIZE = 1000;

interface Row {
  txn_date: string;
  description: string;
  amount: number;
}

async function main() {
  const { client, userId } = await clientAs(EMAIL, PASSWORD);

  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from("transactions")
      .select("txn_date, description, amount")
      .eq("user_id", userId)
      .eq("category", "Other")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  console.log(`\n${rows.length} transactions currently sitting in "Other".\n`);

  // Group by normalised merchant key — same key the merchant-memory
  // feature uses, so a group here maps directly to "one correction
  // would fix all of these."
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const key = deriveMerchantKey(r.description);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const ranked = [...groups.entries()]
    .map(([key, group]) => {
      const total = group.reduce((s, r) => s + r.amount, 0);
      const credits = group.filter((r) => r.amount > 0).length;
      const debits = group.filter((r) => r.amount < 0).length;
      const sign = credits > 0 && debits > 0 ? "mixed" : credits > 0 ? "credit" : "debit";
      return { key, count: group.length, total, sign, sample: group[0].description };
    })
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

  console.log("=== Top 40 patterns by total dollar impact (grouped by normalised description) ===\n");
  console.log("sign     count    total $      pattern");
  for (const g of ranked.slice(0, 40)) {
    console.log(
      `${g.sign.padEnd(8)} ${String(g.count).padStart(5)}   ${g.total.toFixed(2).padStart(10)}   ${g.key}`
    );
  }

  const large = rows
    .filter((r) => Math.abs(r.amount) >= LARGE_THRESHOLD)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  console.log(`\n=== Individual transactions >= $${LARGE_THRESHOLD} (each one, not grouped) ===\n`);
  for (const r of large) {
    console.log(`${r.txn_date}   ${r.amount.toFixed(2).padStart(12)}   ${r.description}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
