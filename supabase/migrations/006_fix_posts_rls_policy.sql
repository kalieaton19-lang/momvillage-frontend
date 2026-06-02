-- Migration: Fix RLS policies on posts table
-- Fixes: typo in ALTER TABLE, wrong USING vs WITH CHECK on INSERT, missing SELECT/UPDATE/DELETE policies

-- 1) Ensure RLS is enabled (safe to run even if already enabled)
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- 2) Drop the broken policy from migration 004 (may not exist if the typo prevented it)
DROP POLICY IF EXISTS "Allow authenticated inserts" ON public.posts;

-- 3) INSERT policy: authenticated users can insert rows where author_user_id = their uid
CREATE POLICY "posts_insert"
ON public.posts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND author_user_id = auth.uid());

-- 4) SELECT policy: authenticated users can read all posts
CREATE POLICY "posts_select"
ON public.posts
FOR SELECT
TO authenticated
USING (true);

-- 5) UPDATE policy: users can only update their own posts
CREATE POLICY "posts_update"
ON public.posts
FOR UPDATE
TO authenticated
USING (author_user_id = auth.uid())
WITH CHECK (author_user_id = auth.uid());

-- 6) DELETE policy: users can only delete their own posts
CREATE POLICY "posts_delete"
ON public.posts
FOR DELETE
TO authenticated
USING (author_user_id = auth.uid());
