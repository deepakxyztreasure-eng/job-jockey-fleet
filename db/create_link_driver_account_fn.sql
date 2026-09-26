-- db/create_link_driver_account_fn.sql
-- Run ONCE in Hostinger / Coolify / Supabase SQL Editor
--
-- Automatic driver, profile, and user_roles linker on login.
-- Runs as SECURITY DEFINER so it can safely read auth.jwt() and sync
-- drivers.user_id, profiles, and user_roles to the user's real auth.uid().

create or replace function public.link_driver_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
begin
  if v_uid is null or v_email = '' then
    return;
  end if;

  -- 1. Link drivers table matching by email
  update public.drivers
  set user_id = v_uid
  where lower(email) = v_email
    and (user_id is null or user_id != v_uid);

  -- 2. Ensure profile entry exists for this auth user
  insert into public.profiles (id, full_name, email)
  values (
    v_uid,
    coalesce(auth.jwt()->>'full_name', split_part(v_email, '@', 1)),
    v_email
  )
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

  -- 3. Ensure user_roles entry exists for this auth user
  if not exists (select 1 from public.user_roles where user_id = v_uid) then
    if exists (select 1 from public.drivers where user_id = v_uid) then
      insert into public.user_roles (user_id, role) values (v_uid, 'driver') on conflict do nothing;
    elsif v_email in ('deepakxyztreasure@gmail.com', 'deepakchandra076@gmail.com', 'garytippertruck@gmail.com') then
      insert into public.user_roles (user_id, role) values (v_uid, 'super_admin') on conflict do nothing;
    else
      insert into public.user_roles (user_id, role) values (v_uid, 'member') on conflict do nothing;
    end if;
  end if;

end;
$$;

grant execute on function public.link_driver_account() to authenticated;

-- Immediate repair UPDATE for any existing drivers in the database
update public.drivers d
set user_id = u.id
from auth.users u
where d.email is not null
  and lower(d.email) = lower(u.email)
  and (d.user_id is null or d.user_id != u.id);

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
