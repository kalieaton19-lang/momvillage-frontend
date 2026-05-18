import { supabase } from "./supabase";

export async function createNotification({ userId, type, data }: { userId: string, type: string, data?: unknown }) {
  try {
    const payload = data === undefined || data === null ? null : data;
    const { error } = await supabase.from("notifications").insert({
      user_id: userId,
      type,
      data: payload,
      created_at: new Date().toISOString(),
      read: false,
    });
    if (error) {
      console.error("[notifications] failed to insert notification", error);
      return { error };
    }
    return { error: null };
  } catch (error: unknown) {
    console.error("[notifications] unexpected insert error", error);
    return { error };
  }
}
