-- RLS for merchant_memory, matching 20260722090100_categories_extension_rls.sql
-- exactly: one policy per operation, scoped to auth.uid() = user_id.

alter table merchant_memory enable row level security;

create policy "merchant_memory_select_own" on merchant_memory for select using (auth.uid() = user_id);
create policy "merchant_memory_insert_own" on merchant_memory for insert with check (auth.uid() = user_id);
create policy "merchant_memory_update_own" on merchant_memory for update using (auth.uid() = user_id);
create policy "merchant_memory_delete_own" on merchant_memory for delete using (auth.uid() = user_id);
