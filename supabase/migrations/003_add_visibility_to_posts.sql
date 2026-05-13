-- Migration: Add visibility to posts
ALTER TABLE posts ADD COLUMN visibility text CHECK (visibility IN ('public', 'village')) NOT NULL DEFAULT 'village';
CREATE INDEX idx_posts_visibility ON posts(visibility);
