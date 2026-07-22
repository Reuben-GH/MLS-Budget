import { describe, test, beforeAll, afterAll } from "vitest";
import { clientAs, deleteTestUser } from "./helpers/test-auth";
import { loadFixture, wipeUserData } from "./helpers/test-db";
import { assertCategoryTaxonomyValid, assertMonthlyTotals, assertSurplus } from "./shared/assertions";
import { MARCH_2026_TRANSACTIONS } from "./fixtures/march-2026-transactions";
import { MARCH_2026_EXPECTED } from "./fixtures/march-2026-expected";

// Phase 0: prove the aggregation contract independent of the
// categorisation contract. Categories are seeded directly from the
// fixture's `expected_category` (as if categorisation had already run
// correctly) — when Phase 3's real categoriser lands, only the
// seeding step changes; assertCategoryTaxonomyValid/assertMonthlyTotals/
// assertSurplus are called identically.

const TEST_EMAIL = "phase0-fixture-test@example.com";
const TEST_PASSWORD = "test-password-not-a-real-account-123!";

let userId: string;
let client: Awaited<ReturnType<typeof clientAs>>["client"];

beforeAll(async () => {
  const signedIn = await clientAs(TEST_EMAIL, TEST_PASSWORD);
  userId = signedIn.userId;
  client = signedIn.client;
  await wipeUserData(userId); // clean slate in case a previous run left data behind
  await loadFixture(userId, MARCH_2026_EXPECTED.month, "2026-03-31", MARCH_2026_TRANSACTIONS);
});

afterAll(async () => {
  await wipeUserData(userId);
  await deleteTestUser(userId);
});

describe("Phase 0 — fixture loading and aggregation contract", () => {
  test("all 18 fixture rows use a valid taxonomy category/subcategory", () => {
    assertCategoryTaxonomyValid(
      MARCH_2026_TRANSACTIONS.map((t) => ({ category: t.expected_category, subcategory: t.expected_subcategory }))
    );
  });

  test("March 2026 total income = $6,935.40", async () => {
    await assertMonthlyTotals(client, userId, MARCH_2026_EXPECTED.month, MARCH_2026_EXPECTED);
  });

  test("March 2026 total expenses = $5,821.04 (refund nets against Shopping, not Income)", async () => {
    await assertMonthlyTotals(client, userId, MARCH_2026_EXPECTED.month, MARCH_2026_EXPECTED);
  });

  test("March 2026 surplus = $1,114.36", async () => {
    await assertSurplus(client, userId, MARCH_2026_EXPECTED.month, MARCH_2026_EXPECTED.surplus);
  });
});
