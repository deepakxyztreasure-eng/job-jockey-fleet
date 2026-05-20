
CREATE TABLE public.driver_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  driver_id uuid,
  login_time timestamptz NOT NULL DEFAULT now(),
  logout_time timestamptz,
  total_minutes integer,
  status text NOT NULL DEFAULT 'online',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_driver_sessions_user ON public.driver_sessions(user_id);
CREATE INDEX idx_driver_sessions_status ON public.driver_sessions(status);
CREATE INDEX idx_driver_sessions_login ON public.driver_sessions(login_time DESC);

ALTER TABLE public.driver_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver_sessions_select_admin"
  ON public.driver_sessions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "driver_sessions_select_self"
  ON public.driver_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "driver_sessions_insert_self"
  ON public.driver_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "driver_sessions_update_self"
  ON public.driver_sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER driver_sessions_updated_at
  BEFORE UPDATE ON public.driver_sessions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
