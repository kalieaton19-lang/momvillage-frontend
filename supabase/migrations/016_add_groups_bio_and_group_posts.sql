-- Add group bio and group-scoped posts support

ALTER TABLE IF EXISTS public.groups
  ADD COLUMN IF NOT EXISTS bio text;

ALTER TABLE IF EXISTS public.posts
  ADD COLUMN IF NOT EXISTS group_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'posts_group_id_fkey'
  ) THEN
    ALTER TABLE public.posts
      ADD CONSTRAINT posts_group_id_fkey
      FOREIGN KEY (group_id)
      REFERENCES public.groups(id)
      ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_posts_group_id_created_at
  ON public.posts(group_id, created_at DESC);
