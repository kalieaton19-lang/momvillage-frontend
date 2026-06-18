create or replace function public.handle_message_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.receiver_id is not null and new.receiver_id <> new.sender_id then
      insert into public.notifications (user_id, type, data)
      values (
        new.receiver_id,
        'message_received',
        jsonb_build_object(
          'message_id', new.id,
          'conversation_id', new.conversation_id,
          'sender_id', new.sender_id,
          'receiver_id', new.receiver_id
        )
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists message_notification_trigger on public.messages;
create trigger message_notification_trigger
after insert on public.messages
for each row
execute function public.handle_message_notification();
