ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS pending_edit jsonb,
  ADD COLUMN IF NOT EXISTS pending_edit_by uuid,
  ADD COLUMN IF NOT EXISTS pending_edit_at timestamptz;