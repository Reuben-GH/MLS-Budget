import { describe, test, beforeAll, afterAll, expect } from "vitest";
import { clientAs, deleteTestUser } from "./helpers/test-auth";
import { wipeUserData } from "./helpers/test-db";

// Same RLS isolation pattern as phase2.category-extensions-rls.test.ts,
// extended to merchant_memory. The assertion is `data.length === 0`,
// not "no error was thrown" — Postgres RLS filters rows silently, so
// an error-only check would false-pass a broken policy.

const USER_A = { email: "phase3-mm-rls-user-a@example.com", password: "test-password-not-a-real-account-a-3!" };
const USER_B = { email: "phase3-mm-rls-user-b@example.com", password: "test-password-not-a-real-account-b-3!" };

let userAId: string, userBId: string;
let clientA: Awaited<ReturnType<typeof clientAs>>["client"];
let clientB: Awaited<ReturnType<typeof clientAs>>["client"];
let userAMerchantId: string;

beforeAll(async () => {
  const a = await clientAs(USER_A.email, USER_A.password);
  const b = await clientAs(USER_B.email, USER_B.password);
  userAId = a.userId;
  userBId = b.userId;
  clientA = a.client;
  clientB = b.client;

  await wipeUserData(userAId);
  await wipeUserData(userBId);

  const { data: memoryRow, error: memoryError } = await clientA
    .from("merchant_memory")
    .insert({ user_id: userAId, merchant_key: "RLS TEST MERCHANT", category: "Food", subcategory: "Dining" })
    .select()
    .single();
  if (memoryError) throw memoryError;
  userAMerchantId = memoryRow.id;
});

afterAll(async () => {
  await wipeUserData(userAId);
  await wipeUserData(userBId);
  await deleteTestUser(userAId);
  await deleteTestUser(userBId);
});

describe("Phase 3 — RLS isolation on merchant_memory", () => {
  test("user B's unfiltered select on merchant_memory returns zero rows of user A's data", async () => {
    const { data, error } = await clientB.from("merchant_memory").select("*");
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  test("user B looking up user A's merchant_memory row by known id directly also returns zero rows", async () => {
    const { data, error } = await clientB.from("merchant_memory").select("*").eq("id", userAMerchantId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  test("user B can't delete user A's merchant_memory row", async () => {
    const { error } = await clientB.from("merchant_memory").delete().eq("id", userAMerchantId);
    expect(error).toBeNull(); // RLS silently matches zero rows, not an error
    const { data } = await clientA.from("merchant_memory").select("*").eq("id", userAMerchantId);
    expect(data).toHaveLength(1); // still there
  });

  test("user A can still read their own data (sanity check the policy isn't blocking everyone)", async () => {
    const { data, error } = await clientA.from("merchant_memory").select("*").eq("id", userAMerchantId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});
