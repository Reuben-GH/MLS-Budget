"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "../../../lib/supabase/server";
import { categoriseTransaction } from "../../../lib/categorisation/engine";
import { filterDuplicates, type DedupKey } from "../../../lib/statements/dedup";
import { deriveMerchantKey } from "../../../lib/categories/merchant-key";

const importRowSchema = z.object({
  txn_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  description: z.string().min(1).max(500),
  amount: z.number().finite(),
});

const MAX_ROWS = 5000;

export async function importTransactions(
  originalFilename: string,
  rows: unknown
): Promise<{ error: string } | { imported: number; skippedDuplicates: number }> {
  const parsedRows = z.array(importRowSchema).max(MAX_ROWS).safeParse(rows);
  if (!parsedRows.success) return { error: "That file didn't look right — check the column mapping." };
  if (parsedRows.data.length === 0) return { error: "No rows to import." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const incoming = parsedRows.data;
  const periodStart = incoming.reduce((min, r) => (r.txn_date < min ? r.txn_date : min), incoming[0].txn_date);
  const periodEnd = incoming.reduce((max, r) => (r.txn_date > max ? r.txn_date : max), incoming[0].txn_date);

  // Supabase caps a single select at 1000 rows by default, silently —
  // once an account has more than 1000 transactions in the incoming
  // file's date range (easily reached across a year of statements),
  // an unpaginated query here would silently miss existing rows to
  // dedup against, and re-import them as duplicates instead of
  // correctly skipping them.
  const DEDUP_PAGE_SIZE = 1000;
  const existingRows: { txn_date: string; description: string; amount: number }[] = [];
  for (let from = 0; ; from += DEDUP_PAGE_SIZE) {
    const { data: page, error: existingError } = await supabase
      .from("transactions")
      .select("txn_date, description, amount")
      .eq("user_id", user.id)
      .gte("txn_date", periodStart)
      .lte("txn_date", periodEnd)
      .range(from, from + DEDUP_PAGE_SIZE - 1);
    if (existingError) return { error: "Couldn't check for duplicates — try again." };
    existingRows.push(...(page ?? []));
    if (!page || page.length < DEDUP_PAGE_SIZE) break;
  }

  const existing: DedupKey[] = existingRows.map((r) => ({
    txn_date: r.txn_date,
    description: r.description,
    amount: Number(r.amount),
  }));

  const newRows = filterDuplicates(incoming, existing);
  const skippedDuplicates = incoming.length - newRows.length;

  if (newRows.length === 0) {
    return { imported: 0, skippedDuplicates };
  }

  const { data: statement, error: statementError } = await supabase
    .from("statements")
    .insert({
      user_id: user.id,
      // No real file storage exists yet — this is an audit label, not a
      // retrievable file reference. Adding real Supabase Storage would
      // be needed to make this a working "redownload the original" link.
      file_path: `client-import/${user.id}/${Date.now()}-${originalFilename.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`,
      original_filename: originalFilename,
      period_start: periodStart,
      period_end: periodEnd,
      status: "parsing",
    })
    .select()
    .single();
  if (statementError || !statement) return { error: "Couldn't start the import — try again." };

  // Merchants the user has already corrected before win over the
  // generic keyword rules — a direct prior correction is more
  // trustworthy than a best-effort guess. Fetched once per import,
  // not once per row.
  const { data: memoryRows } = await supabase
    .from("merchant_memory")
    .select("merchant_key, category, subcategory")
    .eq("user_id", user.id);
  const memory = new Map((memoryRows ?? []).map((m) => [m.merchant_key, m]));

  const transactionRows = newRows.map((row) => {
    const remembered = memory.get(deriveMerchantKey(row.description));
    const { category, subcategory, confidence } = remembered
      ? { category: remembered.category, subcategory: remembered.subcategory, confidence: 1.0 }
      : categoriseTransaction(row.description, row.amount);
    return {
      statement_id: statement.id,
      user_id: user.id,
      txn_date: row.txn_date,
      description: row.description,
      amount: row.amount,
      category,
      subcategory,
      confidence,
    };
  });

  const { error: insertError } = await supabase.from("transactions").insert(transactionRows);
  if (insertError) {
    await supabase.from("statements").update({ status: "error" }).eq("id", statement.id);
    return { error: "Couldn't save the transactions — try again." };
  }

  await supabase.from("statements").update({ status: "parsed" }).eq("id", statement.id);

  revalidatePath("/dashboard");
  return { imported: newRows.length, skippedDuplicates };
}
