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

  -- Link drivers table matching by email
  update public.drivers
  set user_id = v_uid
  where lower(email) = v_email
    and (user_id is null or user_id != v_uid);

  -- Ensure profile entry exists for this auth user
  insert into public.profiles (id, full_name, email)
  values (
    v_uid,
    coalesce(auth.jwt()->>'full_name', split_part(v_email, '@', 1)),
    v_email
  )
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

  -- Ensure user_roles entry exists for this auth user
  if not exists (select 1 from public.user_roles where user_id = v_uid) then
    if exists (select 1 from public.drivers where user_id = v_uid) then
      perform public.set_user_role(v_uid, 'driver');
    elsif v_email in ('deepakxyztreasure@gmail.com', 'deepakchandra076@gmail.com', 'garytippertruck@gmail.com') then
      perform public.set_user_role(v_uid, 'super_admin');
    else
      perform public.set_user_role(v_uid, 'member');
    end if;
  end if;

end;
$$;

grant execute on function public.link_driver_account() to authenticated;

-- Immediate repair UPDATE for existing drivers
update public.drivers d
set user_id = u.id
from auth.users u
where d.email is not null
  and lower(d.email) = lower(u.email)
  and (d.user_id is null or d.user_id != u.id);

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
