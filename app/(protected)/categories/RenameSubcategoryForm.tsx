"use client";

import { useState, useTransition, type FormEvent } from "react";
import { renameCustomSubcategory } from "./actions";

interface RenameSubcategoryFormProps {
  id: string;
  currentName: string;
}

export function RenameSubcategoryForm({ id, currentName }: RenameSubcategoryFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === currentName) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      const result = await renameCustomSubcategory(id, trimmed);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setError(null);
    });
  }

  if (!open) {
    return (
      <button type="button" className="rename-sub-link" onClick={() => setOpen(true)}>
        rename
      </button>
    );
  }

  return (
    <>
      <form className="add-sub-form" onSubmit={handleSubmit}>
        <input
          type="text"
          maxLength={30}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          onFocus={(e) => e.target.select()}
        />
        <button type="submit" disabled={isPending}>
          Save
        </button>
        <button type="button" onClick={() => { setOpen(false); setName(currentName); setError(null); }}>
          Cancel
        </button>
      </form>
      {error && <div className="form-error">{error}</div>}
    </>
  );
}
