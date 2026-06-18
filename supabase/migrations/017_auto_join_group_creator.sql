-- Automatically add group creators as approved members.

-- 1) Backfill existing groups where creator is not yet in group_members.
INSERT INTO public.group_members (group_id, user_id, status)
SELECT g.id, g.creator_user_id, 'approved'
FROM public.groups g
LEFT JOIN public.group_members gm
  ON gm.group_id = g.id
 AND gm.user_id = g.creator_user_id
WHERE g.creator_user_id IS NOT NULL
  AND gm.group_id IS NULL;

-- 2) Trigger function to auto-join creator for future groups.
CREATE OR REPLACE FUNCTION public.auto_join_group_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, status)
  VALUES (NEW.id, NEW.creator_user_id, 'approved')
  ON CONFLICT (group_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3) Trigger on groups inserts.
DROP TRIGGER IF EXISTS trg_auto_join_group_creator ON public.groups;

CREATE TRIGGER trg_auto_join_group_creator
AFTER INSERT ON public.groups
FOR EACH ROW
EXECUTE FUNCTION public.auto_join_group_creator();
