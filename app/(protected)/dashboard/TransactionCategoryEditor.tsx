"use client";

import { useState, useTransition } from "react";
import { TAXONOMY, TOP_LEVEL_CATEGORIES, type TopLevelCategory } from "../../../lib/categories/taxonomy";
import { reassignTransactionCategory } from "./actions";

interface TransactionCategoryEditorProps {
  transactionId: string;
  category: TopLevelCategory;
  subcategory: string | null;
  customSubcategories: Record<string, string[]>;
}

export function TransactionCategoryEditor({
  transactionId,
  category,
  subcategory,
  customSubcategories,
}: TransactionCategoryEditorProps) {
  const [open, setOpen] = useState(false);
  const [nextCategory, setNextCategory] = useState<TopLevelCategory>(category);
  const [nextSubcategory, setNextSubcategory] = useState<string>(subcategory ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const availableSubs = [...(TAXONOMY[nextCategory] as readonly string[]), ...(customSubcategories[nextCategory] ?? [])];

  function handleOpen() {
    setNextCategory(category);
    setNextSubcategory(subcategory ?? "");
    setError(null);
    setOpen(true);
  }

  function handleSave() {
    startTransition(async () => {
      const result = await reassignTransactionCategory(
        transactionId,
        nextCategory,
        nextSubcategory || null
      );
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <span className="chip chip-editable" onClick={handleOpen} title="Click to change category">
        {category}
        {subcategory ? ` · ${subcategory}` : ""}
      </span>
    );
  }

  return (
    <div className="txn-category-editor">
      <select
        value={nextCategory}
        onChange={(e) => {
          setNextCategory(e.target.value as TopLevelCategory);
          setNextSubcategory("");
        }}
      >
        {TOP_LEVEL_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {availableSubs.length > 0 && (
        <select value={nextSubcategory} onChange={(e) => setNextSubcategory(e.target.value)}>
          <option value="">(no subcategory)</option>
          {availableSubs.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      )}
      <button type="button" className="btn-save" onClick={handleSave} disabled={isPending}>
        Save
      </button>
      <button type="button" className="btn-cancel" onClick={() => setOpen(false)} disabled={isPending}>
        Cancel
      </button>
      {error && <div className="form-error">{error}</div>}
    </div>
  );
}
