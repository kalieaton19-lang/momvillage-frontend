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

export async function sendMessageToMatch({
  supabase,
  selectedConversation,
  userId,
  messageText,
  createdAt = new Date().toISOString(),
}) {
  // Simple UUID validator (RFC4122 v1-5-ish)
  const isUuid = (s) =>
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
    sender_id: String(userId),
    message_text: messageText,
    created_at: createdAt,
  };
  try {
    const { data, error } = await supabase.from('messages').insert(payload).select();
    if (error) {
      // Log full error object for debugging
      console.error('Supabase insert error object:', error);
      console.error('Error details:', error.details);
      console.error('Error hint:', error.hint);
      console.error('Error code:', error.code);
      // For better troubleshooting you can also log the payload (without secrets)
      console.error('Insert payload:', payload);
      // Throw to let caller handle UI / retry
      throw error;
    }
    return { data, error: null };
  } catch (err) {
    // This catches network or unexpected errors
    console.error('Unexpected error during sendMessageToMatch:', err);
    throw err;
  }
}
