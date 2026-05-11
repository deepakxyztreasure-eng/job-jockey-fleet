ALTER TABLE public.jobs ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.jobs DROP CONSTRAINT jobs_created_by_fkey;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;