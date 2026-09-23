// Pure parsing/validation logic for scripts/apply-other-corrections.ts,
// extracted out so it's independently testable — same reasoning as
// lib/transactions/reassign.ts: no Server Action/DB call here, just
// "given this input, what should happen."

import Papa from "papaparse";
import { TOP_LEVEL_CATEGORIES, TAXONOMY, type TopLevelCategory } from "./taxonomy";

export interface CorrectionInputRow {
  Pattern: string;
  Category: string;
  Subcategory: string;
}

export interface ParsedCorrection {
  merchantKey: string;
  category: TopLevelCategory;
  subcategory: string | null;
  // A non-null subcategory that isn't one of the category's fixed
  // built-in options needs to be created as a custom subcategory
  // before it can be used — the caller (which has DB access) does
  // that insert; this function only identifies when it's needed.
  isNewCustomSubcategory: boolean;
}

export function resolveCategory(raw: string): TopLevelCategory | null {
  const trimmed = raw.trim();
  const match = TOP_LEVEL_CATEGORIES.find((c) => c.toLowerCase() === trimmed.toLowerCase());
  return match ?? null;
}

export function parseCorrectionsCsv(csvText: string): { corrections: ParsedCorrection[]; skipped: string[] } {
  const { data } = Papa.parse<CorrectionInputRow>(csvText, { header: true, skipEmptyLines: true });

  const corrections: ParsedCorrection[] = [];
  const skipped: string[] = [];

  for (const row of data) {
    const rawCategory = (row.Category ?? "").trim();
    if (!rawCategory) continue; // left blank — stays Other, nothing to do

    const pattern = (row.Pattern ?? "").trim();
    const category = resolveCategory(rawCategory);
    if (!category) {
      skipped.push(`"${pattern}": "${rawCategory}" isn't a valid category`);
      continue;
    }

    const subcategoryRaw = (row.Subcategory ?? "").trim();
    if (!subcategoryRaw) {
      corrections.push({ merchantKey: pattern, category, subcategory: null, isNewCustomSubcategory: false });
      continue;
    }

    if (category === "Transfer") {
      skipped.push(`"${pattern}": Transfer can't have a subcategory ("${subcategoryRaw}" ignored)`);
      continue;
    }

    const isBuiltin = (TAXONOMY[category] as readonly string[]).includes(subcategoryRaw);
    corrections.push({
      merchantKey: pattern,
      category,
      subcategory: subcategoryRaw,
      isNewCustomSubcategory: !isBuiltin,
    });
  }

  return { corrections, skipped };
}
