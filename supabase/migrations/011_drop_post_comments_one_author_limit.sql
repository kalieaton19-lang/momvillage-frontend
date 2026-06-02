-- Migration: Allow multiple comments per author per post

DROP INDEX IF EXISTS public.post_comments_one_author_per_post_idx;
