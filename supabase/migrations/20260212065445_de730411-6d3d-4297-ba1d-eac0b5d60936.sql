
-- Allow service role (edge functions) to delete subscription codes
CREATE POLICY "Service role can delete codes"
  ON public.subscription_codes FOR DELETE
  USING (true);

-- Allow service role to insert codes
CREATE POLICY "Service role can insert codes"
  ON public.subscription_codes FOR INSERT
  WITH CHECK (true);
