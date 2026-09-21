import { z } from "zod";
import type { TopLevelCategory } from "./taxonomy";

export type FDClassification = "fixed" | "discretionary";
export const fdClassificationSchema = z.enum(["fixed", "discretionary"]);

type CategoryDefault = FDClassification | Record<string, FDClassification>;

// Suggested starting points only — every one of these is a client
// judgment call (see the Categories page), fully overridable via the
// category_classifications table. Income is intentionally absent:
// Fixed/Discretionary is a spend-only concept, and callers must never
// invoke classify() for Income.
export const DEFAULT_FD_CLASSIFICATION: Partial<Record<TopLevelCategory, CategoryDefault>> = {
  Housing: {
    "Mortgage/Rent": "fixed",
    Rates: "fixed",
    Insurance: "fixed",
    Maintenance: "discretionary",
  },
  Utilities: {
    Electricity: "fixed",
    Gas: "fixed",
    Water: "fixed",
    "Internet/Phone": "fixed",
  },
  Transport: {
    Fuel: "discretionary",
    "Public Transport": "discretionary",
    Insurance: "fixed",
    Tolls: "discretionary",
    Maintenance: "discretionary",
  },
  Food: {
    Groceries: "fixed",
    Dining: "discretionary",
  },
  Health: {
    Insurance: "fixed",
    Medical: "fixed",
    Pharmacy: "fixed",
  },
  Education: "fixed",
  Personal: {
    Shopping: "discretionary",
    Subscriptions: "discretionary",
  },
  Recreation: "discretionary",
  Financial: {
    Fees: "fixed",
    "Loan repayments other than mortgage": "fixed",
  },
  Other: "discretionary",
};

export interface ClassificationOverride {
  category: TopLevelCategory;
  subcategory: string | null;
  classification: FDClassification;
}

// The category_classifications table uses '' as the sentinel for "the
// bare category, no subcategory" (see the schema migration for why
// NULL was avoided). This is the one seam that translates it — every
// other layer works in terms of `string | null`, matching how
// transactions.subcategory already reads everywhere else.
export function toSentinel(subcategory: string | null): string {
  return subcategory ?? "";
}
export function fromSentinel(subcategory: string): string | null {
  return subcategory === "" ? null : subcategory;
}

const SAFE_FALLBACK: FDClassification = "discretionary";

// 3-tier lookup: an explicit override always wins, then the hardcoded
// default, then a safe fallback — which is what makes a brand-new
// custom subcategory correctly read as Discretionary with no extra
// code (it will never appear in DEFAULT_FD_CLASSIFICATION).
export function classify(
  category: TopLevelCategory,
  subcategory: string | null,
  overrides: ClassificationOverride[]
): FDClassification {
  if (category === "Transfer") {
    throw new Error("classify() must never be called with Transfer — same invariant as Income");
  }

  const override = overrides.find(
    (o) => o.category === category && o.subcategory === subcategory
  );
  if (override) return override.classification;

  const categoryDefault = DEFAULT_FD_CLASSIFICATION[category];
  if (typeof categoryDefault === "string") return categoryDefault;
  if (categoryDefault && subcategory && categoryDefault[subcategory]) {
    return categoryDefault[subcategory];
  }

  return SAFE_FALLBACK;
}
