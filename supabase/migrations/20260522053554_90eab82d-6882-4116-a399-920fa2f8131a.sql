
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS number_of_loads integer,
  ADD COLUMN IF NOT EXISTS job_number bigint;

CREATE SEQUENCE IF NOT EXISTS public.jobs_job_number_seq;

-- Backfill existing rows by created_at order
DO $$
DECLARE r record; n bigint := 0;
BEGIN
  FOR r IN SELECT id FROM public.jobs WHERE job_number IS NULL ORDER BY created_at LOOP
    n := nextval('public.jobs_job_number_seq');
    UPDATE public.jobs SET job_number = n WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.jobs
  ALTER COLUMN job_number SET DEFAULT nextval('public.jobs_job_number_seq');

ALTER SEQUENCE public.jobs_job_number_seq OWNED BY public.jobs.job_number;
