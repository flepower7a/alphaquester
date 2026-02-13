
-- Webhook settings table
CREATE TABLE public.webhook_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  webhook_url TEXT, -- encrypted/hidden like token
  webhook_name TEXT DEFAULT 'Quest Notifier',
  avatar_path TEXT,
  is_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_settings ENABLE ROW LEVEL SECURITY;

-- Users can read their own settings (but webhook_url will be revoked below)
CREATE POLICY "Users can view their own webhook settings"
  ON public.webhook_settings FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own webhook settings"
  ON public.webhook_settings FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own webhook settings"
  ON public.webhook_settings FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own webhook settings"
  ON public.webhook_settings FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_webhook_settings_updated_at
  BEFORE UPDATE ON public.webhook_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- REVOKE webhook_url from anon/authenticated (same pattern as encrypted_token)
REVOKE ALL ON public.webhook_settings FROM anon, authenticated;
GRANT SELECT (id, user_id, webhook_name, avatar_path, is_enabled, created_at, updated_at) ON public.webhook_settings TO anon, authenticated;
GRANT INSERT (user_id, webhook_url, webhook_name, avatar_path, is_enabled) ON public.webhook_settings TO authenticated;
GRANT UPDATE (webhook_url, webhook_name, avatar_path, is_enabled) ON public.webhook_settings TO authenticated;
GRANT DELETE ON public.webhook_settings TO authenticated;

-- Storage bucket for webhook avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('webhook-avatars', 'webhook-avatars', true);

-- Storage policies
CREATE POLICY "Users can upload their own webhook avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'webhook-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own webhook avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'webhook-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Webhook avatars are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'webhook-avatars');

CREATE POLICY "Users can delete their own webhook avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'webhook-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
