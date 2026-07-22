import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Secret-key (admin) client. Bypasses RLS entirely — never import this
// into UI code or any code path reachable from a browser request. Used
// only by the test harness (creating/removing test users) and future
// server-only seed/admin scripts. (Not guarded with the `server-only`
// package: that package targets the Next.js Server Component boundary
// specifically and throws when imported from plain Vitest/Node test
// runs, which this module's own test-harness callers do.)
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
