
-- Payment status enum
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending','partial','paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS payment_status payment_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS completion_notes text,
  ADD COLUMN IF NOT EXISTS proof_image_url text,
  ADD COLUMN IF NOT EXISTS completion_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Update overlap trigger to exclude completion_requested/rejected/issue from blocking? Keep blocking except completed/closed.
-- Existing function already excludes only completed/closed. Good.

-- Storage bucket for proof images (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-proofs','job-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "drivers upload own proofs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'job-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "drivers read own proofs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'job-proofs' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(),'super_admin')));

CREATE POLICY "admin manage proofs"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'job-proofs' AND has_role(auth.uid(),'super_admin'))
WITH CHECK (bucket_id = 'job-proofs' AND has_role(auth.uid(),'super_admin'));
