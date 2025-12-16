-- Enable Row Level Security
ALTER TABLE user_public_profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to upsert (insert/update) their own profile
CREATE POLICY "Users can upsert their own profile" ON user_public_profiles
  FOR INSERT, UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
