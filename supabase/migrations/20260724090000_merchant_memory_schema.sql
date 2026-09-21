-- One remembered category per merchant per user. Created the first
-- time a user corrects a transaction's category (see
-- lib/transactions/reassign.ts's applyMerchantMemory and
-- app/(protected)/dashboard/actions.ts's reassignTransactionCategory),
-- then checked at import time (app/(protected)/import/actions.ts)
-- before falling back to the generic keyword engine
-- (lib/categorisation/engine.ts) for any merchant with no memory yet.
--
-- Unlike custom_subcategories, this allows all 12 top-level categories
-- including Transfer — a recurring transfer (e.g. a BPAY payment the
-- keyword rules don't catch) is just as correctable as any spending
-- category, even though Transfer has no subcategory concept elsewhere.
create table merchant_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  merchant_key text not null,
  category text not null check (
    category in (
      'Income','Housing','Utilities','Transport','Food','Health',
      'Education','Personal','Recreation','Financial','Other','Transfer'
    )
  ),
  subcategory text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- One rule per merchant per user — correcting the same merchant again
-- upserts onto this index rather than creating a duplicate rule.
create unique index merchant_memory_unique_idx
  on merchant_memory (user_id, merchant_key);

create index merchant_memory_user_idx on merchant_memory (user_id);
