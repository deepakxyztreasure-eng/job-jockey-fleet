-- db/driver_self_link.sql
-- Run ONCE in Hostinger / Coolify / Supabase SQL Editor
--
-- WHY: The jobs RLS policy allows drivers to see jobs only if their
--      public.drivers row has user_id = auth.uid().
--      But drivers cannot UPDATE their own row (only super_admin can write to drivers).
--      This creates a security-definer function that bridges the gap:
--      it runs with elevated DB privileges but only touches the caller's own row by email.

-- 1. Create the self-link function
create or replace function public.driver_self_link()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid   uuid  := auth.uid();
  _email text;
begin
  -- Get the calling user's email from auth.users
  select email into _email from auth.users where id = _uid;
  if _email is null then return; end if;

  -- Update only the driver row that matches this email and is not yet linked
  update public.drivers
  set user_id = _uid
  where user_id is null
    and email is not null
    and lower(email) = lower(_email);
end;
$$;

-- Grant drivers (authenticated users) permission to call this function
grant execute on function public.driver_self_link() to authenticated;

-- 2. One-time repair: link ALL existing unlinked drivers right now
--    This immediately fixes Malkit@gmail.com and any other unlinked drivers
update public.drivers d
set user_id = u.id
from auth.users u
where d.user_id is null
  and d.email is not null
  and lower(d.email) = lower(u.email);
