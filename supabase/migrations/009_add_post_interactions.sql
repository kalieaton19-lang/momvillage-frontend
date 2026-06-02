-- Migration: Add likes, comments, and shares for posts

CREATE TABLE IF NOT EXISTS public.post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.post_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON public.post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_shares_post_id ON public.post_shares(post_id);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_likes_select" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_insert" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_delete" ON public.post_likes;

CREATE POLICY "post_likes_select"
ON public.post_likes
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_likes.post_id));

CREATE POLICY "post_likes_insert"
ON public.post_likes
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_likes.post_id)
);

CREATE POLICY "post_likes_delete"
ON public.post_likes
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "post_comments_select" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_insert" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_update" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_delete" ON public.post_comments;

CREATE POLICY "post_comments_select"
ON public.post_comments
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_comments.post_id));

CREATE POLICY "post_comments_insert"
ON public.post_comments
FOR INSERT
TO authenticated
WITH CHECK (
  author_user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_comments.post_id)
);

CREATE POLICY "post_comments_update"
ON public.post_comments
FOR UPDATE
TO authenticated
USING (author_user_id = auth.uid())
WITH CHECK (author_user_id = auth.uid());

CREATE POLICY "post_comments_delete"
ON public.post_comments
FOR DELETE
TO authenticated
USING (author_user_id = auth.uid());

DROP POLICY IF EXISTS "post_shares_select" ON public.post_shares;
DROP POLICY IF EXISTS "post_shares_insert" ON public.post_shares;
DROP POLICY IF EXISTS "post_shares_delete" ON public.post_shares;

CREATE POLICY "post_shares_select"
ON public.post_shares
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_shares.post_id));

-- Shares allowed only for public posts
CREATE POLICY "post_shares_insert"
ON public.post_shares
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.id = post_shares.post_id
      AND p.visibility = 'public'
  )
);

CREATE POLICY "post_shares_delete"
ON public.post_shares
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.post_likes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_comments TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.post_shares TO authenticated;
