import { classify, type ClassificationOverride } from "../../../lib/categories/classification";
import type { TopLevelCategory } from "../../../lib/categories/taxonomy";
import { ClassificationToggle } from "./ClassificationToggle";
import { AddSubcategoryForm } from "./AddSubcategoryForm";
import { RenameSubcategoryForm } from "./RenameSubcategoryForm";

interface CustomSub {
  id: string;
  name: string;
}

interface CategoryCardProps {
  category: TopLevelCategory;
  builtinSubs: string[];
  customSubs: CustomSub[];
  overrides: ClassificationOverride[];
}

export function CategoryCard({ category, builtinSubs, customSubs, overrides }: CategoryCardProps) {
  const isIncome = category === "Income";
  const allSubs = [
    ...builtinSubs.map((name) => ({ id: null, name, isCustom: false })),
    ...customSubs.map((s) => ({ id: s.id, name: s.name, isCustom: true })),
  ];

  const nameTag = (s: (typeof allSubs)[number]) =>
    s.isCustom ? (
      <>
        <span className="custom-tag">added</span>
        <RenameSubcategoryForm id={s.id!} currentName={s.name} />
      </>
    ) : null;

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
                  {nameTag(s)}
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
                {nameTag(s)}
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
