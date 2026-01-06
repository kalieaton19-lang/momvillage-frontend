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
  matchId: string;
  receiverId: string;
  createdAt?: string;
}) {
  // Simple UUID validator (RFC4122 v1-5-ish)
  const isUuid = (s: string) =>
    typeof s === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
  // Basic validations
  if (!supabase || typeof supabase.from !== 'function') {
    throw new Error('supabase client is required and must be initialized');
  }
  if (!isUuid(selectedConversation)) {
    throw new Error('selectedConversation must be a valid UUID string');
  }
  if (!isUuid(userId)) {
    throw new Error('userId must be a valid UUID string');
  }
  if (typeof messageText !== 'string' || messageText.trim() === '') {
    throw new Error('messageText must be a non-empty string');
  }
  if (typeof createdAt !== 'string' || isNaN(new Date(createdAt).getTime())) {
    throw new Error('createdAt must be a valid ISO datetime string');
  }
  const payload = {
    match_uuid: String(selectedConversation),
    match_id: matchId,
    sender_id: String(userId),
    receiver_id: receiverId,
    content: messageText,
    created_at: createdAt,
    metadata: {},
  };
  // Debug: log the full payload before insert
  console.log('DEBUG: Message insert payload:', payload);
  try {
    // Get the user's JWT
    const session = await supabase.auth.getSession();
    const userJwt = session?.data?.session?.access_token;
    if (!userJwt) throw new Error('No user JWT found for Edge Function call');

    const res = await fetch('/api/proxy-send-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userJwt}`,
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      console.log('Message created', data);
      return { data, error: null };
    } else {
      const err = await res.json().catch(async () => ({ message: await res.text() }));
      console.error('Send message failed', res.status, err);
      throw new Error(err.message || 'Send message failed');
    }
  } catch (err) {
    // This catches network or unexpected errors
    console.error('Unexpected error during sendMessageToMatch:', err);
    throw err;
  }
}
