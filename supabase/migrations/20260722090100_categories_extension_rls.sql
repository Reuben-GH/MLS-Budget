-- RLS for the two Categories-extension tables, matching
-- 20260721090100_rls_policies.sql exactly: one policy per operation,
-- scoped to auth.uid() = user_id.

alter table custom_subcategories enable row level security;
alter table category_classifications enable row level security;

create policy "custom_subcategories_select_own" on custom_subcategories for select using (auth.uid() = user_id);
create policy "custom_subcategories_insert_own" on custom_subcategories for insert with check (auth.uid() = user_id);
create policy "custom_subcategories_update_own" on custom_subcategories for update using (auth.uid() = user_id);
create policy "custom_subcategories_delete_own" on custom_subcategories for delete using (auth.uid() = user_id);

create policy "category_classifications_select_own" on category_classifications for select using (auth.uid() = user_id);
create policy "category_classifications_insert_own" on category_classifications for insert with check (auth.uid() = user_id);
create policy "category_classifications_update_own" on category_classifications for update using (auth.uid() = user_id);
create policy "category_classifications_delete_own" on category_classifications for delete using (auth.uid() = user_id);
