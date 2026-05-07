-- Fetch profile info for both users
SELECT id, full_name, profile_photo_url, city, state
FROM public.user_public_profiles
WHERE id IN ('e2ef93ba-0f10-4e2c-bd6a-9283c0a792e4', '872b12bf-e26a-4bc2-800c-a0f5e657e4e5');

-- After running the above, fill in the values below:
-- Insert conversation only if it doesn't already exist in either direction
INSERT INTO public.conversations (
  user1_id,
  user2_id,
  user1_name,
  user2_name,
  user1_photo,
  user2_photo,
  user1_city,
  user2_city,
  user1_state,
  user2_state,
  user1_email,
  user2_email,
  is_placeholder,
  created_at,
  updated_at
)
SELECT
  'e2ef93ba-0f10-4e2c-bd6a-9283c0a792e4'::uuid AS user1_id,
  '872b12bf-e26a-4bc2-800c-a0f5e657e4e5'::uuid AS user2_id,
  me.full_name  AS user1_name,
  sh.full_name  AS user2_name,
  me.profile_photo_url AS user1_photo,
  sh.profile_photo_url AS user2_photo,
  me.city AS user1_city,
  sh.city AS user2_city,
  me.state AS user1_state,
  sh.state AS user2_state,
  NULL::text AS user1_email,
  NULL::text AS user2_email,
  FALSE AS is_placeholder,
  now() AS created_at,
  now() AS updated_at
FROM public.user_public_profiles me
JOIN public.user_public_profiles sh
  ON sh.id = '872b12bf-e26a-4bc2-800c-a0f5e657e4e5'::uuid
WHERE me.id = 'e2ef93ba-0f10-4e2c-bd6a-9283c0a792e4'::uuid
  AND NOT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE (c.user1_id = 'e2ef93ba-0f10-4e2c-bd6a-9283c0a792e4'::uuid AND c.user2_id = '872b12bf-e26a-4bc2-800c-a0f5e657e4e5'::uuid)
       OR (c.user1_id = '872b12bf-e26a-4bc2-800c-a0f5e657e4e5'::uuid AND c.user2_id = 'e2ef93ba-0f10-4e2c-bd6a-9283c0a792e4'::uuid)
  );