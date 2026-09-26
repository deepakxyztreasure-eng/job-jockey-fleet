-- db/create_link_driver_account_fn.sql
-- Run ONCE in Hostinger / Coolify / Supabase SQL Editor
--
-- Automatic driver, profile, and user_roles linker on login + SECURITY DEFINER role setter.

-- 1. SECURITY DEFINER function to update user_roles safely without RLS violations
create or replace function public.set_user_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if p_user_id is null or p_role is null or p_role = '' then
    return;
  end if;

  delete from public.user_roles where user_id = p_user_id;
  insert into public.user_roles (user_id, role)
  values (p_user_id, p_role::public.app_role);
end;
$$;

grant execute on function public.set_user_role(uuid, text) to authenticated;

-- 2. SECURITY DEFINER function to auto-link driver, profile, and user_roles on login
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

  -- 1. Known superadmin emails are ALWAYS enforced as super_admin
  if v_email in ('deepakchandra076@gmail.com', 'garytippertruck@gmail.com') then
    perform public.set_user_role(v_uid, 'super_admin');
    return;
  end if;

  -- 2. Detect & clean up any stale/fake UUID profiles created by Users.tsx before first login
  if exists (select 1 from public.profiles where lower(email) = v_email and id != v_uid) then
    delete from public.user_roles where user_id in (select id from public.profiles where lower(email) = v_email and id != v_uid);
    delete from public.profiles where lower(email) = v_email and id != v_uid;
  end if;

  -- 3. Link all driver rows matching by email to the current real auth user_id
  update public.drivers
  set user_id = v_uid
  where lower(email) = v_email
    and (user_id is null or user_id != v_uid);

  -- 4. Ensure real profile entry exists for this auth user
  insert into public.profiles (id, full_name, email)
  values (
    v_uid,
    coalesce(auth.jwt()->>'full_name', split_part(v_email, '@', 1)),
    v_email
  )
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

  -- 5. Set user_role: if listed in drivers table, set role to 'driver'
  if exists (select 1 from public.drivers where lower(email) = v_email or user_id = v_uid) then
    perform public.set_user_role(v_uid, 'driver');
  elsif not exists (select 1 from public.user_roles where user_id = v_uid) then
    perform public.set_user_role(v_uid, 'member');
  end if;

end;
$$;

grant execute on function public.link_driver_account() to authenticated;

-- 3. Run complete database-wide UUID repair loop
do $$
declare
  r record;
begin
  -- For every auth user, find profiles that have a DIFFERENT id but same email
  for r in
    select p.id as fake_id, u.id as real_id, u.email
    from auth.users u
    join public.profiles p on lower(p.email) = lower(u.email)
    where p.id != u.id
  loop
    delete from public.user_roles where user_id = r.fake_id;
    delete from public.profiles where id = r.fake_id;
  end loop;

  -- Link all drivers table user_id to real auth user_id by email
  update public.drivers d
  set user_id = u.id
  from auth.users u
  where d.email is not null
    and lower(d.email) = lower(u.email)
    and (d.user_id is null or d.user_id != u.id);

  -- For any driver with an auth account, ensure user_roles has 'driver'
  for r in
    select distinct u.id
    from auth.users u
    join public.drivers d on lower(d.email) = lower(u.email)
    where lower(u.email) not in ('deepakchandra076@gmail.com', 'garytippertruck@gmail.com')
  loop
    perform public.set_user_role(r.id, 'driver');
  end loop;
end $$;

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
