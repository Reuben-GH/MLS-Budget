import { config } from "dotenv";
import { createAdminClient } from "../lib/supabase/admin";

// Resets (or creates, if missing) the demo login's password. Unlike
// seed-demo-user.ts's clientAs() helper — which only creates a user if
// one doesn't already exist, and otherwise just signs in with whatever
// password you pass it — this always forces the password to a known
// value, which is what you want when the demo account exists but the
// password has drifted from what's documented.
config({ path: ".env.local" });

const DEMO_EMAIL = "reg.grantham@gmail.com";
const DEMO_PASSWORD = "MyLifeSortedDemo2026!";

async function main() {
  const admin = createAdminClient();
  const { data: list, error: listError } = await admin.auth.admin.listUsers();
  if (listError) throw listError;

  const existing = list.users.find((u) => u.email === DEMO_EMAIL);

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    console.log("Existing demo user found — password reset.");
  } else {
    const { error } = await admin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    console.log("No existing demo user — created fresh.");
  }

  console.log(`Log in at /login with:`);
  console.log(`  email:    ${DEMO_EMAIL}`);
  console.log(`  password: ${DEMO_PASSWORD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
