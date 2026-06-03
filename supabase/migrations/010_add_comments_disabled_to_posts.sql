-- Migration: Add comments_disabled column to posts table
-- Allows post authors to disable/enable comments on their posts

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS comments_disabled boolean NOT NULL DEFAULT false;

-- Allow post authors to update comments_disabled on their own posts
-- (The existing RLS update policy on posts should already cover this,
--  but we add a specific policy in case it doesn't exist yet)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'posts'
      AND policyname = 'Authors can update their own posts'
  ) THEN
    CREATE POLICY "Authors can update their own posts"
      ON public.posts
      FOR UPDATE
      USING (auth.uid() = author_user_id)
      WITH CHECK (auth.uid() = author_user_id);
  END IF;
END $$;
