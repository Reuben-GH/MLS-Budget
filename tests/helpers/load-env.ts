import { config } from "dotenv";
import { existsSync } from "node:fs";

// Vitest setup file: loads .env.test so tests run against the hosted
// budget-test Supabase project without needing it exported manually.
if (existsSync(".env.test")) {
  config({ path: ".env.test" });
}
