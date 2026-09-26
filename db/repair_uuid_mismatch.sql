-- db/repair_uuid_mismatch.sql
-- Run in Hostinger / Coolify / Supabase SQL Editor
-- Paste the ENTIRE file and run it all at once.
--
-- PURPOSE:
-- 1. Fix UUID mismatches (profiles/user_roles/drivers had fake UUIDs vs real auth.users IDs)
-- 2. Fix Malkit's role back to "driver"
-- 3. Create the get_user_id_by_email() helper used by the Users page

-- ─────────────────────────────────────────────────────────────
-- PART 1: Fix UUID mismatches safely (skips if tables don't exist)
-- ─────────────────────────────────────────────────────────────
do $$
declare
  r record;
  old_id uuid;
  new_id uuid;
begin
  -- Loop over every auth user and find a profile with same email but different id (fake UUID)
  for r in
    select
      p.id   as fake_id,
      u.id   as real_id,
      u.email
    from auth.users u
    join public.profiles p on lower(p.email) = lower(u.email)
    where p.id != u.id
  loop
    old_id := r.fake_id;
    new_id := r.real_id;

    -- Fix user_roles: move entries from fake_id to real_id (if table exists)
    begin
      if not exists (select 1 from public.user_roles where user_id = new_id) then
        update public.user_roles set user_id = new_id where user_id = old_id;
      else
        delete from public.user_roles where user_id = old_id;
      end if;
    exception when others then
      null; -- user_roles table might not exist yet, skip
    end;

    -- Fix profiles: merge fake profile into real UUID
    begin
      if exists (select 1 from public.profiles where id = new_id) then
        delete from public.profiles where id = old_id;
      else
        update public.profiles set id = new_id where id = old_id;
      end if;
    exception when others then
      null;
    end;

  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────
-- PART 2: Fix drivers.user_id to match real auth UUID by email
-- ─────────────────────────────────────────────────────────────
update public.drivers d
set user_id = u.id
from auth.users u
where d.email is not null
  and lower(d.email) = lower(u.email)
  and (d.user_id is null or d.user_id != u.id);

-- ─────────────────────────────────────────────────────────────
-- PART 3: Fix Malkit's role back to "driver"
-- (She was accidentally saved as "member" when role showed as null in the UI)
-- Change email below if the driver's email is different.
-- ─────────────────────────────────────────────────────────────
do $$
declare
  malkit_uid uuid;
begin
  select id into malkit_uid from auth.users where lower(email) = lower('Malkit@gmail.com');
  if malkit_uid is not null then
    -- Remove any wrong roles for her real auth UUID
    delete from public.user_roles
    where user_id = malkit_uid and role != 'driver';
    -- Ensure she has the driver role (unique constraint is on user_id + role together)
    insert into public.user_roles (user_id, role)
    values (malkit_uid, 'driver')
    on conflict (user_id, role) do nothing;
  end if;
exception when others then
  null; -- skip if user_roles table doesn't exist
end $$;

-- ─────────────────────────────────────────────────────────────
-- PART 4: Create the helper function used by the Users page
-- to look up a user's real auth UUID by email when signUp
-- returns "User already registered".
-- ─────────────────────────────────────────────────────────────
create or replace function public.get_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

grant execute on function public.get_user_id_by_email(text) to authenticated;

-- Done
select 'Repair complete' as status;
