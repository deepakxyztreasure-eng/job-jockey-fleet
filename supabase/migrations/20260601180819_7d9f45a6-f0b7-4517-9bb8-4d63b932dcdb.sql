
-- 1. Tighten drivers SELECT
DROP POLICY IF EXISTS drivers_select_authenticated ON public.drivers;

CREATE POLICY drivers_select_admin ON public.drivers
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'dispatch_admin'));

CREATE POLICY drivers_select_self ON public.drivers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 2. Safe directory view (no PII) for member/driver UI lookups
CREATE OR REPLACE VIEW public.drivers_directory
  WITH (security_invoker = off) AS
  SELECT id, full_name, active, user_id
  FROM public.drivers;

REVOKE ALL ON public.drivers_directory FROM PUBLIC, anon;
GRANT SELECT ON public.drivers_directory TO authenticated;

-- 3. Tighten notifications INSERT: admins and dispatch only
DROP POLICY IF EXISTS notifications_insert_admin_or_self ON public.notifications;

CREATE POLICY notifications_insert_admin ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(),'super_admin')
    OR has_role(auth.uid(),'dispatch_admin')
  );

-- Helper: any authenticated user can notify all super admins about a specific job
CREATE OR REPLACE FUNCTION public.notify_admins(
  p_title text,
  p_body  text,
  p_type  text,
  p_job_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.notifications (user_id, title, body, type, job_id)
  SELECT ur.user_id, p_title, p_body, p_type, p_job_id
  FROM public.user_roles ur
  WHERE ur.role IN ('super_admin','dispatch_admin');
END;
$$;

REVOKE ALL ON FUNCTION public.notify_admins(text,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_admins(text,text,text,uuid) TO authenticated;

-- 4. Revoke EXECUTE on internal trigger/auth-only functions
REVOKE ALL ON FUNCTION public.handle_new_user()    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_set_updated_at()  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_job_overlap() FROM PUBLIC, anon, authenticated;
