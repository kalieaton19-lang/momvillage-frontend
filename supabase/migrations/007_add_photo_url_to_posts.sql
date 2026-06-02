-- Migration: Add optional photo_url column to posts table
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS photo_url text;

-- Update the create_post function to accept and store photo_url
CREATE OR REPLACE FUNCTION public.create_post(
  p_content text,
  p_scope text,
  p_village_member_id uuid,
  p_title text,
  p_type text,
  p_visibility text,
  p_location text,
  p_author_name text,
  p_author_user_id uuid,
  p_photo_url text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_author_user_id uuid;
  v_new_post public.posts;
BEGIN
  v_author_user_id := auth.uid();
  IF v_author_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.posts (
    author_user_id,
    author_name,
    type,
    scope,
    visibility,
    title,
    content,
    location,
    village_member_id,
    photo_url
  ) VALUES (
    v_author_user_id,
    p_author_name,
    p_type,
    p_scope,
    p_visibility,
    p_title,
    p_content,
    p_location,
    p_village_member_id,
    p_photo_url
  )
  RETURNING * INTO v_new_post;

  RETURN row_to_json(v_new_post);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_post(text, text, uuid, text, text, text, text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_post(text, text, uuid, text, text, text, text, text, uuid, text) TO anon;
