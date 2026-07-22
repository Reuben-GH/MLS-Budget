"use client";

import { useTransition } from "react";
import { setClassification } from "./actions";
import type { TopLevelCategory } from "../../../lib/categories/taxonomy";
import type { FDClassification } from "../../../lib/categories/classification";

interface ClassificationToggleProps {
  category: TopLevelCategory;
  subcategory: string | null;
  current: FDClassification;
}

export function ClassificationToggle({ category, subcategory, current }: ClassificationToggleProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick(value: FDClassification) {
    startTransition(async () => {
      await setClassification(category, subcategory, value);
    });
  }

  return (
    <div className="fd-toggle">
      <button
        type="button"
        className={"fixed" + (current === "fixed" ? " active" : "")}
        disabled={isPending}
        onClick={() => handleClick("fixed")}
      >
        Fixed
      </button>
      <button
        type="button"
        className={"discretionary" + (current === "discretionary" ? " active" : "")}
        disabled={isPending}
        onClick={() => handleClick("discretionary")}
      >
        Discretionary
      </button>
    </div>
  );
}
