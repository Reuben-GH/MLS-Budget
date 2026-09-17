import { classify, type ClassificationOverride } from "../../../lib/categories/classification";
import type { TopLevelCategory } from "../../../lib/categories/taxonomy";
import { ClassificationToggle } from "./ClassificationToggle";
import { AddSubcategoryForm } from "./AddSubcategoryForm";

interface CategoryCardProps {
  category: TopLevelCategory;
  builtinSubs: string[];
  customSubs: string[];
  overrides: ClassificationOverride[];
}

export function CategoryCard({ category, builtinSubs, customSubs, overrides }: CategoryCardProps) {
  const isIncome = category === "Income";
  const allSubs = [
    ...builtinSubs.map((name) => ({ name, isCustom: false })),
    ...customSubs.map((name) => ({ name, isCustom: true })),
  ];

  return (
    <div className="taxonomy-card">
      <div className="taxonomy-card-head">
        <span className="taxonomy-card-name">{category}</span>
        <span className="builtin-chip">Built-in</span>
      </div>

      <div className="sub-list">
        {isIncome ? (
          allSubs.length === 0 ? (
            <div className="no-subs">No subcategories yet</div>
          ) : (
            allSubs.map((s) => (
              <div className="sub-list-row" key={s.name}>
                <span className="sub-list-name">
                  {s.name}
                  {s.isCustom && <span className="custom-tag">added</span>}
                </span>
              </div>
            ))
          )
        ) : allSubs.length === 0 ? (
          <div className="sub-list-row">
            <span className="sub-list-name">Whole category</span>
            <ClassificationToggle category={category} subcategory={null} current={classify(category, null, overrides)} />
          </div>
        ) : (
          allSubs.map((s) => (
            <div className={"sub-list-row" + (s.isCustom ? " custom-sub" : "")} key={s.name}>
              <span className="sub-list-name">
                {s.name}
                {s.isCustom && <span className="custom-tag">added</span>}
              </span>
              <ClassificationToggle
                category={category}
                subcategory={s.name}
                current={classify(category, s.name, overrides)}
              />
            </div>
          ))
        )}
      </div>

      <AddSubcategoryForm category={category} />
    </div>
  );
}
