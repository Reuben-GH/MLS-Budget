import { describe, test, beforeAll, afterAll, expect } from "vitest";
import { clientAs, deleteTestUser } from "./helpers/test-auth";
import { wipeUserData } from "./helpers/test-db";

// Phase 1: confirm RLS actually blocks cross-user reads. The
// assertion is `data.length === 0`, not "no error was thrown" —
// Postgres RLS filters rows silently, so a test that only checks for
// a thrown error would false-pass a broken policy that happens to
// still return an empty result for some unrelated reason (or, worse,
// one relying on application-level filtering as the only safeguard).
// Both clients here are real, signed-in, anon-key clients — never the
// service-role client, which bypasses RLS entirely.

const USER_A = { email: "phase1-rls-user-a@example.com", password: "test-password-not-a-real-account-a-1!" };
const USER_B = { email: "phase1-rls-user-b@example.com", password: "test-password-not-a-real-account-b-1!" };

let userAId: string, userBId: string;
let clientA: Awaited<ReturnType<typeof clientAs>>["client"];
let clientB: Awaited<ReturnType<typeof clientAs>>["client"];
let userAStatementId: string;

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
  const { data: statement, error: statementError } = await clientA
    .from("statements")
    .insert({ user_id: userAId, file_path: `test-fixtures/${userAId}/rls-test.csv`, status: "uploaded" })
    .select()
    .single();
  if (statementError) throw statementError;
  userAStatementId = statement.id;

  const { error: txnError } = await clientA.from("transactions").insert({
    statement_id: userAStatementId,
    user_id: userAId,
    txn_date: "2026-03-01",
    description: "RLS TEST TRANSACTION",
    amount: -100,
    category: "Other",
  });
  if (txnError) throw txnError;

  const { error: summaryError } = await clientA.from("monthly_summaries").insert({
    user_id: userAId,
    month: "2026-03-01",
    total_income: 0,
    total_expenses: 100,
    surplus: -100,
  });
  if (summaryError) throw summaryError;
});

afterAll(async () => {
  await wipeUserData(userAId);
  await wipeUserData(userBId);
  await deleteTestUser(userAId);
  await deleteTestUser(userBId);
});

describe("Phase 1 — RLS cross-user isolation", () => {
  test("user B's unfiltered select on transactions returns zero rows of user A's data", async () => {
    const { data, error } = await clientB.from("transactions").select("*");
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  test("user B's unfiltered select on statements returns zero rows of user A's data", async () => {
    const { data, error } = await clientB.from("statements").select("*");
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  test("user B's unfiltered select on monthly_summaries returns zero rows of user A's data", async () => {
    const { data, error } = await clientB.from("monthly_summaries").select("*");
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  test("user B looking up user A's statement by known id directly also returns zero rows", async () => {
    // Guards against a policy that filters list queries but forgets a
    // select-by-primary-key path.
    const { data, error } = await clientB.from("statements").select("*").eq("id", userAStatementId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  test("user A can still read their own data (sanity check the policy isn't blocking everyone)", async () => {
    const { data, error } = await clientA.from("statements").select("*").eq("id", userAStatementId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});
