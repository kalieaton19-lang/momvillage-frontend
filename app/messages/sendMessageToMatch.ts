/**
 * sendMessageToMatch
 * Validates inputs, inserts a message into public.messages, and logs full errors.
 *
 * Params:
 * - supabase: initialized Supabase client (from createClient)
 * - selectedConversation: uuid string (match_uuid)
 * - userId: uuid string (sender_id)
 * - messageText: string
 * - createdAt: optional ISO string; defaults to new Date().toISOString()
 *
 * Returns:
 * - { data, error } from Supabase insert (or throws for validation errors)
 */


import type { SupabaseClient } from '@supabase/supabase-js';
import type { MessageRow } from '../types/message';

export async function sendMessageToMatch({
  supabase,
  selectedConversation,
  userId,
  messageText,
  matchId,
  receiverId,
  createdAt = new Date().toISOString(),
}: {
  supabase: SupabaseClient;
  selectedConversation: string;
  userId: string;
  messageText: string;
  matchId?: string;
  receiverId?: string;
  createdAt?: string;
}): Promise<{ data: MessageRow | null; error: { message: string; status?: number } | null; status: number }> {
  const isUuid = (s: unknown) =>
    typeof s === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s as string);

  if (!supabase || typeof supabase.from !== 'function') throw new Error('supabase client required');
  if (!isUuid(selectedConversation)) throw new Error('selectedConversation must be a UUID');
  if (!isUuid(userId)) throw new Error('userId must be a UUID');
  if (typeof messageText !== 'string' || messageText.trim() === '') throw new Error('messageText required');
  if (createdAt && isNaN(new Date(createdAt).getTime())) throw new Error('createdAt invalid');
  if (matchId && !isUuid(matchId)) throw new Error('matchId invalid');
  if (receiverId && !isUuid(receiverId)) throw new Error('receiverId invalid');

  const payload = {
    match_uuid: selectedConversation,
    match_id: matchId ?? null,
    sender_id: userId,
    receiver_id: receiverId ?? null,
    message_text: messageText,
    created_at: createdAt,
    metadata: {},
  };

  if (process.env.NODE_ENV !== 'production') console.debug('Message payload', payload);

  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const userJwt = session?.access_token;
    if (!userJwt) return { data: null, error: { message: 'Not authenticated' }, status: 401 };

    const res = await fetch('/api/proxy-send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userJwt}` },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    if (res.ok) {
      return { data: parsed as MessageRow, error: null, status: res.status };
    } else {
      const msg = parsed?.message || parsed || `Request failed ${res.status}`;
      return { data: null, error: { message: msg, status: res.status }, status: res.status };
    }
  } catch (err: any) {
    console.error('sendMessageToMatch error', err);
    return { data: null, error: { message: err?.message || 'Unexpected' }, status: 0 };
  }
}
