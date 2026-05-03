
-- Enums
CREATE TYPE public.app_role AS ENUM ('super_admin', 'member', 'driver');
CREATE TYPE public.job_status AS ENUM ('pending','assigned','accepted','in_progress','completed','payment_pending','closed');
CREATE TYPE public.job_priority AS ENUM ('standard','priority');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role function (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id ORDER BY
    CASE role WHEN 'super_admin' THEN 1 WHEN 'member' THEN 2 WHEN 'driver' THEN 3 END
  LIMIT 1;
$$;

-- Store locations
CREATE TABLE public.store_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.store_locations ENABLE ROW LEVEL SECURITY;

-- Drivers
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  license_number TEXT,
  vehicle TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- Jobs
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  pickup_location_id UUID NOT NULL REFERENCES public.store_locations(id),
  delivery_address TEXT,
  scheduled_date DATE,
  priority job_priority NOT NULL DEFAULT 'standard',
  invoice_number TEXT NOT NULL,
  price NUMERIC(12,2),
  show_price BOOLEAN NOT NULL DEFAULT false,
  status job_status NOT NULL DEFAULT 'pending',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  assigned_driver_id UUID REFERENCES public.drivers(id),
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE INDEX jobs_driver_time_idx ON public.jobs(assigned_driver_id, start_time, end_time);

-- Overlap prevention trigger
CREATE OR REPLACE FUNCTION public.prevent_job_overlap()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.assigned_driver_id IS NOT NULL AND NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    IF NEW.end_time <= NEW.start_time THEN
      RAISE EXCEPTION 'End time must be after start time';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.assigned_driver_id = NEW.assigned_driver_id
        AND j.id <> NEW.id
        AND j.status NOT IN ('completed','closed')
        AND j.start_time IS NOT NULL AND j.end_time IS NOT NULL
        AND tstzrange(j.start_time, j.end_time, '[)') && tstzrange(NEW.start_time, NEW.end_time, '[)')
    ) THEN
      RAISE EXCEPTION 'Driver already assigned to an overlapping job in this time window';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_job_overlap
BEFORE INSERT OR UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.prevent_job_overlap();

-- Driver live locations
CREATE TABLE public.driver_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
CREATE INDEX driver_locations_driver_time_idx ON public.driver_locations(driver_id, recorded_at DESC);
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER tg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_store_locations_updated BEFORE UPDATE ON public.store_locations FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_drivers_updated BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_jobs_updated BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  -- Default role: member (admin must promote)
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============

-- profiles: users see/update own; admins see all
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_admin_update" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'));

-- user_roles: only admins manage; users can read their own
CREATE POLICY "user_roles_select_self_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- store_locations: any authenticated can read; admin writes
CREATE POLICY "store_locations_select_all" ON public.store_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "store_locations_admin_write" ON public.store_locations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- drivers: admins manage; the linked user can read their own driver record; members can read driver list (to assign)
CREATE POLICY "drivers_select_authenticated" ON public.drivers FOR SELECT TO authenticated USING (true);
CREATE POLICY "drivers_admin_write" ON public.drivers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- jobs:
-- select: admin all, member their own + ones they can see, driver: jobs assigned to them
CREATE POLICY "jobs_select_admin" ON public.jobs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "jobs_select_creator" ON public.jobs FOR SELECT TO authenticated
  USING (created_by = auth.uid());
CREATE POLICY "jobs_select_driver" ON public.jobs FOR SELECT TO authenticated
  USING (assigned_driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

-- insert: admins or members
CREATE POLICY "jobs_insert_member_or_admin" ON public.jobs FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND (
      public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'member')
    )
  );

-- update: admin all, members on their own jobs, drivers on assigned jobs (status only enforced at app layer)
CREATE POLICY "jobs_update_admin" ON public.jobs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "jobs_update_creator" ON public.jobs FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "jobs_update_driver" ON public.jobs FOR UPDATE TO authenticated
  USING (assigned_driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()))
  WITH CHECK (assigned_driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

-- delete: admin only
CREATE POLICY "jobs_delete_admin" ON public.jobs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'));

-- driver_locations: driver inserts own; admin reads all; driver reads own
CREATE POLICY "driver_locations_insert_self" ON public.driver_locations FOR INSERT TO authenticated
  WITH CHECK (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));
CREATE POLICY "driver_locations_select_admin" ON public.driver_locations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "driver_locations_select_self" ON public.driver_locations FOR SELECT TO authenticated
  USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

-- notifications
CREATE POLICY "notifications_select_self" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "notifications_update_self" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications_insert_admin_or_self" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR user_id = auth.uid());
