
-- Replace SECURITY DEFINER view (linter flag) with a SECURITY DEFINER function
DROP VIEW IF EXISTS public.drivers_directory;

CREATE OR REPLACE FUNCTION public.list_drivers_directory()
RETURNS TABLE(id uuid, full_name text, active boolean, user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, full_name, active, user_id
  FROM public.drivers
  ORDER BY full_name;
$$;

REVOKE ALL ON FUNCTION public.list_drivers_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_drivers_directory() TO authenticated;
