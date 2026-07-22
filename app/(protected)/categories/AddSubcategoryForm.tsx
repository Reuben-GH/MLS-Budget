"use client";

import { useState, useTransition, type FormEvent } from "react";
import { addCustomSubcategory } from "./actions";
import type { TopLevelCategory } from "../../../lib/categories/taxonomy";

interface AddSubcategoryFormProps {
  category: TopLevelCategory;
}

export function AddSubcategoryForm({ category }: AddSubcategoryFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const result = await addCustomSubcategory(category, trimmed);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setName("");
      setOpen(false);
      setError(null);
    });
  }

  return (
    <>
      <div className="add-sub-row">
        <button type="button" className="add-sub-link" onClick={() => setOpen((o) => !o)}>
          + Add subcategory
        </button>
      </div>
      {open && (
        <form className="add-sub-form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="e.g. Streaming"
            maxLength={30}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <button type="submit" disabled={isPending}>
            Add
          </button>
        </form>
      )}
      {error && <div className="form-error">{error}</div>}
    </>
  );
}
