-- Rename author_id to author_user_id in posts table for RLS compatibility
ALTER TABLE public.posts RENAME COLUMN author_id TO author_user_id;
