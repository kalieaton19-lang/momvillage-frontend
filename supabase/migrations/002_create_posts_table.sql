-- Migration: Create posts table for unified post system

-- CREATE TABLE posts (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   -- author_id uuid REFERENCES users(id) ON DELETE CASCADE,
--   author_id uuid,
--   author_name text NOT NULL,
--   type text CHECK (type IN ('general', 'support')) NOT NULL,
--   scope text CHECK (scope IN ('village', 'local')) NOT NULL,
--   title text NOT NULL,
--   content text NOT NULL,
--   location text,
--   start_time timestamptz,
--   end_time timestamptz,
--   created_at timestamptz NOT NULL DEFAULT now(),
--   updated_at timestamptz NOT NULL DEFAULT now()
-- );

-- Index for filtering by scope/type
-- CREATE INDEX idx_posts_scope_type ON posts(scope, type);

-- Index for author
-- CREATE INDEX idx_posts_author_id ON posts(author_id);
