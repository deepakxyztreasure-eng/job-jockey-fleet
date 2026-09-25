-- db/link_driver_account.sql
-- Run this in Hostinger / Coolify / Supabase SQL Editor to link driver accounts by email and enable auto-link RPC

-- 1. Ensure user_id column exists on drivers table
alter table public.drivers add column if not exists user_id uuid references auth.users(id) on delete set null;

-- 2. Repair update: Link existing drivers to profiles by email
update public.drivers d
set user_id = p.id
from public.profiles p
where d.user_id is null
  and d.email is not null
  and lower(d.email) = lower(p.email);

-- 3. Fallback repair: Link existing drivers directly to auth.users by email
update public.drivers d
set user_id = u.id
from auth.users u
where d.user_id is null
  and d.email is not null
  and lower(d.email) = lower(u.email);

-- 4. Create auto-link RPC function for future driver logins
create or replace function public.link_driver_account(p_user_id uuid, p_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user_id is not null and p_email is not null then
    update public.drivers
    set user_id = p_user_id
    where (user_id is null or user_id != p_user_id)
      and email is not null
      and lower(email) = lower(p_email);
  end if;
end; $$;

grant execute on function public.link_driver_account(uuid, text) to authenticated;
grant execute on function public.link_driver_account(uuid, text) to anon;
grant execute on function public.link_driver_account(uuid, text) to service_role;
