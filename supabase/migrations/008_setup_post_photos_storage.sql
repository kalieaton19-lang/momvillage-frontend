-- Migration: Set up storage bucket + policies for optional post photos

-- Create bucket (public so post images can be viewed via public URL)
insert into storage.buckets (id, name, public)
values ('post-photos', 'post-photos', true)
on conflict (id) do nothing;

-- Reset policies to avoid drift across environments
DROP POLICY IF EXISTS "post_photos_insert_auth" ON storage.objects;
DROP POLICY IF EXISTS "post_photos_select_public" ON storage.objects;
DROP POLICY IF EXISTS "post_photos_delete_own" ON storage.objects;

-- Authenticated users can upload to post-photos
CREATE POLICY "post_photos_insert_auth"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'post-photos');

-- Anyone can read files in post-photos (bucket is public)
CREATE POLICY "post_photos_select_public"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'post-photos');

-- Authenticated users can delete only files named with their own prefix: <uid>-...
CREATE POLICY "post_photos_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'post-photos'
  AND name LIKE auth.uid()::text || '-%'
);
