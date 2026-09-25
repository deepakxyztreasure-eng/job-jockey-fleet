-- db/create_link_driver_account_fn.sql
-- Run ONCE in Hostinger / Coolify / Supabase SQL Editor
--
-- WHY: AuthContext.tsx calls rpc("link_driver_account") on every driver login.
--      This function does not exist in the database yet, so it silently fails.
--      Creating it here fixes driver job visibility permanently.
--
-- HOW: The function runs as security definer (DB superuser internally),
--      so it can update public.drivers even though driver-role users cannot.
--      It only touches the row matching the caller's own email — safe by design.

-- 1. Create the function that AuthContext.tsx already calls on driver login
create or replace function public.link_driver_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid   uuid := auth.uid();
  _email text;
begin
  select email into _email from auth.users where id = _uid;
  if _email is null then return; end if;

  -- Link the driver row that matches this email if not yet linked
  update public.drivers
  set user_id = _uid
  where user_id is null
    and email is not null
    and lower(email) = lower(_email);
end;
$$;

grant execute on function public.link_driver_account() to authenticated;

-- 2. One-time repair: immediately link ALL existing unlinked drivers
--    This fixes Malkit@gmail.com and any others right now, without needing a logout/login
update public.drivers d
set user_id = u.id
from auth.users u
where d.user_id is null
  and d.email is not null
  and lower(d.email) = lower(u.email);
