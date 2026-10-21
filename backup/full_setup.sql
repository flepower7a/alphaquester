-- Full database setup. Paste in Supabase SQL Editor and Run once.
create extension if not exists pg_cron; create extension if not exists pg_net;

-- ===== supabase/migrations/20260212041757_7a23a75a-a658-4bf8-8331-2a520202cb5e.sql =====

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    username TEXT,
    avatar_url TEXT,
    language TEXT DEFAULT 'ar',
    total_solved_quests INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create discord_tokens table (encrypted tokens)
CREATE TABLE public.discord_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    token_hash TEXT NOT NULL,
    discord_user_id TEXT,
    discord_username TEXT,
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.discord_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tokens" ON public.discord_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tokens" ON public.discord_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tokens" ON public.discord_tokens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tokens" ON public.discord_tokens FOR DELETE USING (auth.uid() = user_id);

-- Create quest_sessions table
CREATE TABLE public.quest_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    token_id UUID REFERENCES public.discord_tokens(id) ON DELETE SET NULL,
    quest_id TEXT NOT NULL,
    quest_name TEXT,
    game_title TEXT,
    reward_name TEXT,
    method TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'stopped')),
    progress INTEGER DEFAULT 0,
    target INTEGER DEFAULT 0,
    hero_image TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.quest_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions" ON public.quest_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON public.quest_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.quest_sessions FOR UPDATE USING (auth.uid() = user_id);

-- Create quest_logs table
CREATE TABLE public.quest_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.quest_sessions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    message TEXT NOT NULL,
    level TEXT DEFAULT 'info',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.quest_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own logs" ON public.quest_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own logs" ON public.quest_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, username)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'username');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Enable realtime for quest_sessions and quest_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.quest_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quest_logs;

-- ===== supabase/migrations/20260212043815_cf840a6d-338d-441c-bae6-00bfdd265687.sql =====

-- Create a function to get public stats for the landing page
CREATE OR REPLACE FUNCTION public.get_public_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_users', (SELECT COUNT(DISTINCT user_id) FROM profiles),
    'total_completed', (SELECT COUNT(*) FROM quest_sessions WHERE status = 'completed'),
    'total_active', (SELECT COUNT(*) FROM quest_sessions WHERE status = 'running')
  ) INTO result;
  RETURN result;
END;
$$;

-- ===== supabase/migrations/20260212050506_3443074d-a605-46b2-b5f6-5b49330612ea.sql =====

-- Add avatar and display info to discord_tokens
ALTER TABLE public.discord_tokens 
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS display_name text,
ADD COLUMN IF NOT EXISTS boost_months integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS nitro_type text;

-- ===== supabase/migrations/20260212051159_7a727379-1e3c-4f1d-9da3-7920ff426345.sql =====

-- Add encrypted token storage column
ALTER TABLE public.discord_tokens 
ADD COLUMN IF NOT EXISTS encrypted_token text;

-- ===== supabase/migrations/20260212064820_5aa261e6-e4a7-476b-a3a1-5fdfbeac6efe.sql =====

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

-- ===== supabase/migrations/20260212065445_de730411-6d3d-4297-ba1d-eac0b5d60936.sql =====

-- Allow service role (edge functions) to delete subscription codes
CREATE POLICY "Service role can delete codes"
  ON public.subscription_codes FOR DELETE
  USING (true);

-- Allow service role to insert codes
CREATE POLICY "Service role can insert codes"
  ON public.subscription_codes FOR INSERT
  WITH CHECK (true);

-- ===== supabase/migrations/20260213030039_0bcb0d93-c8d3-4dc2-a684-aa2d8832e295.sql =====
ALTER TABLE public.discord_tokens ADD COLUMN IF NOT EXISTS nitro_months integer DEFAULT 0;
-- ===== supabase/migrations/20260213232430_f94b5676-e73b-4a0c-9891-ae7931be2a1a.sql =====

-- Revoke SELECT permission on encrypted_token column for anon and authenticated roles
-- This ensures the token can NEVER be returned to the client, even with select=*
REVOKE ALL ON public.discord_tokens FROM anon, authenticated;

-- Re-grant SELECT on all columns EXCEPT encrypted_token
GRANT SELECT (id, user_id, token_hash, discord_user_id, discord_username, is_active, last_used_at, created_at, avatar_url, display_name, boost_months, nitro_type, nitro_months) ON public.discord_tokens TO authenticated;

-- Grant INSERT (needed for RLS insert policy)
GRANT INSERT ON public.discord_tokens TO authenticated;

-- Grant UPDATE (needed for RLS update policy)  
GRANT UPDATE ON public.discord_tokens TO authenticated;

-- Grant DELETE (needed for RLS delete policy)
GRANT DELETE ON public.discord_tokens TO authenticated;

-- ===== supabase/migrations/20260213234647_3016a4bf-8035-4f26-ba23-7ac978978309.sql =====

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

-- ===== supabase/migrations/20260214000507_77ebab4a-de7f-4b05-8396-a3385a0bba17.sql =====

-- Enable required extensions for cron scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ===== supabase/migrations/20260317014126_ecb309d0-706f-4836-bb00-8bd88b861382.sql =====

-- Add auto_quest_enabled column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auto_quest_enabled boolean NOT NULL DEFAULT false;

-- ===== supabase/migrations/20260802001121_6bbee0df-23f3-49a8-82d2-5cce2759f9ea.sql =====
ALTER TABLE public.quest_sessions
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_beat_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_message text;

DROP TRIGGER IF EXISTS trg_quest_sessions_updated_at ON public.quest_sessions;
CREATE TRIGGER trg_quest_sessions_updated_at
BEFORE UPDATE ON public.quest_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_quest_sessions_status_beat ON public.quest_sessions (status, last_beat_at);
CREATE INDEX IF NOT EXISTS idx_quest_sessions_user_created ON public.quest_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quest_sessions_token ON public.quest_sessions (token_id);
CREATE INDEX IF NOT EXISTS idx_quest_logs_session ON public.quest_logs (session_id);

CREATE OR REPLACE FUNCTION public.sweep_stale_quest_sessions(p_minutes integer DEFAULT 10)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.quest_sessions
     SET status = 'stopped',
         error_message = 'تم إيقافها تلقائياً: لا يوجد نشاط'
   WHERE status IN ('running', 'pending')
     AND COALESCE(last_beat_at, started_at, created_at) < now() - make_interval(mins => p_minutes);
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_old_quest_data(p_days integer DEFAULT 3)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected integer;
BEGIN
  DELETE FROM public.quest_logs
   WHERE session_id IN (
     SELECT id FROM public.quest_sessions
      WHERE status IN ('failed', 'stopped')
        AND created_at < now() - make_interval(days => p_days)
   );

  DELETE FROM public.quest_sessions
   WHERE status IN ('failed', 'stopped')
     AND created_at < now() - make_interval(days => p_days);
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_automation_overview()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'running', (SELECT COUNT(*) FROM quest_sessions WHERE status = 'running' AND user_id = auth.uid()),
    'stale', (SELECT COUNT(*) FROM quest_sessions WHERE status = 'running' AND user_id = auth.uid()
               AND COALESCE(last_beat_at, started_at, created_at) < now() - interval '10 minutes'),
    'completed_today', (SELECT COUNT(*) FROM quest_sessions WHERE status = 'completed' AND user_id = auth.uid()
               AND completed_at > now() - interval '24 hours'),
    'failed_today', (SELECT COUNT(*) FROM quest_sessions WHERE status IN ('failed','stopped') AND user_id = auth.uid()
               AND created_at > now() - interval '24 hours'),
    'tokens', (SELECT COUNT(*) FROM discord_tokens WHERE user_id = auth.uid() AND is_active = true)
  ) INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_automation_overview() TO authenticated;

SELECT public.sweep_stale_quest_sessions(10);
SELECT public.purge_old_quest_data(3);

SELECT cron.schedule('sweep-stale-quest-sessions', '*/5 * * * *', $$SELECT public.sweep_stale_quest_sessions(10);$$);
SELECT cron.schedule('purge-old-quest-data', '17 4 * * *', $$SELECT public.purge_old_quest_data(3);$$);
-- ===== supabase/migrations/20260802001152_9c225367-7e7b-4e3f-9a6f-9771368bc2c9.sql =====
REVOKE ALL ON FUNCTION public.sweep_stale_quest_sessions(integer) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.purge_old_quest_data(integer) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.get_automation_overview() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_automation_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_stale_quest_sessions(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_old_quest_data(integer) TO service_role;
-- ===== Extra cron jobs: replace YOUR_PROJECT_REF and YOUR_ANON_KEY =====
select cron.schedule('auto-quest-check','*/3 * * * *',$$select net.http_post(url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/auto-quest',headers:='{"Content-Type":"application/json","Authorization":"Bearer YOUR_ANON_KEY"}'::jsonb,body:='{"action":"check"}'::jsonb)$$);
select cron.schedule('auto-quest-heartbeat','* * * * *',$$select net.http_post(url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/auto-quest',headers:='{"Content-Type":"application/json","Authorization":"Bearer YOUR_ANON_KEY"}'::jsonb,body:='{"action":"heartbeat"}'::jsonb)$$);
