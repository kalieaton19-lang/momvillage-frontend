-- Migration: Reset post_likes RLS policies to ensure likes persist and are readable

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'post_likes'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.post_likes', policy_row.policyname);
  END LOOP;
END
$$;

CREATE POLICY post_likes_select
ON public.post_likes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.id = post_likes.post_id
  )
);

CREATE POLICY post_likes_insert
ON public.post_likes
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.id = post_likes.post_id
  )
);

CREATE POLICY post_likes_delete
ON public.post_likes
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.post_likes TO authenticated;
