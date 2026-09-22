"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../../../lib/supabase/server";
import { topLevelCategorySchema, TAXONOMY, type TopLevelCategory } from "../../../lib/categories/taxonomy";
import { buildReassignUpdate, applyMerchantMemory } from "../../../lib/transactions/reassign";
import { deriveMerchantKey } from "../../../lib/categories/merchant-key";

export async function reassignTransactionCategory(
  transactionId: string,
  category: TopLevelCategory,
  subcategory: string | null,
  applyToAllFromMerchant: boolean
): Promise<{ error?: string } | undefined> {
  const parsedCategory = topLevelCategorySchema.safeParse(category);
  if (!parsedCategory.success) return { error: "Invalid category." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  if (subcategory) {
    const builtinSubs = TAXONOMY[parsedCategory.data] as readonly string[];
    let recognized = builtinSubs.includes(subcategory);
    if (!recognized) {
      const { data: customMatch } = await supabase
        .from("custom_subcategories")
        .select("id")
        .eq("user_id", user.id)
        .eq("top_level_category", parsedCategory.data)
        .ilike("name", subcategory)
        .maybeSingle();
      recognized = !!customMatch;
    }
    if (!recognized) {
      return { error: "Unrecognised subcategory." };
    }
  }

  const { data: existing, error: fetchError } = await supabase
    .from("transactions")
    .select("description, category, manually_overridden")
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .single();
  if (fetchError || !existing) return { error: "Couldn't find that transaction." };

  const update = buildReassignUpdate(existing, { category: parsedCategory.data, subcategory });

  const { error } = await supabase
    .from("transactions")
    .update(update)
    .eq("id", transactionId)
    .eq("user_id", user.id);
  if (error) return { error: "Couldn't save that — try again." };

  // Remember this merchant, then apply the same correction to every
  // other transaction from it that the user hasn't separately
  // corrected themselves — see lib/transactions/reassign.ts's
  // applyMerchantMemory for why manually_overridden rows are excluded.
  // Skipped entirely when the user asked to fix just this one
  // transaction: it's already saved above (and already marked
  // manually_overridden, so it's immune to any future merchant-wide
  // correction too) — teaching the merchant memory or touching any
  // other transaction here would undo the point of a one-off fix.
  if (applyToAllFromMerchant) {
    const merchantKey = deriveMerchantKey(existing.description);
    await supabase.from("merchant_memory").upsert(
      {
        user_id: user.id,
        merchant_key: merchantKey,
        category: parsedCategory.data,
        subcategory,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,merchant_key" }
    );

    const { data: candidates } = await supabase
      .from("transactions")
      .select("id, description, category, manually_overridden, original_category")
      .eq("user_id", user.id)
      .eq("manually_overridden", false)
      .neq("id", transactionId);

    const backfillUpdates = applyMerchantMemory(candidates ?? [], merchantKey, parsedCategory.data, subcategory);
    await Promise.all(
      backfillUpdates.map(({ id, ...fields }) =>
        supabase.from("transactions").update(fields).eq("id", id).eq("user_id", user.id)
      )
    );
  }

  revalidatePath("/dashboard");
}
