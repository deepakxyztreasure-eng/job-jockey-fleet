
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_mobile text,
  ADD COLUMN IF NOT EXISTS quantity integer,
  ADD COLUMN IF NOT EXISTS cod boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS instructions text,
  ADD COLUMN IF NOT EXISTS delivery_location_id uuid REFERENCES public.store_locations(id) ON DELETE SET NULL;
