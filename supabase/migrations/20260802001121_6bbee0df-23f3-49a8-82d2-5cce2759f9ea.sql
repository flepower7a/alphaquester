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