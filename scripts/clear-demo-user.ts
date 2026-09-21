import { config } from "dotenv";
import { clientAs } from "../tests/helpers/test-auth";
import { wipeUserData } from "../tests/helpers/test-db";

// Clears all data for the demo account in budget-dev (transactions,
// statements, monthly summaries, custom subcategories, F/D overrides,
// and merchant memory) WITHOUT reloading the March 2026 fixture — use
// this before uploading real client data, so it starts from a genuine
// blank slate rather than mixing real data in alongside demo rows.
// The account itself (and its login) is untouched, just empty. To put
// the demo fixture back afterwards instead, run `npm run seed:demo`.
config({ path: ".env.local" });

const DEMO_EMAIL = "reg.grantham@gmail.com";
const DEMO_PASSWORD = "MyLifeSortedDemo2026!";

async function main() {
  const { userId } = await clientAs(DEMO_EMAIL, DEMO_PASSWORD);
  await wipeUserData(userId);
  console.log(`Cleared all data for ${DEMO_EMAIL} in budget-dev. The account still exists — it's just empty now.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
