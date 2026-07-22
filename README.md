# My Life Sorted — Budget

Budget/cashflow module. Currently: Phase 0 (fixtures) + Phase 1
(schema/RLS scaffold) only — see `docs/data-model.md` for the sign
convention decision that needs confirming before Phase 2.

## Setup (for Reg — no coding required, just account creation)

### 1. Supabase (needed now)

1. Create a free Supabase account/org at supabase.com if you don't have one.
2. Create **two** projects: `budget-dev` and `budget-test` (Australian region).
3. For **each** project, go to Settings → API and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (older projects show this under a "Legacy" tab as the `anon` `public` key instead — same thing, either works)
   - **Secret key** → `SUPABASE_SECRET_KEY` (older projects: `service_role` key). Keep this one secret — never share it or paste it anywhere public.
4. Go to your account's Settings → Access Tokens (not project-level) and create one → `SUPABASE_ACCESS_TOKEN`. This one token works for both projects.
5. Copy `.env.example` to `.env.local` (using `budget-dev` project values) and to `.env.test` (using `budget-test` project values), and fill in the blanks.

### 2. Apply the database schema

Once `.env.test` is filled in, from this directory:

```
npx supabase link --project-ref <budget-test-project-ref>
npx supabase db push
```

(The project ref is in the Supabase dashboard URL for the `budget-test` project.) Repeat against `budget-dev` when you're ready to run the app itself, not just tests.

### 3. Run the tests

```
npm install
npm run test
```

This runs the Phase 0 fixture/aggregation tests and Phase 1 RLS isolation tests against `budget-test`.

### 4. GitHub (whenever you're ready to back this up remotely)

Create an empty repository on GitHub, then:

```
git remote add origin <your-repo-url>
git push -u origin main
```

### Not needed yet

- **Vercel** — connect once there's something worth deploying (after Phase 2+).
- **AWS S3 / Stripe** — needed for statement file storage and billing respectively, both later phases. Nothing to do here yet.
