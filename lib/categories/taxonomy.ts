import { z } from "zod";

// Fixed category taxonomy. The categorisation engine (a later phase)
// must not invent new top-level categories — this is the single
// source of truth every layer (fixtures, schema checks, categoriser
// output validation) checks against.
export const TAXONOMY = {
  Income: ["Salary", "Investment", "Government", "Other"],
  Housing: ["Mortgage/Rent", "Rates", "Insurance", "Maintenance"],
  Utilities: ["Electricity", "Gas", "Water", "Internet/Phone"],
  Transport: ["Fuel", "Public Transport", "Insurance", "Tolls", "Maintenance"],
  Food: ["Groceries", "Dining"],
  Health: ["Insurance", "Medical", "Pharmacy"],
  Education: [],
  Personal: ["Shopping", "Subscriptions"],
  Recreation: [],
  Financial: ["Fees", "Loan repayments other than mortgage"],
  Other: [],
  // Money moving between a household's own accounts — a savings/holiday
  // transfer, paying off a credit card — is neither income nor spending.
  // No subcategories: it's excluded from Fixed/Discretionary and every
  // other classification concept (see classification.ts's Transfer guard
  // and aggregate.ts's isTransferCategory() exclusions).
  Transfer: [],
} as const;

export type TopLevelCategory = keyof typeof TAXONOMY;

export const TOP_LEVEL_CATEGORIES = Object.keys(TAXONOMY) as TopLevelCategory[];

export const topLevelCategorySchema = z.enum(
  TOP_LEVEL_CATEGORIES as [TopLevelCategory, ...TopLevelCategory[]]
);

export function isValidTopLevelCategory(category: string): category is TopLevelCategory {
  return (TOP_LEVEL_CATEGORIES as string[]).includes(category);
}

export function isValidSubcategory(category: TopLevelCategory, subcategory: string | null | undefined): boolean {
  if (!subcategory) return true; // subcategory is optional
  const allowed = TAXONOMY[category] as readonly string[];
  return allowed.length === 0 || allowed.includes(subcategory);
}

// Sign convention (see docs/data-model.md): debits negative, credits
// (including refunds) positive. total_expenses is therefore the
// negated sum of non-Income rows, so a positive refund under e.g.
// Personal/Shopping nets against that category's spend without ever
// touching total_income.
export function isIncomeCategory(category: string): boolean {
  return category === "Income";
}

export function isTransferCategory(category: string): boolean {
  return category === "Transfer";
}
