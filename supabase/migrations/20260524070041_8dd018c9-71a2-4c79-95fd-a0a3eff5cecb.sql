-- Add new 'dispatch_admin' role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'dispatch_admin';

-- Allow dispatch_admin to view all jobs
CREATE POLICY jobs_select_dispatch ON public.jobs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'dispatch_admin'));

-- Allow dispatch_admin to update jobs (assign / unassign drivers).
-- Full edits are routed through the pending_edit approval flow in app code.
CREATE POLICY jobs_update_dispatch ON public.jobs
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'dispatch_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'dispatch_admin'));
