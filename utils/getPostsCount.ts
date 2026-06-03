// Fetch the count of posts for a user (patched to trigger rebuild)
import { supabase } from "../lib/supabase";

export async function getPostsCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("author_user_id", userId);
  if (error) {
    console.error("Error fetching posts count:", error);
    return 0;
  }
  return count ?? 0;
}
