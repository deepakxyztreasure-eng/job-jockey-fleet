CREATE TABLE public.driver_checklist_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  checklist_completed boolean NOT NULL DEFAULT true,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(driver_id, date)
);

ALTER TABLE public.driver_checklist_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_select_self"
  ON public.driver_checklist_logs FOR SELECT TO authenticated
  USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

CREATE POLICY "checklist_select_admin"
  ON public.driver_checklist_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "checklist_insert_self"
  ON public.driver_checklist_logs FOR INSERT TO authenticated
  WITH CHECK (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

CREATE INDEX idx_checklist_driver_date ON public.driver_checklist_logs(driver_id, date);