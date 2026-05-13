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
  author_id?: string;
};

export async function fetchPosts(options: FetchPostsOptions = {}): Promise<Post[]> {
  let query = supabase.from("posts").select("*");
  if (options.type) query = query.eq("type", options.type);
  if (options.scope) query = query.eq("scope", options.scope);
  if (options.visibility) query = query.eq("visibility", options.visibility);
  if (options.author_id) query = query.eq("author_id", options.author_id);
  query = query.order("created_at", { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  return data as Post[];
}
}

// Create a new post
export async function createPost(post: Omit<Post, "id" | "created_at" | "updated_at">): Promise<Post> {
  const { data, error } = await supabase
    .from("posts")
    .insert([post])
    .select()
    .single();
  if (error) throw error;
  return data as Post;
}
