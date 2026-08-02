REVOKE ALL ON FUNCTION public.sweep_stale_quest_sessions(integer) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.purge_old_quest_data(integer) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.get_automation_overview() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_automation_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_stale_quest_sessions(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_old_quest_data(integer) TO service_role;