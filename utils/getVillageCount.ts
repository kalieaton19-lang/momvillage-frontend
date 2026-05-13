// Fetch the count of village members for a user
import { supabase } from "../lib/supabase";

export async function getVillageCount(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("village_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) {
    console.error("Error fetching village count:", error);
    return 0;
  }
  return data?.length ?? 0;
}
