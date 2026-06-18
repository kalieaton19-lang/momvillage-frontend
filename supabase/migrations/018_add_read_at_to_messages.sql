alter table if exists public.messages
add column if not exists read_at timestamptz;

create index if not exists idx_messages_conversation_receiver_unread
on public.messages (conversation_id, receiver_id)
where read_at is null;
