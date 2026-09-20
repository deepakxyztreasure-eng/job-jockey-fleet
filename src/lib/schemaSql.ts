// Full schema for setting up a brand-new Supabase project.
// Run this in the SQL editor of the NEW project BEFORE restoring data.
export const SCHEMA_SQL = String.raw`
-- ============ ENUMS ============
do $$ begin
  create type public.app_role as enum ('super_admin','member','driver','dispatch_admin');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.job_priority as enum ('standard','priority');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.job_status as enum ('pending','assigned','accepted','in_progress','completed','payment_pending','closed','completion_requested','rejected','issue');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.payment_status as enum ('pending','partial','paid');
exception when duplicate_object then null; end $$;

-- ============ HELPERS ============
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- ============ TABLES ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, email text, phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.get_user_role(_user_id uuid)
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.user_roles where user_id = _user_id
  order by case role when 'super_admin' then 1 when 'member' then 2 when 'driver' then 3 else 4 end limit 1;
$$;

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null, phone text, email text,
  license_number text, vehicle text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.drivers to authenticated;
grant all on public.drivers to service_role;
alter table public.drivers enable row level security;

create table if not exists public.store_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null, address text not null, city text, notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.store_locations to authenticated;
grant all on public.store_locations to service_role;
alter table public.store_locations enable row level security;

create table if not exists public.job_titles (
  id uuid primary key default gen_random_uuid(),
  name text not null, active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.job_titles to authenticated;
grant all on public.job_titles to service_role;
alter table public.job_titles enable row level security;

create sequence if not exists public.jobs_job_number_seq;
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null, description text,
  pickup_location_id uuid references public.store_locations(id),
  delivery_location_id uuid references public.store_locations(id),
  pickup_address text, delivery_address text,
  scheduled_date date,
  priority public.job_priority not null default 'standard',
  invoice_number text not null,
  price numeric, show_price boolean not null default false,
  status public.job_status not null default 'pending',
  created_by uuid references auth.users(id) on delete set null,
  assigned_driver_id uuid references public.drivers(id),
  start_time timestamptz, end_time timestamptz,
  actual_start_time timestamptz, actual_end_time timestamptz,
  payment_status public.payment_status not null default 'pending',
  completion_notes text, proof_image_url text,
  completion_requested_at timestamptz, verified_at timestamptz, verified_by uuid,
  rejection_reason text,
  customer_name text, customer_mobile text,
  quantity integer, quantity_unit text,
  cod boolean not null default false, instructions text,
  pending_edit jsonb, pending_edit_by uuid, pending_edit_at timestamptz,
  number_of_loads integer,
  job_number bigint default nextval('public.jobs_job_number_seq'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.jobs to authenticated;
grant all on public.jobs to service_role;
alter table public.jobs enable row level security;

create table if not exists public.driver_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, driver_id uuid,
  login_time timestamptz not null default now(), logout_time timestamptz,
  total_minutes integer, status text not null default 'online',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.driver_sessions to authenticated;
grant all on public.driver_sessions to service_role;
alter table public.driver_sessions enable row level security;

create table if not exists public.driver_checklist_logs (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  date date not null default ((now() at time zone 'utc')::date),
  checklist_completed boolean not null default true,
  submitted_at timestamptz not null default now()
);
grant select, insert on public.driver_checklist_logs to authenticated;
grant all on public.driver_checklist_logs to service_role;
alter table public.driver_checklist_logs enable row level security;

create table if not exists public.driver_locations (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  latitude double precision not null, longitude double precision not null,
  recorded_at timestamptz not null default now()
);
grant select, insert on public.driver_locations to authenticated;
grant all on public.driver_locations to service_role;
alter table public.driver_locations enable row level security;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, body text, type text,
  job_id uuid references public.jobs(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;

create table if not exists public.lead_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null, phone text, email text not null,
  business_type text, message text,
  created_at timestamptz not null default now()
);
grant insert on public.lead_submissions to anon, authenticated;
grant select on public.lead_submissions to authenticated;
grant all on public.lead_submissions to service_role;
alter table public.lead_submissions enable row level security;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null, auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;
alter table public.push_subscriptions enable row level security;

-- ============ TRIGGERS ============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email);
  insert into public.user_roles (user_id, role) values (new.id, 'member');
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.prevent_job_overlap()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.assigned_driver_id is not null and new.start_time is not null and new.end_time is not null then
    if new.end_time <= new.start_time then raise exception 'End time must be after start time'; end if;
    if exists (
      select 1 from public.jobs j
      where j.assigned_driver_id = new.assigned_driver_id and j.id <> new.id
        and j.status not in ('completed','closed')
        and j.start_time is not null and j.end_time is not null
        and tstzrange(j.start_time, j.end_time, '[)') && tstzrange(new.start_time, new.end_time, '[)')
    ) then raise exception 'Driver already assigned to an overlapping job in this time window'; end if;
  end if;
  return new;
end; $$;
drop trigger if exists trg_prevent_job_overlap on public.jobs;
create trigger trg_prevent_job_overlap before insert or update on public.jobs
for each row execute function public.prevent_job_overlap();

create or replace function public.notify_admins(p_title text, p_body text, p_type text, p_job_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into public.notifications (user_id, title, body, type, job_id)
  select ur.user_id, p_title, p_body, p_type, p_job_id
  from public.user_roles ur where ur.role in ('super_admin','dispatch_admin');
end; $$;

create or replace function public.list_drivers_directory()
returns table (id uuid, full_name text, active boolean, user_id uuid)
language sql stable security definer set search_path = public as $$
  select id, full_name, active, user_id from public.drivers order by full_name;
$$;

do $$ declare t text; begin
  foreach t in array array['drivers','job_titles','jobs','profiles','store_locations','driver_sessions'] loop
    execute format('drop trigger if exists tg_%s_updated on public.%I', t, t);
    execute format('create trigger tg_%s_updated before update on public.%I for each row execute function public.tg_set_updated_at()', t, t);
  end loop;
end $$;

create or replace function public.auto_confirm_user_email()
returns trigger language plpgsql security definer as $$
begin
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end; $$;

do $$ begin
  update auth.users set email_confirmed_at = now() where email_confirmed_at is null;
exception when others then null; end $$;


-- ============ RLS POLICIES ============
create policy "profiles_select_own_or_admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'super_admin'));
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_admin_update" on public.profiles for update to authenticated
  using (public.has_role(auth.uid(),'super_admin'));
create policy "profiles_admin_all" on public.profiles for all to authenticated
  using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));

create policy "user_roles_select_self_or_admin" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'super_admin'));
create policy "user_roles_admin_all" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));

create policy "drivers_select_self" on public.drivers for select to authenticated using (user_id = auth.uid());
create policy "drivers_select_admin" on public.drivers for select to authenticated
  using (public.has_role(auth.uid(),'super_admin') or public.has_role(auth.uid(),'dispatch_admin'));
create policy "drivers_admin_write" on public.drivers for all to authenticated
  using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));

create policy "store_locations_select_all" on public.store_locations for select to authenticated using (true);
create policy "store_locations_admin_write" on public.store_locations for all to authenticated
  using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));

create policy "job_titles_select_all" on public.job_titles for select to authenticated using (true);
create policy "job_titles_admin_write" on public.job_titles for all to authenticated
  using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));

create policy "jobs_select_admin" on public.jobs for select to authenticated using (public.has_role(auth.uid(),'super_admin'));
create policy "jobs_select_member_all" on public.jobs for select to authenticated using (public.has_role(auth.uid(),'member'));
create policy "jobs_select_dispatch" on public.jobs for select to authenticated using (public.has_role(auth.uid(),'dispatch_admin'));
create policy "jobs_select_creator" on public.jobs for select to authenticated using (created_by = auth.uid());
create policy "jobs_select_driver" on public.jobs for select to authenticated
  using (assigned_driver_id in (select id from public.drivers where user_id = auth.uid()));
create policy "jobs_insert_member_or_admin" on public.jobs for insert to authenticated
  with check (created_by = auth.uid() and (public.has_role(auth.uid(),'super_admin') or public.has_role(auth.uid(),'member')));
create policy "jobs_update_admin" on public.jobs for update to authenticated
  using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));
create policy "jobs_update_dispatch" on public.jobs for update to authenticated
  using (public.has_role(auth.uid(),'dispatch_admin')) with check (public.has_role(auth.uid(),'dispatch_admin'));
create policy "jobs_update_member" on public.jobs for update to authenticated
  using (public.has_role(auth.uid(),'member')) with check (public.has_role(auth.uid(),'member'));
create policy "jobs_update_creator" on public.jobs for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "jobs_update_driver" on public.jobs for update to authenticated
  using (assigned_driver_id in (select id from public.drivers where user_id = auth.uid()))
  with check (assigned_driver_id in (select id from public.drivers where user_id = auth.uid()));
create policy "jobs_delete_admin" on public.jobs for delete to authenticated using (public.has_role(auth.uid(),'super_admin'));

create policy "driver_sessions_select_self" on public.driver_sessions for select to authenticated using (user_id = auth.uid());
create policy "driver_sessions_select_admin" on public.driver_sessions for select to authenticated using (public.has_role(auth.uid(),'super_admin'));
create policy "driver_sessions_insert_self" on public.driver_sessions for insert to authenticated with check (user_id = auth.uid());
create policy "driver_sessions_update_self" on public.driver_sessions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "checklist_select_self" on public.driver_checklist_logs for select to authenticated
  using (driver_id in (select id from public.drivers where user_id = auth.uid()));
create policy "checklist_select_admin" on public.driver_checklist_logs for select to authenticated using (public.has_role(auth.uid(),'super_admin'));
create policy "checklist_insert_self" on public.driver_checklist_logs for insert to authenticated
  with check (driver_id in (select id from public.drivers where user_id = auth.uid()));

create policy "driver_locations_select_self" on public.driver_locations for select to authenticated
  using (driver_id in (select id from public.drivers where user_id = auth.uid()));
create policy "driver_locations_select_admin" on public.driver_locations for select to authenticated using (public.has_role(auth.uid(),'super_admin'));
create policy "driver_locations_insert_self" on public.driver_locations for insert to authenticated
  with check (driver_id in (select id from public.drivers where user_id = auth.uid()));

create policy "notifications_select_self" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notifications_update_self" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications_insert_admin" on public.notifications for insert to authenticated
  with check (public.has_role(auth.uid(),'super_admin') or public.has_role(auth.uid(),'dispatch_admin'));

create policy "anyone can submit a lead" on public.lead_submissions for insert to anon, authenticated with check (true);
create policy "admins can view leads" on public.lead_submissions for select to authenticated using (public.has_role(auth.uid(),'super_admin'));

create policy "push_subscriptions_own" on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============ APP SETTINGS & FEATURE FLAGS ============
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id)
);

insert into public.app_settings (key, value, description) values
  ('allow_direct_job_edit', 'true'::jsonb, 'Allow Staff Admins (member) and Dispatch Admins to edit jobs directly without SuperAdmin approval'),
  ('allow_direct_invoice_completion', 'true'::jsonb, 'Allow direct completion for Invoice jobs by Staff Admins'),
  ('require_cash_job_approval', 'true'::jsonb, 'Require SuperAdmin approval for Cash (COD) job completions'),
  ('allow_member_job_assign', 'true'::jsonb, 'Allow Staff Admins (member) to assign and reassign drivers to jobs')
on conflict (key) do nothing;

grant select on public.app_settings to authenticated;
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;

create policy "app_settings_read_all" on public.app_settings for select to authenticated using (true);
create policy "app_settings_admin_all" on public.app_settings for all to authenticated 
  using (public.has_role(auth.uid(), 'super_admin')) with check (public.has_role(auth.uid(), 'super_admin'));

create table if not exists public.user_permissions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  can_direct_edit boolean default null,
  can_direct_complete_invoice boolean default null,
  can_assign_jobs boolean default null,
  updated_at timestamptz default now()
);

grant select on public.user_permissions to authenticated;
grant all on public.user_permissions to service_role;
alter table public.user_permissions enable row level security;

create policy "user_permissions_read_all" on public.user_permissions for select to authenticated using (true);
create policy "user_permissions_admin_all" on public.user_permissions for all to authenticated 
  using (public.has_role(auth.uid(), 'super_admin')) with check (public.has_role(auth.uid(), 'super_admin'));

-- ============ STORAGE ============
insert into storage.buckets (id, name, public) values ('job-proofs','job-proofs', false)
on conflict (id) do nothing;

create policy "job_proofs_read_auth" on storage.objects for select to authenticated using (bucket_id = 'job-proofs');
create policy "job_proofs_write_auth" on storage.objects for insert to authenticated with check (bucket_id = 'job-proofs');
create policy "job_proofs_update_auth" on storage.objects for update to authenticated using (bucket_id = 'job-proofs');
`;
