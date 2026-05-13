import { supabase } from "./supabase";

export async function createNotification({ userId, type, data }: { userId: string, type: string, data?: any }) {
  return supabase.from("notifications").insert({
    user_id: userId,
    type,
    data: data ? JSON.stringify(data) : null,
    created_at: new Date().toISOString(),
    read: false,
  });
}
