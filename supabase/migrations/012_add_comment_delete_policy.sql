-- Migration: Allow comment authors and post authors to delete comments

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_comments_delete_own_or_post_owner" ON public.post_comments;

CREATE POLICY "post_comments_delete_own_or_post_owner"
  ON public.post_comments
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = author_user_id
    OR EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = post_comments.post_id
        AND p.author_user_id = auth.uid()
    )
  );
