-- Migration: Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    match_uuid uuid NOT NULL,
    match_id uuid,
    sender_id uuid NOT NULL,
    receiver_id uuid,
    message_text text NOT NULL,
    created_at timestamptz DEFAULT now(),
    metadata jsonb DEFAULT '{}'
);

-- Optional: Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_match_uuid ON public.messages(match_uuid);
