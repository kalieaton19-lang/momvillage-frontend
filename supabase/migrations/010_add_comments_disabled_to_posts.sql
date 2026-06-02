-- Migration: allow post owners to disable/enable comments per post
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS comments_disabled boolean NOT NULL DEFAULT false;
