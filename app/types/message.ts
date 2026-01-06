export type MessageRow = {
  id?: string;
  match_uuid: string;
  match_id?: string | null;
  sender_id: string;
  receiver_id?: string | null;
  message_text: string;
  created_at?: string;
  metadata?: Record<string, any>;
  // Add any other fields your message row needs
};
