-- Migration: Ensure multiple comments per author per post are allowed

ALTER TABLE public.post_comments
DROP CONSTRAINT IF EXISTS post_comments_one_author_per_post_idx;

DROP INDEX IF EXISTS public.post_comments_one_author_per_post_idx;
