
-- Add account_type to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'free';

-- Create subscription_codes table
CREATE TABLE public.subscription_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_by UUID REFERENCES public.profiles(user_id),
  used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_codes ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read codes (for verification)
CREATE POLICY "Authenticated users can verify codes"
  ON public.subscription_codes FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only service role can insert/update codes (edge function)
CREATE POLICY "Service role manages codes"
  ON public.subscription_codes FOR UPDATE
  USING (auth.uid() IS NOT NULL AND used_by IS NULL);

-- Insert a test code
INSERT INTO public.subscription_codes (code, expires_at)
VALUES ('AQ7X-K9M2-R4PL-W8ZN', now() + interval '1 year');
