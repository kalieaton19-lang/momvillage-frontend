-- Ensure required tables are included in Supabase realtime publication

DO $$
DECLARE
  target_table text;
  target_tables text[] := ARRAY[
    'public.posts',
    'public.post_comments',
    'public.messages',
    'public.notifications',
    'public.village_invitations'
  ];
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOREACH target_table IN ARRAY target_tables
  LOOP
    IF to_regclass(target_table) IS NULL THEN
      RAISE NOTICE 'Skipping % because table does not exist', target_table;
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = split_part(target_table, '.', 1)
        AND tablename = split_part(target_table, '.', 2)
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %s', target_table);
    END IF;
  END LOOP;
END $$;
