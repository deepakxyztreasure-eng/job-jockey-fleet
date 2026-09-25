-- db/repair_uuid_mismatch.sql
-- Run ONCE in Hostinger / Coolify / Supabase SQL Editor
--
-- ROOT CAUSE: The Users page generated a fake UUID (crypto.randomUUID()) and stored it
-- in public.profiles and public.drivers.user_id. When the driver actually logs in,
-- Supabase creates a different real UUID in auth.users. These never match, so:
--   - user_roles returns no role for auth.uid()
--   - drivers.user_id != auth.uid() -> jobs RLS policy returns 0 jobs
--
-- This script repairs existing accounts by matching on email.

-- 1. Fix public.profiles: update fake UUIDs to match auth.users IDs
--    (only where email matches and id differs)
update public.profiles p
set id = u.id
from auth.users u
where lower(p.email) = lower(u.email)
  and p.id != u.id;

-- 2. Fix public.user_roles: repoint from fake UUID to real auth UUID
update public.user_roles ur
set user_id = u.id
from auth.users u
join public.profiles p on lower(p.email) = lower(u.email)
where ur.user_id = p.id
  and ur.user_id != u.id;

-- Note: Step 1 must run before Step 2 since Step 2 uses the updated profiles table.
-- If Step 1 and 2 conflict due to FK constraints, run them separately.

-- 3. Fix public.drivers: update user_id to match real auth UUID by email
update public.drivers d
set user_id = u.id
from auth.users u
where d.email is not null
  and lower(d.email) = lower(u.email)
  and (d.user_id is null or d.user_id != u.id);

-- 4. Reload PostgREST schema cache
notify pgrst, 'reload schema';
