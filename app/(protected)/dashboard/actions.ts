"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../../../lib/supabase/server";
import { topLevelCategorySchema, isValidSubcategory, TAXONOMY, type TopLevelCategory } from "../../../lib/categories/taxonomy";
import { buildReassignUpdate } from "../../../lib/transactions/reassign";

export async function reassignTransactionCategory(
  transactionId: string,
  category: TopLevelCategory,
  subcategory: string | null
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
    if (!recognized || !isValidSubcategory(parsedCategory.data, subcategory)) {
      return { error: "Unrecognised subcategory." };
    }
  }

  const { data: existing, error: fetchError } = await supabase
    .from("transactions")
    .select("category, manually_overridden")
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

  revalidatePath("/dashboard");
}
