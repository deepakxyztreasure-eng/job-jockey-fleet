CREATE TABLE IF NOT EXISTS public.job_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.job_titles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_titles_select_all" ON public.job_titles FOR SELECT TO authenticated USING (true);
CREATE POLICY "job_titles_admin_write" ON public.job_titles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
CREATE TRIGGER job_titles_updated BEFORE UPDATE ON public.job_titles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.job_titles (name, sort_order) VALUES
  ('Asphalt profiling', 10),('Asphalt screened', 20),('Asphalt hotmix', 30),
  ('Aggregate', 40),('Beaching Rock', 50),('Ballast Rock', 60),
  ('Bedding sand', 70),('Brick sand', 80),('Bags', 90),
  ('Concrete sand', 100),('Crushed rock', 110),('Crusher dust', 120),
  ('Coldstream Rock', 130),('Crushed concrete', 140),('Driveway Topping', 150),
  ('Drainage Rock', 160),('Decorative Stone', 170),('Dust', 180),
  ('Digger compost', 190),('Filling soil', 200),('Granite Rock', 210),
  ('Garden blend', 220),('Honey Granite', 230),('Kids play sand', 240),
  ('Lime stone', 250),('Lawn Blend', 260),('Mudstone', 270),
  ('Mulch', 280),('Packing sand', 290),('P-gravel', 300),
  ('Rubbles', 310),('Sand', 320),('Soil', 330),('Scoria', 340),
  ('Topsoil', 350),('Tuscan', 360),('Washed sand', 370),
  ('White stone', 380),('Yellow brick sand', 390)
ON CONFLICT (name) DO NOTHING;

UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email IN ('avtar.johal101@gmail.com', 'bobby_aries@hotmail.com');