
-- Add auto_quest_enabled column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auto_quest_enabled boolean NOT NULL DEFAULT false;
