import type { TopLevelCategory } from "../../lib/categories/taxonomy";

export interface FixtureTransaction {
  txn_date: string; // YYYY-MM-DD
  description: string;
  amount: number; // positive = credit, negative = debit (see docs/data-model.md)
  expected_category: TopLevelCategory;
  expected_subcategory: string | null;
}

// March 2026, fictional. See Section 5 of the Budget Module Build
// Brief. The refund row is deliberate: a positive amount that is NOT
// income — it must net against Personal/Shopping, not inflate income.
export const MARCH_2026_TRANSACTIONS: FixtureTransaction[] = [
  { txn_date: "2026-03-01", description: "SALARY XYZ PTY LTD", amount: 6200.00, expected_category: "Income", expected_subcategory: "Salary" },
  { txn_date: "2026-03-03", description: "WOOLWORTHS 2145", amount: -142.35, expected_category: "Food", expected_subcategory: "Groceries" },
  { txn_date: "2026-03-03", description: "COLES SUPERMARKETS", amount: -98.20, expected_category: "Food", expected_subcategory: "Groceries" },
  { txn_date: "2026-03-05", description: "AGL ELECTRICITY", amount: -210.00, expected_category: "Utilities", expected_subcategory: "Electricity" },
  { txn_date: "2026-03-06", description: "SA WATER", amount: -85.40, expected_category: "Utilities", expected_subcategory: "Water" },
  { txn_date: "2026-03-07", description: "BUPA HEALTH INSURANCE", amount: -320.00, expected_category: "Health", expected_subcategory: "Insurance" },
  { txn_date: "2026-03-08", description: "NRMA CAR INSURANCE", amount: -140.00, expected_category: "Transport", expected_subcategory: "Insurance" },
  { txn_date: "2026-03-10", description: "SHELL COLES EXPRESS FUEL", amount: -78.50, expected_category: "Transport", expected_subcategory: "Fuel" },
  { txn_date: "2026-03-10", description: "TOLL - LINKT", amount: -45.00, expected_category: "Transport", expected_subcategory: "Tolls" },
  { txn_date: "2026-03-12", description: "COMMBANK HOME LOAN", amount: -3062.70, expected_category: "Housing", expected_subcategory: "Mortgage/Rent" },
  { txn_date: "2026-03-14", description: "COUNCIL RATES CITY OF ADELAIDE", amount: -412.00, expected_category: "Housing", expected_subcategory: "Rates" },
  { txn_date: "2026-03-15", description: "NETFLIX.COM", amount: -22.99, expected_category: "Recreation", expected_subcategory: null },
  { txn_date: "2026-03-16", description: "JB HI-FI", amount: -299.00, expected_category: "Personal", expected_subcategory: "Shopping" },
  { txn_date: "2026-03-18", description: "DIVIDEND CBA SHARES", amount: 185.40, expected_category: "Income", expected_subcategory: "Investment" },
  { txn_date: "2026-03-20", description: "CENTRELINK PAYMENT", amount: 550.00, expected_category: "Income", expected_subcategory: "Government" },
  // Deliberate edge case: a positive amount that is NOT income — must
  // net against Personal/Shopping, not be miscategorised as income.
  { txn_date: "2026-03-22", description: "REFUND AMAZON AU", amount: 45.00, expected_category: "Personal", expected_subcategory: "Shopping" },
  { txn_date: "2026-03-25", description: "SCHOOL FEES ST MARYS", amount: -890.00, expected_category: "Education", expected_subcategory: null },
  { txn_date: "2026-03-28", description: "GYM MEMBERSHIP FITNESS FIRST", amount: -59.90, expected_category: "Recreation", expected_subcategory: null },
];
