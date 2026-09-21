"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../../../lib/supabase/server";
import { TAXONOMY, topLevelCategorySchema, type TopLevelCategory } from "../../../lib/categories/taxonomy";
import { fdClassificationSchema, toSentinel, type FDClassification } from "../../../lib/categories/classification";

export async function addCustomSubcategory(
  topLevelCategory: TopLevelCategory,
  name: string
): Promise<{ error?: string } | undefined> {
  const parsedCategory = topLevelCategorySchema.safeParse(topLevelCategory);
  if (!parsedCategory.success) return { error: "Invalid category." };
  if (parsedCategory.data === "Transfer") return { error: "Transfer can't have subcategories." };

  const trimmed = name.trim();
  if (!trimmed) return { error: "Enter a name." };
  if (trimmed.length > 30) return { error: "Keep it under 30 characters." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("custom_subcategories").insert({
    user_id: user.id,
    top_level_category: parsedCategory.data,
    name: trimmed,
  });

  if (error) {
    if (error.code === "23505") return { error: "That subcategory already exists." };
    return { error: "Couldn't add that subcategory — try again." };
  }

  revalidatePath("/categories");
}

export async function setClassification(
  topLevelCategory: TopLevelCategory,
  subcategory: string | null,
  classification: FDClassification
): Promise<{ error?: string } | undefined> {
  const parsedCategory = topLevelCategorySchema.safeParse(topLevelCategory);
  if (!parsedCategory.success) return { error: "Invalid category." };
  if (parsedCategory.data === "Income") return { error: "Income isn't classified as Fixed/Discretionary." };
  if (parsedCategory.data === "Transfer") return { error: "Transfer isn't classified as Fixed/Discretionary." };

  const parsedClassification = fdClassificationSchema.safeParse(classification);
  if (!parsedClassification.success) return { error: "Invalid classification." };

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
    if (!recognized) return { error: "Unrecognised subcategory." };
  }

  const { error } = await supabase.from("category_classifications").upsert(
    {
      user_id: user.id,
      top_level_category: parsedCategory.data,
      subcategory: toSentinel(subcategory),
      classification: parsedClassification.data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,top_level_category,subcategory" }
  );

  if (error) return { error: "Couldn't save that — try again." };

  revalidatePath("/categories");
}

// Renames a custom subcategory. This has to update three tables together
// (the subcategory itself, plus every transaction and classification
// override currently using the old name — both store the name directly,
// not a reference), so it goes through a single Postgres function
// (rename_custom_subcategory, see the matching migration) rather than
// sequential calls: a partial failure here would silently orphan real
// transaction data, which a same-user retry can't detect or fix on its
// own — unlike a reassignment mistake, which is trivially re-editable.
export async function renameCustomSubcategory(
  id: string,
  newName: string
): Promise<{ error?: string } | undefined> {
  const trimmed = newName.trim();
  if (!trimmed) return { error: "Enter a name." };
  if (trimmed.length > 30) return { error: "Keep it under 30 characters." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.rpc("rename_custom_subcategory", {
    p_subcategory_id: id,
    p_new_name: trimmed,
  });

  if (error) {
    if (error.message.includes("duplicate_name")) return { error: "That subcategory already exists." };
    if (error.message.includes("not_found")) return { error: "Couldn't find that subcategory." };
    return { error: "Couldn't rename that — try again." };
  }

  revalidatePath("/categories");
  revalidatePath("/dashboard");
}
