-- Extends the Phase 1 schema with two user-owned tables that let a
-- client organise their own categorisation without touching the
-- fixed 11 top-level categories (lib/categories/taxonomy.ts). Income
-- is deliberately excluded from both — see lib/categories/taxonomy.ts
-- and lib/categories/classification.ts.

-- A user's own subcategories nested under a built-in top-level
-- category. Top-level categories stay immutable; this only ever adds
-- subcategories underneath one, never a new top-level category.
create table custom_subcategories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  top_level_category text not null check (
    top_level_category in (
      'Income','Housing','Utilities','Transport','Food','Health',
      'Education','Personal','Recreation','Financial','Other'
    )
  ),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz default now()
);

-- Case-insensitive: a user can't add "Streaming" twice under two
-- different capitalisations.
create unique index custom_subcategories_unique_idx
  on custom_subcategories (user_id, top_level_category, lower(name));

create index custom_subcategories_user_idx on custom_subcategories (user_id);

-- Fixed/Discretionary classification overrides. Sparse by design: a
-- row only exists where a user has explicitly changed something away
-- from lib/categories/classification.ts's hardcoded
-- DEFAULT_FD_CLASSIFICATION. This is deliberately NOT a fully-seeded
-- table (one row per user per category/subcategory) — if the
-- hardcoded defaults ever change, sparse storage applies the new
-- default instantly to everyone who never touched that row, while a
-- fully-seeded table can't distinguish "user chose Fixed" from "we
-- seeded Fixed and they never looked," making future default changes
-- unsafe.
--
-- `subcategory` uses '' (empty string), not NULL, as the sentinel for
-- "this override applies to the bare category" (Education/Recreation/
-- Other have no subcategories). NULL was deliberately avoided:
-- Postgres unique indexes treat every NULL as distinct, so enforcing
-- one-row-per-bare-category would need a pair of partial unique
-- indexes — and supabase-js's `.upsert()` can't express the WHERE
-- predicate Postgres requires to pick a partial index as the
-- ON CONFLICT arbiter. A single ordinary unique index with '' as
-- sentinel keeps "set classification" a single atomic upsert. The
-- ''/null translation happens at exactly one seam
-- (lib/categories/classification.ts), never elsewhere.
create table category_classifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  top_level_category text not null check (
    top_level_category in (
      'Income','Housing','Utilities','Transport','Food','Health',
      'Education','Personal','Recreation','Financial','Other'
    )
  ),
  subcategory text not null default '',
  classification text not null check (classification in ('fixed','discretionary')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index category_classifications_unique_idx
  on category_classifications (user_id, top_level_category, subcategory);

create index category_classifications_user_idx on category_classifications (user_id);
