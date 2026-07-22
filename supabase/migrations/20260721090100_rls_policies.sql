-- RLS, scoped to auth.uid(), on every user-data table from day one.
-- One policy per operation (rather than a single `for all`) so future
-- audits of "can user X update but not delete" stay easy to read, and
-- so tests can assert each operation independently.

alter table statements enable row level security;
alter table transactions enable row level security;
alter table monthly_summaries enable row level security;

create policy "statements_select_own" on statements for select using (auth.uid() = user_id);
create policy "statements_insert_own" on statements for insert with check (auth.uid() = user_id);
create policy "statements_update_own" on statements for update using (auth.uid() = user_id);
create policy "statements_delete_own" on statements for delete using (auth.uid() = user_id);

create policy "transactions_select_own" on transactions for select using (auth.uid() = user_id);
create policy "transactions_insert_own" on transactions for insert with check (auth.uid() = user_id);
create policy "transactions_update_own" on transactions for update using (auth.uid() = user_id);
create policy "transactions_delete_own" on transactions for delete using (auth.uid() = user_id);

create policy "monthly_summaries_select_own" on monthly_summaries for select using (auth.uid() = user_id);
create policy "monthly_summaries_insert_own" on monthly_summaries for insert with check (auth.uid() = user_id);
create policy "monthly_summaries_update_own" on monthly_summaries for update using (auth.uid() = user_id);
create policy "monthly_summaries_delete_own" on monthly_summaries for delete using (auth.uid() = user_id);
