-- Budget module core schema: statements, transactions, monthly_summaries.
-- See docs/data-model.md for the amount sign convention.

create table statements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  file_path text not null,          -- S3 key, not a public URL
  original_filename text,
  period_start date,
  period_end date,
  status text check (status in ('uploaded','parsing','parsed','error')) default 'uploaded',
  uploaded_at timestamptz default now()
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid references statements not null,
  user_id uuid references auth.users not null,
  txn_date date not null,
  description text not null,
  amount numeric(12,2) not null,        -- positive = credit/income, negative = debit/expense
  category text not null,
  subcategory text,
  confidence numeric(3,2),              -- categorisation confidence 0-1
  manually_overridden boolean default false,
  original_category text,               -- preserved if overridden, for audit
  created_at timestamptz default now()
);

create table monthly_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  month date not null,                  -- first of month
  total_income numeric(12,2) not null,
  total_expenses numeric(12,2) not null,
  surplus numeric(12,2) not null,
  unique (user_id, month)
);

-- Every transaction lookup during parsing/aggregation filters by
-- user_id + txn_date (monthly rollups) or by statement_id (re-parse /
-- audit trail), so both get an index from day one.
create index transactions_user_month_idx on transactions (user_id, txn_date);
create index transactions_statement_id_idx on transactions (statement_id);
