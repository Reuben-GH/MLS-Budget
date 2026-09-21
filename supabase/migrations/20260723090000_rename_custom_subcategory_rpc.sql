-- Renaming a custom subcategory has to update three tables together:
-- custom_subcategories.name, plus every transactions.subcategory and
-- category_classifications.subcategory row currently using the old name
-- (both store the name directly, not a foreign key reference to
-- custom_subcategories). A partial failure partway through would leave
-- transactions silently pointing at a name that no longer exists
-- anywhere — invisible to the user and not self-correcting the way a
-- single mis-reassigned transaction is. This function does all three
-- updates as one atomic statement so that can't happen.
--
-- Deliberately NOT security definer: the calling user already has
-- UPDATE rights on their own rows in all three tables via the existing
-- <table>_update_own RLS policies, so running as invoker (the default)
-- keeps least-privilege and needs no search_path hardening.
create or replace function rename_custom_subcategory(p_subcategory_id uuid, p_new_name text)
returns void
language plpgsql
as $$
declare
  v_user_id uuid := auth.uid();
  v_category text;
  v_old_name text;
begin
  select top_level_category, name into v_category, v_old_name
    from custom_subcategories
    where id = p_subcategory_id and user_id = v_user_id
    for update;

  if v_old_name is null then
    raise exception 'not_found';
  end if;

  if v_old_name = p_new_name then
    return; -- no-op rename, nothing to cascade
  end if;

  if exists (
    select 1 from custom_subcategories
    where user_id = v_user_id
      and top_level_category = v_category
      and lower(name) = lower(p_new_name)
      and id <> p_subcategory_id
  ) then
    raise exception 'duplicate_name';
  end if;

  update custom_subcategories set name = p_new_name
    where id = p_subcategory_id and user_id = v_user_id;

  update transactions set subcategory = p_new_name
    where user_id = v_user_id and category = v_category and subcategory = v_old_name;

  update category_classifications set subcategory = p_new_name, updated_at = now()
    where user_id = v_user_id and top_level_category = v_category and subcategory = v_old_name;
end;
$$;
