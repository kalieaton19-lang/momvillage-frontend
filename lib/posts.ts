// Fetch a single post by ID
export async function fetchPostById(id: string): Promise<Post | null> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw error;
  }
  return data as Post;
}

// Edit a post
export async function updatePost(id: string, updates: Partial<Omit<Post, "id" | "author_id" | "created_at">>): Promise<Post> {
  const { data, error } = await supabase
    .from("posts")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Post;
}

// Delete a post
export async function deletePost(id: string): Promise<void> {
  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
import { supabase } from "../lib/supabase";
import { Post, PostType, PostScope, PostVisibility } from "../types/post";

// Fetch posts with optional filters
type FetchPostsOptions = {
  type?: PostType;
  scope?: PostScope;
  visibility?: PostVisibility;
  author_user_id?: string;
};

export async function fetchPosts(options: FetchPostsOptions = {}): Promise<Post[]> {
  let query = supabase.from("posts").select("*");
  if (options.type) query = query.eq("type", options.type);
  if (options.scope) query = query.eq("scope", options.scope);
  if (options.visibility) query = query.eq("visibility", options.visibility);
  if (options.author_user_id) query = query.eq("author_user_id", options.author_user_id);
  query = query.order("created_at", { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  return data as Post[];
}
// Create a new post
export async function createPost(post: Omit<Post, "id" | "created_at" | "updated_at"> & { village_member_id?: string }): Promise<{ data: Post | null, error: any }> {
  // Map frontend scope to backend scope if needed
  const scope = post.scope === 'local' ? 'public' : post.scope;

  // 1) Hard auth gate immediately before RPC
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.user?.id) {
    throw new Error("No logged-in user in auth context (session missing when calling RPC)");
  }

  // Optional: verify auth context for logging
  try {
    const { data: userData } = await supabase.auth.getUser();
    console.log("RPC auth context user.id:", userData?.user?.id);
  } catch (e) {
    console.log("supabase.auth.getUser() error:", e);
  }

  // 2) Call RPC (do NOT rely on p_author_user_id; DB function uses auth.uid())
  let data: any = null;
  let error: any = null;
  try {
    const res = await supabase.rpc("create_post", {
      p_content: post.content,
      p_scope: scope,
      p_village_member_id: scope === "village" ? post.village_member_id ?? null : null,
      p_title: post.title,
      p_type: post.type,
      p_visibility: post.visibility,
      p_location: post.location ?? null,
      p_author_name: post.author_name ?? null,
      // p_author_user_id: removed
    });
    data = res.data;
    error = res.error;
    console.log("RPC done");
  } catch (e) {
    console.log("RPC THREW:", e);
    throw e;
  } finally {
    console.log("RPC error:", error);
    console.log("RPC data:", data);
    console.log("typeof data:", typeof data);
    console.log("isArray:", Array.isArray(data));
  }
  return { data, error };
}
