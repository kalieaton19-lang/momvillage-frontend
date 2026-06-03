-- Migration: Allow comment authors to edit their own comments

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_comments_update_own" ON public.post_comments;

CREATE POLICY "post_comments_update_own"
  ON public.post_comments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_user_id)
  WITH CHECK (auth.uid() = author_user_id);
