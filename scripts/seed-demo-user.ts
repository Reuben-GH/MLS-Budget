import { config } from "dotenv";
import { clientAs } from "../tests/helpers/test-auth";
import { wipeUserData, loadFixture } from "../tests/helpers/test-db";
import { MARCH_2026_TRANSACTIONS } from "../tests/fixtures/march-2026-transactions";
import { MARCH_2026_EXPECTED } from "../tests/fixtures/march-2026-expected";

// Seeds a real, reviewable demo account in budget-dev (NOT budget-test,
// which is reserved for the automated Vitest suite) — reuses the
// existing test helpers unmodified, just pointed at a different env file.
config({ path: ".env.local" });

const DEMO_EMAIL = "reg.grantham@gmail.com";
const DEMO_PASSWORD = "MyLifeSortedDemo2026!";

async function main() {
  const { userId } = await clientAs(DEMO_EMAIL, DEMO_PASSWORD);
  await wipeUserData(userId);
  await loadFixture(userId, MARCH_2026_EXPECTED.month, "2026-03-31", MARCH_2026_TRANSACTIONS);
  console.log(`Seeded demo user with the March 2026 fixture. Log in at /login with:`);
  console.log(`  email:    ${DEMO_EMAIL}`);
  console.log(`  password: ${DEMO_PASSWORD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
