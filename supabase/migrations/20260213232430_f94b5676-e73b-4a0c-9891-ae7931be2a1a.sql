
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
