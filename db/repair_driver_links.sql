-- db/repair_driver_links.sql
-- 1-time execution in Hostinger / Coolify / Supabase SQL Editor
-- Links existing driver records (such as Malkit@gmail.com) to auth.users / profiles by email match.

-- 1. Ensure user_id column exists on public.drivers
alter table public.drivers add column if not exists user_id uuid references auth.users(id) on delete set null;

-- 2. Link existing drivers to public.profiles by matching email
update public.drivers d
set user_id = p.id
from public.profiles p
where d.user_id is null
  and d.email is not null
  and lower(d.email) = lower(p.email);

-- 3. Fallback: Link existing drivers to auth.users by matching email
update public.drivers d
set user_id = u.id
from auth.users u
where d.user_id is null
  and d.email is not null
  and lower(d.email) = lower(u.email);

-- 4. Reload PostgREST schema cache
notify pgrst, 'reload schema';
