import { describe, test, beforeAll, afterAll, expect } from "vitest";
import { clientAs, deleteTestUser } from "./helpers/test-auth";
import { wipeUserData } from "./helpers/test-db";

// Phase 2: same RLS isolation pattern as phase1.rls-isolation.test.ts,
// extended to the two Categories-extension tables. The assertion is
// `data.length === 0`, not "no error was thrown" — Postgres RLS
// filters rows silently, so an error-only check would false-pass a
// broken policy.

const USER_A = { email: "phase2-rls-user-a@example.com", password: "test-password-not-a-real-account-a-2!" };
const USER_B = { email: "phase2-rls-user-b@example.com", password: "test-password-not-a-real-account-b-2!" };

let userAId: string, userBId: string;
let clientA: Awaited<ReturnType<typeof clientAs>>["client"];
let clientB: Awaited<ReturnType<typeof clientAs>>["client"];
let userACustomSubId: string;

beforeAll(async () => {
  const a = await clientAs(USER_A.email, USER_A.password);
  const b = await clientAs(USER_B.email, USER_B.password);
  userAId = a.userId;
  userBId = b.userId;
  clientA = a.client;
  clientB = b.client;

  await wipeUserData(userAId);
  await wipeUserData(userBId);

  // User A creates their own data via their own signed-in client —
  // this also exercises the insert policy, not just select.
  const { data: customSub, error: customSubError } = await clientA
    .from("custom_subcategories")
    .insert({ user_id: userAId, top_level_category: "Recreation", name: "RLS Test Streaming" })
    .select()
    .single();
  if (customSubError) throw customSubError;
  userACustomSubId = customSub.id;

  const { error: classificationError } = await clientA.from("category_classifications").insert({
    user_id: userAId,
    top_level_category: "Recreation",
    subcategory: "",
    classification: "discretionary",
  });
  if (classificationError) throw classificationError;
});

afterAll(async () => {
  await wipeUserData(userAId);
  await wipeUserData(userBId);
  await deleteTestUser(userAId);
  await deleteTestUser(userBId);
});

describe("Phase 2 — RLS isolation on the Categories-extension tables", () => {
  test("user B's unfiltered select on custom_subcategories returns zero rows of user A's data", async () => {
    const { data, error } = await clientB.from("custom_subcategories").select("*");
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  test("user B's unfiltered select on category_classifications returns zero rows of user A's data", async () => {
    const { data, error } = await clientB.from("category_classifications").select("*");
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  test("user B looking up user A's custom_subcategories row by known id directly also returns zero rows", async () => {
    // Guards against a policy that filters list queries but forgets a
    // select-by-primary-key path.
    const { data, error } = await clientB.from("custom_subcategories").select("*").eq("id", userACustomSubId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  test("user A can still read their own data (sanity check the policy isn't blocking everyone)", async () => {
    const { data, error } = await clientA.from("custom_subcategories").select("*").eq("id", userACustomSubId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});
