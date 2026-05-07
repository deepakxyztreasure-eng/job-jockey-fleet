ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS actual_start_time timestamptz,
ADD COLUMN IF NOT EXISTS actual_end_time timestamptz;