-- db/repair_uuid_mismatch.sql
-- Run ONCE in Hostinger / Coolify / Supabase SQL Editor
--
-- ROOT CAUSE: The Users page generated a fake UUID (crypto.randomUUID()) and stored it
-- in public.profiles and public.drivers.user_id. When the driver actually logs in,
-- Supabase creates a different real UUID in auth.users. These never match.
--
-- IMPORTANT: Run ALL statements in ONE execution so they share the same transaction view.
-- Do NOT run them one by one — Step 2 must see the OLD profiles.id (before Step 1 changes it).

-- Step 1: Capture the mapping from fake UUID -> real UUID BEFORE updating profiles
-- Then fix user_roles using the captured mapping (avoids the join-after-update bug)

do $$
declare
  r record;
begin
  -- For each auth user, find profiles with a DIFFERENT id but same email
  for r in
    select p.id as fake_id, u.id as real_id
    from public.profiles p
    join auth.users u on lower(p.email) = lower(u.email)
    where p.id != u.id
  loop
    -- Fix user_roles: move role from fake_id to real_id
    -- First check if real_id already has a role
    if not exists (select 1 from public.user_roles where user_id = r.real_id) then
      update public.user_roles
      set user_id = r.real_id
      where user_id = r.fake_id;
    else
      -- real_id already has a role (possibly wrong one like "member" set accidentally)
      -- Keep real_id role but remove the old fake_id duplicate
      delete from public.user_roles where user_id = r.fake_id;
    end if;

    -- Fix profiles: update fake_id to real_id
    -- Delete old profile if real one already exists
    if exists (select 1 from public.profiles where id = r.real_id) then
      delete from public.profiles where id = r.fake_id;
    else
      update public.profiles set id = r.real_id where id = r.fake_id;
    end if;
  end loop;
end $$;

-- Fix drivers: set user_id to match real auth UUID by email
update public.drivers d
set user_id = u.id
from auth.users u
where d.email is not null
  and lower(d.email) = lower(u.email)
  and (d.user_id is null or d.user_id != u.id);

-- Fix Malkit specifically: her user_roles was accidentally set to "member"
-- after the admin opened her edit dialog when role appeared as null.
-- Correct it back to "driver" now.
update public.user_roles
set role = 'driver'
where user_id = (select id from auth.users where lower(email) = lower('Malkit@gmail.com'))
  and role != 'driver';

-- Remove any duplicate user_roles for Malkit (the old fake-UUID "driver" entry)
delete from public.user_roles
where user_id != (select id from auth.users where lower(email) = lower('Malkit@gmail.com'))
  and user_id in (
    select p.id from public.profiles p where lower(p.email) = lower('Malkit@gmail.com')
  );

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
