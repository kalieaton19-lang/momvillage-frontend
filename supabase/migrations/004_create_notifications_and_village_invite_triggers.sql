create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null,
  data jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_created_at
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
  on public.notifications
  for select
  using (auth.uid() = user_id);

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
  on public.notifications
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.handle_village_invitation_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.notifications (user_id, type, data)
    values (
      new.to_user_id,
      'village_invite_sent',
      jsonb_build_object(
        'invitation_id', new.id,
        'from_user_id', new.from_user_id,
        'to_user_id', new.to_user_id,
        'status', new.status
      )
    );
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    if new.status = 'resent' then
      insert into public.notifications (user_id, type, data)
      values (
        new.to_user_id,
        'village_invite_resent',
        jsonb_build_object(
          'invitation_id', new.id,
          'from_user_id', new.from_user_id,
          'to_user_id', new.to_user_id,
          'status', new.status
        )
      );
    elsif new.status = 'accepted' then
      insert into public.notifications (user_id, type, data)
      values (
        new.from_user_id,
        'village_invite_accepted',
        jsonb_build_object(
          'invitation_id', new.id,
          'from_user_id', new.from_user_id,
          'to_user_id', new.to_user_id,
          'status', new.status
        )
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists village_invitation_notification_trigger on public.village_invitations;
create trigger village_invitation_notification_trigger
after insert or update on public.village_invitations
for each row
execute function public.handle_village_invitation_notification();