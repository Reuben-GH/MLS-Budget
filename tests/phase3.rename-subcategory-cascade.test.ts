import { describe, test, beforeAll, afterAll, expect } from "vitest";
import { clientAs, deleteTestUser } from "./helpers/test-auth";
import { wipeUserData } from "./helpers/test-db";

// Phase 3: renaming a custom subcategory has to update three tables
// together (custom_subcategories.name, plus every transactions and
// category_classifications row using the old name — both store the
// name directly, not a reference). This proves the RPC does all three
// atomically, leaving nothing behind under the old name.

const USER = { email: "phase3-rename-cascade@example.com", password: "test-password-not-a-real-account-c-3!" };

let userId: string;
let client: Awaited<ReturnType<typeof clientAs>>["client"];
let subcategoryId: string;
let statementId: string;

beforeAll(async () => {
  const u = await clientAs(USER.email, USER.password);
  userId = u.userId;
  client = u.client;

  await wipeUserData(userId);

  const { data: sub, error: subError } = await client
    .from("custom_subcategories")
    .insert({ user_id: userId, top_level_category: "Recreation", name: "Streming" }) // deliberate typo, to be renamed
    .select()
    .single();
  if (subError) throw subError;
  subcategoryId = sub.id;

  const { data: statement, error: statementError } = await client
    .from("statements")
    .insert({ user_id: userId, file_path: "test/rename-cascade.csv", status: "parsed" })
    .select()
    .single();
  if (statementError) throw statementError;
  statementId = statement.id;

  const { error: txnError } = await client.from("transactions").insert({
    statement_id: statementId,
    user_id: userId,
    txn_date: "2026-03-10",
    description: "NETFLIX.COM",
    amount: -22.99,
    category: "Recreation",
    subcategory: "Streming",
  });
  if (txnError) throw txnError;

  const { error: classificationError } = await client.from("category_classifications").insert({
    user_id: userId,
    top_level_category: "Recreation",
    subcategory: "Streming",
    classification: "discretionary",
  });
  if (classificationError) throw classificationError;
});

afterAll(async () => {
  await wipeUserData(userId);
  await deleteTestUser(userId);
});

describe("Phase 3 — rename_custom_subcategory RPC cascade", () => {
  test("renames the subcategory itself", async () => {
    const { error } = await client.rpc("rename_custom_subcategory", {
      p_subcategory_id: subcategoryId,
      p_new_name: "Streaming",
    });
    expect(error).toBeNull();

    const { data } = await client.from("custom_subcategories").select("name").eq("id", subcategoryId).single();
    expect(data?.name).toBe("Streaming");
  });

  test("cascades to the transaction that used the old name", async () => {
    const { data } = await client
      .from("transactions")
      .select("subcategory")
      .eq("statement_id", statementId)
      .single();
    expect(data?.subcategory).toBe("Streaming");
  });

  test("cascades to the classification override that used the old name", async () => {
    const { data } = await client
      .from("category_classifications")
      .select("subcategory")
      .eq("user_id", userId)
      .eq("top_level_category", "Recreation")
      .single();
    expect(data?.subcategory).toBe("Streaming");
  });

  test("nothing is left referencing the old name anywhere", async () => {
    const { data: txns } = await client.from("transactions").select("id").eq("subcategory", "Streming");
    const { data: classifications } = await client
      .from("category_classifications")
      .select("id")
      .eq("subcategory", "Streming");
    expect(txns).toHaveLength(0);
    expect(classifications).toHaveLength(0);
  });

  test("renaming to a name that already exists under the same category is rejected", async () => {
    const { data: other, error: otherError } = await client
      .from("custom_subcategories")
      .insert({ user_id: userId, top_level_category: "Recreation", name: "Gaming" })
      .select()
      .single();
    if (otherError) throw otherError;

    const { error } = await client.rpc("rename_custom_subcategory", {
      p_subcategory_id: other.id,
      p_new_name: "Streaming",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("duplicate_name");
  });
});
