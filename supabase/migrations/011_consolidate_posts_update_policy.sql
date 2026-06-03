-- Migration: Consolidate posts update policies
-- Keep a single owner-only UPDATE policy for authenticated users.

DROP POLICY IF EXISTS "posts_update" ON public.posts;
DROP POLICY IF EXISTS "Authors can update their own posts" ON public.posts;

CREATE POLICY "posts_update_own"
  ON public.posts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_user_id)
  WITH CHECK (auth.uid() = author_user_id);
