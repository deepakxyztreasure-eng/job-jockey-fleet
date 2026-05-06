ALTER TABLE public.jobs ALTER COLUMN pickup_location_id DROP NOT NULL;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS pickup_address TEXT;