import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "../../lib/supabase/admin";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}. See .env.example.`);
  return value;
}

// Plain publishable-key client, separate from lib/supabase/client.ts
// (which is browser/cookie-oriented for the Next.js app) — this is a
// standalone client for test scripts running under Node/Vitest.
function createPublishableClient(): SupabaseClient {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
  );
}

// Creates (or reuses, if already present) a confirmed test user via
// the secret-key (admin) client, then returns a signed-in
// publishable-key client for that user plus their user id. This
// client is what RLS tests exercise — NOT the secret-key client,
// which bypasses RLS entirely and would make an isolation test
// meaningless.
export async function clientAs(email: string, password: string): Promise<{ client: SupabaseClient; userId: string }> {
  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  let userId: string;
  if (createError) {
    // Likely already exists from a previous test run — look it up instead.
    const { data: list, error: listError } = await admin.auth.admin.listUsers();
    if (listError) throw listError;
    const existing = list.users.find((u) => u.email === email);
    if (!existing) throw createError;
    userId = existing.id;
  } else {
    userId = created.user.id;
  }

  const client = createPublishableClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  return { client, userId };
}

export async function deleteTestUser(userId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(userId);
}
