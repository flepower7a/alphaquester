
-- Add encrypted token storage column
ALTER TABLE public.discord_tokens 
ADD COLUMN IF NOT EXISTS encrypted_token text;
