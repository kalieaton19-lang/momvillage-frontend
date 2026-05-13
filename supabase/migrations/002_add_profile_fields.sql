-- Add missing profile fields to user_public_profiles
ALTER TABLE public.user_public_profiles
ADD COLUMN IF NOT EXISTS number_of_kids integer,
ADD COLUMN IF NOT EXISTS kids_age_groups text[],
ADD COLUMN IF NOT EXISTS parenting_style text,
ADD COLUMN IF NOT EXISTS bio text;
