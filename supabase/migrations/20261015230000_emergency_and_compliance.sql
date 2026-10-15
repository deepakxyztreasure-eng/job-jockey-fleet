-- ============================================================================
-- EMERGENCY SOS & COMPLIANCE TABLES MIGRATION
-- ============================================================================
-- 100% Non-Breaking & Additive Migration

-- 1. EMERGENCY ALERTS TABLE
create table if not exists public.emergency_alerts (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  driver_name text,
  driver_phone text,
  latitude double precision not null,
  longitude double precision not null,
  location_address text,
  battery_level integer,
  status text not null default 'active' check (status in ('active', 'acknowledged', 'resolved')),
  timestamp timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

-- Index for quick lookups
create index if not exists idx_emergency_alerts_status on public.emergency_alerts(status);
create index if not exists idx_emergency_alerts_driver on public.emergency_alerts(driver_id);

-- Grants & RLS for emergency_alerts
grant select, insert, update on public.emergency_alerts to authenticated;
grant all on public.emergency_alerts to service_role;
alter table public.emergency_alerts enable row level security;

drop policy if exists "emergency_alerts_select" on public.emergency_alerts;
create policy "emergency_alerts_select" on public.emergency_alerts for select to authenticated using (true);

drop policy if exists "emergency_alerts_insert" on public.emergency_alerts;
create policy "emergency_alerts_insert" on public.emergency_alerts for insert to authenticated with check (true);

drop policy if exists "emergency_alerts_update" on public.emergency_alerts;
create policy "emergency_alerts_update" on public.emergency_alerts for update to authenticated using (true);

-- 2. DRIVER CHECKLISTS TABLE (If not yet created)
create table if not exists public.driver_checklists (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  checklist_type text not null check (checklist_type in ('morning', 'evening')),
  date date not null default ((now() at time zone 'utc')::date),
  responses jsonb not null default '[]'::jsonb,
  requires_signoff boolean not null default false,
  signoff_status text not null default 'none' check (signoff_status in ('none', 'pending', 'approved', 'rejected')),
  signoff_by uuid references auth.users(id) on delete set null,
  signoff_notes text,
  signoff_at timestamptz,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_driver_checklists_date on public.driver_checklists(driver_id, date);

grant select, insert, update on public.driver_checklists to authenticated;
grant all on public.driver_checklists to service_role;
alter table public.driver_checklists enable row level security;

drop policy if exists "driver_checklists_select" on public.driver_checklists;
create policy "driver_checklists_select" on public.driver_checklists for select to authenticated using (true);

drop policy if exists "driver_checklists_insert" on public.driver_checklists;
create policy "driver_checklists_insert" on public.driver_checklists for insert to authenticated with check (true);

drop policy if exists "driver_checklists_update" on public.driver_checklists;
create policy "driver_checklists_update" on public.driver_checklists for update to authenticated using (true);

-- 3. ENABLE SUPABASE REALTIME PUBLICATION
do $$
begin
  alter publication supabase_realtime add table public.emergency_alerts;
exception when others then null; end $$;

do $$
begin
  alter publication supabase_realtime add table public.driver_checklists;
exception when others then null; end $$;

notify pgrst, 'reload schema';
