-- Migration: Add comments_disabled column to posts table
-- Allows post authors to disable/enable comments on their posts

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS comments_disabled boolean NOT NULL DEFAULT false;
