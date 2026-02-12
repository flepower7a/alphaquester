
-- Add avatar and display info to discord_tokens
ALTER TABLE public.discord_tokens 
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS display_name text,
ADD COLUMN IF NOT EXISTS boost_months integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS nitro_type text;
