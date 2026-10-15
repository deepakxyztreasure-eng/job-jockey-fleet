-- ============================================================================
-- DRIVER NATIVE APP SCHEMA EXTENSIONS (100% Non-Breaking & Additive)
-- ============================================================================
-- Safe for production: does NOT drop or alter existing web app tables/columns.
-- Copy and run this in your Supabase SQL Editor if needed.

-- 1. MORNING & EVENING CHECKLISTS WITH ADMIN SIGN-OFF
create table if not exists public.driver_checklists (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  checklist_type text not null check (checklist_type in ('morning', 'evening')),
  date date not null default ((now() at time zone 'utc')::date),
  responses jsonb not null default '[]'::jsonb, -- array of { item_key, title, answer: 'yes'|'no', notes, photo_url }
  requires_signoff boolean not null default false,
  signoff_status text not null default 'none' check (signoff_status in ('none', 'pending', 'approved', 'rejected')),
  signoff_by uuid references auth.users(id) on delete set null,
  signoff_notes text,
  signoff_at timestamptz,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.driver_checklists to authenticated;
grant all on public.driver_checklists to service_role;
alter table public.driver_checklists enable row level security;

create policy "driver_checklists_select" on public.driver_checklists
  for select to authenticated using (true);

create policy "driver_checklists_insert_self" on public.driver_checklists
  for insert to authenticated with check (
    exists (
      select 1 from public.drivers d 
      where d.id = driver_checklists.driver_id and d.user_id = auth.uid()
    ) or public.has_role(auth.uid(), 'super_admin') or public.has_role(auth.uid(), 'dispatch_admin')
  );

create policy "driver_checklists_update" on public.driver_checklists
  for update to authenticated using (
    exists (
      select 1 from public.drivers d 
      where d.id = driver_checklists.driver_id and d.user_id = auth.uid()
    ) or public.has_role(auth.uid(), 'super_admin') or public.has_role(auth.uid(), 'dispatch_admin')
  );

-- 2. MULTI-STOP JOB SEQUENCING
create table if not exists public.job_stops (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  stop_order integer not null default 1,
  stop_type text not null default 'delivery' check (stop_type in ('pickup', 'delivery', 'weighbridge', 'waypoint')),
  location_id uuid references public.store_locations(id) on delete set null,
  address text not null,
  customer_name text,
  customer_mobile text,
  gate_code text,
  site_hazards text,
  contact_person text,
  instructions text,
  quantity numeric,
  quantity_unit text,
  status text not null default 'pending' check (status in ('pending', 'en_route', 'arrived', 'completed', 'skipped')),
  arrived_at timestamptz,
  completed_at timestamptz,
  proof_image_url text,
  signature_url text,
  signer_name text,
  pin_code text,
  docket_image_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.job_stops to authenticated;
grant all on public.job_stops to service_role;
alter table public.job_stops enable row level security;

create policy "job_stops_select" on public.job_stops for select to authenticated using (true);
create policy "job_stops_modify" on public.job_stops for all to authenticated using (true);

-- 3. ENHANCE DRIVER_LOCATIONS FOR ADAPTIVE GPS TRACKING
alter table public.driver_locations add column if not exists heading double precision;
alter table public.driver_locations add column if not exists speed double precision;
alter table public.driver_locations add column if not exists accuracy double precision;
alter table public.driver_locations add column if not exists is_moving boolean default false;
alter table public.driver_locations add column if not exists battery_level integer;
alter table public.driver_locations add column if not exists current_job_id uuid references public.jobs(id) on delete set null;

-- 4. NHVR FATIGUE & WORK-REST LOGGING
create table if not exists public.fatigue_logs (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  event_type text not null check (event_type in ('shift_start', 'work_driving', 'rest_break', 'shift_end')),
  start_time timestamptz not null default now(),
  end_time timestamptz,
  duration_minutes integer,
  location_lat double precision,
  location_lng double precision,
  odometer_reading numeric,
  notes text,
  created_at timestamptz not null default now()
);

grant select, insert, update on public.fatigue_logs to authenticated;
grant all on public.fatigue_logs to service_role;
alter table public.fatigue_logs enable row level security;

create policy "fatigue_logs_select" on public.fatigue_logs for select to authenticated using (true);
create policy "fatigue_logs_insert" on public.fatigue_logs for insert to authenticated with check (true);
create policy "fatigue_logs_update" on public.fatigue_logs for update to authenticated using (true);

-- 5. MID-SHIFT VEHICLE DEFECT & INCIDENT REPORTING
create table if not exists public.vehicle_defect_reports (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  vehicle text,
  job_id uuid references public.jobs(id) on delete set null,
  defect_type text not null check (defect_type in ('tyre', 'brakes', 'hydraulic_leak', 'engine_oil', 'coolant', 'lights', 'body', 'incident', 'other')),
  severity text not null default 'minor' check (severity in ('minor', 'urgent_action_required', 'critical_ground_vehicle')),
  description text not null,
  photo_urls text[] default array[]::text[],
  status text not null default 'open' check (status in ('open', 'acknowledged', 'repaired', 'dismissed')),
  reported_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  resolution_notes text,
  created_at timestamptz not null default now()
);

grant select, insert, update on public.vehicle_defect_reports to authenticated;
grant all on public.vehicle_defect_reports to service_role;
alter table public.vehicle_defect_reports enable row level security;

create policy "vehicle_defect_reports_select" on public.vehicle_defect_reports for select to authenticated using (true);
create policy "vehicle_defect_reports_insert" on public.vehicle_defect_reports for insert to authenticated with check (true);
create policy "vehicle_defect_reports_update" on public.vehicle_defect_reports for update to authenticated using (true);

-- 6. DRIVER COMPLIANCE CERTIFICATIONS & EXPIRIES
create table if not exists public.driver_certifications (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  cert_type text not null check (cert_type in ('heavy_vehicle_license', 'medical_certificate', 'white_card', 'quarry_site_induction', 'forklift_ticket', 'other')),
  cert_number text,
  issuer_or_site text,
  issue_date date,
  expiry_date date not null,
  document_url text,
  status text not null default 'valid' check (status in ('valid', 'expiring_soon', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.driver_certifications to authenticated;
grant all on public.driver_certifications to service_role;
alter table public.driver_certifications enable row level security;

create policy "driver_certifications_select" on public.driver_certifications for select to authenticated using (true);
create policy "driver_certifications_modify" on public.driver_certifications for all to authenticated using (public.has_role(auth.uid(), 'super_admin') or public.has_role(auth.uid(), 'dispatch_admin'));

-- 7. SOS / EMERGENCY ALERTS
create table if not exists public.emergency_alerts (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
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

grant select, insert, update on public.emergency_alerts to authenticated;
grant all on public.emergency_alerts to service_role;
alter table public.emergency_alerts enable row level security;

create policy "emergency_alerts_select" on public.emergency_alerts for select to authenticated using (true);
create policy "emergency_alerts_insert" on public.emergency_alerts for insert to authenticated with check (true);
create policy "emergency_alerts_update" on public.emergency_alerts for update to authenticated using (true);

-- 8. TWO-WAY DRIVER <-> DISPATCH IN-APP CHAT
create table if not exists public.job_messages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete set null,
  driver_id uuid references public.drivers(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null,
  sender_role text not null, -- 'driver' | 'dispatch_admin' | 'super_admin'
  message_text text not null,
  attachment_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

grant select, insert, update on public.job_messages to authenticated;
grant all on public.job_messages to service_role;
alter table public.job_messages enable row level security;

create policy "job_messages_select" on public.job_messages for select to authenticated using (true);
create policy "job_messages_insert" on public.job_messages for insert to authenticated with check (sender_id = auth.uid());
create policy "job_messages_update" on public.job_messages for update to authenticated using (true);

-- 9. SAFE ADDITIONS TO JOBS TABLE FOR ADVANCED DELIVERY PROOFS
alter table public.jobs add column if not exists customer_signature_url text;
alter table public.jobs add column if not exists customer_signature_name text;
alter table public.jobs add column if not exists customer_pin text;
alter table public.jobs add column if not exists weighbridge_docket_url text;
alter table public.jobs add column if not exists gross_weight numeric;
alter table public.jobs add column if not exists tare_weight numeric;
alter table public.jobs add column if not exists net_weight numeric;

-- 10. REALTIME PUBLICATION
do $$
begin
  alter publication supabase_realtime add table public.driver_checklists;
exception when others then null; end $$;

do $$
begin
  alter publication supabase_realtime add table public.job_stops;
exception when others then null; end $$;

do $$
begin
  alter publication supabase_realtime add table public.vehicle_defect_reports;
exception when others then null; end $$;

do $$
begin
  alter publication supabase_realtime add table public.emergency_alerts;
exception when others then null; end $$;

do $$
begin
  alter publication supabase_realtime add table public.job_messages;
exception when others then null; end $$;

notify pgrst, 'reload schema';
