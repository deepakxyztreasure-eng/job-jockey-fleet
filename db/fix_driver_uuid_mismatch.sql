-- db/fix_driver_uuid_mismatch.sql
-- Run the WHOLE file once in your self-hosted Supabase SQL editor (Coolify / Hostinger).
-- Safe to re-run.
--
-- ROOT CAUSE
--   Drivers only see jobs where jobs.assigned_driver_id points to a drivers row whose
--   user_id = auth.uid(). After the migration, drivers/profiles/user_roles rows can hold
--   an OLD uuid (from the previous server) or a duplicate drivers row exists for the same
--   email. The job is then assigned to a row the login does not "own" -> invisible.
--
-- FIX
--   1. Show what is mismatched (diagnostics).
--   2. Repair every id to the real auth.users id (matched by email).
--   3. Merge duplicate driver rows (same email) and move their jobs to the kept row.
--   4. Make driver access match by login id OR login email, so a stale uuid can never
--      hide jobs again.

-- ───────────── 1. DIAGNOSTICS (read the result grid) ─────────────
select 'driver_uuid_mismatch' as issue, d.id as driver_id, d.email, d.user_id as stored_uid, u.id as real_uid
from public.drivers d
join auth.users u on lower(u.email) = lower(d.email)
where d.user_id is distinct from u.id
union all
select 'profile_uuid_mismatch', p.id, p.email, p.id, u.id
from public.profiles p
join auth.users u on lower(u.email) = lower(p.email)
where p.id <> u.id;

-- ───────────── 2. REPAIR IDS ─────────────
do $$
declare r record;
begin
  -- profiles / user_roles holding an old uuid for an email that now has a real login
  for r in
    select p.id as old_id, u.id as new_id
    from public.profiles p
    join auth.users u on lower(u.email) = lower(p.email)
    where p.id <> u.id
  loop
    insert into public.user_roles (user_id, role)
      select r.new_id, role from public.user_roles where user_id = r.old_id
      on conflict (user_id, role) do nothing;
    delete from public.user_roles where user_id = r.old_id;
    update public.jobs set created_by = r.new_id where created_by = r.old_id;
    if exists (select 1 from public.profiles where id = r.new_id) then
      delete from public.profiles where id = r.old_id;
    else
      begin
        update public.profiles set id = r.new_id where id = r.old_id;
      exception when others then
        delete from public.profiles where id = r.old_id;
      end;
    end if;
  end loop;

  -- every auth user must have a profile
  insert into public.profiles (id, full_name, email)
  select u.id, coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email,'@',1)), u.email
  from auth.users u
  where not exists (select 1 from public.profiles p where p.id = u.id);
end $$;

-- ───────────── 3. MERGE DUPLICATE DRIVER ROWS ─────────────
do $$
declare r record; keep_id uuid;
begin
  for r in
    select lower(email) as em from public.drivers
    where email is not null group by lower(email) having count(*) > 1
  loop
    -- keep the row with the most jobs (oldest on tie)
    select d.id into keep_id
    from public.drivers d
    left join public.jobs j on j.assigned_driver_id = d.id
    where lower(d.email) = r.em
    group by d.id, d.created_at
    order by count(j.id) desc, d.created_at asc
    limit 1;

    update public.jobs set assigned_driver_id = keep_id
      where assigned_driver_id in (select id from public.drivers where lower(email) = r.em and id <> keep_id);
    begin update public.driver_sessions set driver_id = keep_id
      where driver_id in (select id from public.drivers where lower(email) = r.em and id <> keep_id);
    exception when others then null; end;
    begin update public.driver_locations set driver_id = keep_id
      where driver_id in (select id from public.drivers where lower(email) = r.em and id <> keep_id);
    exception when others then null; end;
    begin update public.driver_checklist_logs set driver_id = keep_id
      where driver_id in (select id from public.drivers where lower(email) = r.em and id <> keep_id);
    exception when others then null; end;

    delete from public.drivers where lower(email) = r.em and id <> keep_id;
  end loop;
end $$;

-- link every driver row to the real login id
update public.drivers d set user_id = u.id
from auth.users u
where d.email is not null and lower(d.email) = lower(u.email)
  and d.user_id is distinct from u.id;

-- stale user_id pointing to a login that no longer exists -> clear it
update public.drivers d set user_id = null
where d.user_id is not null and not exists (select 1 from auth.users u where u.id = d.user_id);

-- every linked driver login gets the driver role
insert into public.user_roles (user_id, role)
select d.user_id, 'driver'::public.app_role from public.drivers d
where d.user_id is not null
  and not exists (select 1 from public.user_roles ur where ur.user_id = d.user_id)
on conflict (user_id, role) do nothing;

-- ───────────── 4. MISMATCH-PROOF ACCESS ─────────────
create or replace function public.current_driver_ids()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select id from public.drivers
  where user_id = auth.uid()
     or (email is not null and lower(email) = lower(coalesce(auth.jwt()->>'email','')))
$$;
grant execute on function public.current_driver_ids() to authenticated;

drop policy if exists jobs_select_driver on public.jobs;
create policy jobs_select_driver on public.jobs for select to authenticated
  using (assigned_driver_id in (select public.current_driver_ids()));

drop policy if exists jobs_update_driver on public.jobs;
create policy jobs_update_driver on public.jobs for update to authenticated
  using (assigned_driver_id in (select public.current_driver_ids()))
  with check (assigned_driver_id in (select public.current_driver_ids()));

drop policy if exists drivers_select_self on public.drivers;
create policy drivers_select_self on public.drivers for select to authenticated
  using (id in (select public.current_driver_ids()));

-- driver-owned tables use the same rule
do $$ begin
  drop policy if exists driver_locations_insert_self on public.driver_locations;
  create policy driver_locations_insert_self on public.driver_locations for insert to authenticated
    with check (driver_id in (select public.current_driver_ids()));
  drop policy if exists checklist_insert_self on public.driver_checklist_logs;
  create policy checklist_insert_self on public.driver_checklist_logs for insert to authenticated
    with check (driver_id in (select public.current_driver_ids()));
exception when undefined_table then null; end $$;

notify pgrst, 'reload schema';

-- ───────────── 5. VERIFY (should return 0 rows) ─────────────
select d.email, d.user_id, u.id as real_uid
from public.drivers d
join auth.users u on lower(u.email) = lower(d.email)
where d.user_id is distinct from u.id;
