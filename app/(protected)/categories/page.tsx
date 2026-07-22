import { createClient } from "../../../lib/supabase/server";
import { TAXONOMY, TOP_LEVEL_CATEGORIES, type TopLevelCategory } from "../../../lib/categories/taxonomy";
import { fromSentinel, type ClassificationOverride, type FDClassification } from "../../../lib/categories/classification";
import { CategoryCard } from "./CategoryCard";

export default async function CategoriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // the (protected) layout already redirects; satisfies TypeScript

  const { data: customRows } = await supabase
    .from("custom_subcategories")
    .select("top_level_category, name")
    .eq("user_id", user.id);

  const { data: classificationRows } = await supabase
    .from("category_classifications")
    .select("top_level_category, subcategory, classification")
    .eq("user_id", user.id);

  const overrides: ClassificationOverride[] = (classificationRows ?? []).map((r) => ({
    category: r.top_level_category as TopLevelCategory,
    subcategory: fromSentinel(r.subcategory),
    classification: r.classification as FDClassification,
  }));

  const customByCategory = new Map<TopLevelCategory, string[]>();
  for (const row of customRows ?? []) {
    const cat = row.top_level_category as TopLevelCategory;
    if (!customByCategory.has(cat)) customByCategory.set(cat, []);
    customByCategory.get(cat)!.push(row.name);
  }

  return (
    <>
      <div className="card">
        <div className="taxonomy-note">
          The 11 top-level categories are <strong>built-in</strong> — every transaction always
          rolls up to one of these, which keeps totals consistent no matter how much subcategory
          detail gets added underneath. Subcategories can be added freely to any category.
        </div>
        <div className="taxonomy-note">
          Every subcategory is also tagged <strong>Fixed</strong> or <strong>Discretionary</strong>{" "}
          — a starting suggestion is applied automatically, but it&apos;s yours to change.
          Fixed/Discretionary is a client judgment call, not a system rule.
        </div>
      </div>
      <div className="taxonomy-grid">
        {TOP_LEVEL_CATEGORIES.map((category) => (
          <CategoryCard
            key={category}
            category={category}
            builtinSubs={[...TAXONOMY[category]]}
            customSubs={customByCategory.get(category) ?? []}
            overrides={overrides}
          />
        ))}
      </div>
    </>
  );
}
