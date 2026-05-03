CREATE TABLE public.lead_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT NOT NULL,
  business_type TEXT,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can submit a lead"
ON public.lead_submissions FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "admins can view leads"
ON public.lead_submissions FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));