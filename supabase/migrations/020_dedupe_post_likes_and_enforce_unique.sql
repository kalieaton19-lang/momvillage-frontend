-- Migration: dedupe post_likes rows and enforce unique (post_id, user_id)

DO $$
BEGIN
  IF to_regclass('public.post_likes') IS NULL THEN
    RAISE NOTICE 'public.post_likes does not exist; skipping dedupe/constraint enforcement.';
    RETURN;
  END IF;

  DELETE FROM public.post_likes pl
  USING (
    SELECT id
    FROM (
      SELECT
        id,
        row_number() OVER (
          PARTITION BY post_id, user_id
          ORDER BY created_at ASC, id ASC
        ) AS rn
      FROM public.post_likes
    ) ranked
    WHERE ranked.rn > 1
  ) duplicates
  WHERE pl.id = duplicates.id;

  IF NOT EXISTS (
    SELECT 1
    FROM (
      SELECT tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
       AND tc.table_name = kcu.table_name
      WHERE tc.table_schema = 'public'
        AND tc.table_name = 'post_likes'
        AND tc.constraint_type = 'UNIQUE'
      GROUP BY tc.constraint_name
      HAVING array_agg(kcu.column_name ORDER BY kcu.ordinal_position) = ARRAY['post_id', 'user_id']
    ) existing_unique
  ) THEN
    ALTER TABLE public.post_likes
      ADD CONSTRAINT post_likes_post_id_user_id_key UNIQUE (post_id, user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_post_likes_post_id
  ON public.post_likes(post_id);
