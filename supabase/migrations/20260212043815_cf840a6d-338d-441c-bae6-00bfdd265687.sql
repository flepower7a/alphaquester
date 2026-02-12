
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
