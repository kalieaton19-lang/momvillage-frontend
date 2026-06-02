-- Migration: Reset post_comments RLS policies to ensure comments are visible
-- to authenticated users who can see the parent post.

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'post_comments'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.post_comments', policy_row.policyname);
  END LOOP;
END
$$;

CREATE POLICY post_comments_select
ON public.post_comments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.id = post_comments.post_id
  )
);

CREATE POLICY post_comments_insert
ON public.post_comments
FOR INSERT
TO authenticated
WITH CHECK (
  author_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.id = post_comments.post_id
  )
);

CREATE POLICY post_comments_update
ON public.post_comments
FOR UPDATE
TO authenticated
USING (author_user_id = auth.uid())
WITH CHECK (author_user_id = auth.uid());

CREATE POLICY post_comments_delete
ON public.post_comments
FOR DELETE
TO authenticated
USING (author_user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_comments TO authenticated;
