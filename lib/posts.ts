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

  // 1) Hard auth gate: use getUser() to verify token is valid server-side (not just cached)
  const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!authUser?.id) {
    throw new Error("No authenticated user found (getUser returned null — session may not be restored yet)");
  }
  console.log("RPC auth context user.id:", authUser.id);

  // Also confirm local session exists (belt-and-suspenders)
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.access_token) {
    throw new Error("Session access_token missing — JWT will not be sent with RPC");
  }

  // 2) Call RPC
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
      p_author_user_id: authUser.id,
      p_photo_url: (post as any).photo_url ?? null,
    });
    data = res.data;
    error = res.error;
  } catch (e) {
    console.log("RPC THREW:", e);
    throw e;
  }
  return { data, error };
}

export type PostCommentRow = {
  id: string;
  post_id: string;
  author_user_id: string;
  body: string;
  created_at: string;
};

function isMissingRelationError(error: any): boolean {
  if (!error) return false;
  if (error.code === "42P01") return true;
  const message = String(error.message || "").toLowerCase();
  return message.includes("does not exist") || message.includes("relation");
}

export async function fetchPostInteractions(postIds: string[], currentUserId?: string) {
  if (postIds.length === 0) {
    return {
      likesCountByPost: {} as Record<string, number>,
      likedByMeByPost: {} as Record<string, boolean>,
      sharesCountByPost: {} as Record<string, number>,
      commentsByPost: {} as Record<string, PostCommentRow[]>,
    };
  }

  if (typeof window !== "undefined") {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const tokenPresent = Boolean(session?.access_token);
      const sessionUserId = session?.user?.id || null;
      console.log("[fetchPostInteractions] auth debug", {
        tokenPresent,
        sessionUserId,
        currentUserId: currentUserId || null,
        postIdsCount: postIds.length,
      });
    } catch (sessionDebugError) {
      console.log("[fetchPostInteractions] auth debug failed", sessionDebugError);
    }
  }

  const [{ data: likes, error: likesError }, { data: comments, error: commentsError }, { data: shares, error: sharesError }] = await Promise.all([
    supabase.from("post_likes").select("post_id,user_id").in("post_id", postIds),
    supabase.from("post_comments").select("id,post_id,author_user_id,body,created_at").in("post_id", postIds).order("created_at", { ascending: true }),
    supabase.from("post_shares").select("post_id,user_id").in("post_id", postIds),
  ]);

  if (likesError && !isMissingRelationError(likesError)) throw likesError;
  if (sharesError && !isMissingRelationError(sharesError)) throw sharesError;

  let normalizedComments: PostCommentRow[] = (comments || []) as PostCommentRow[];
  if (commentsError) {
    const message = String(commentsError.message || "").toLowerCase();
    const missingNewColumns =
      commentsError.code === "42703" ||
      message.includes("author_user_id") ||
      message.includes("body") ||
      message.includes("column");

    if (missingNewColumns) {
      const { data: legacyComments, error: legacyCommentsError } = await supabase
        .from("post_comments")
        .select("id,post_id,user_id,content,created_at")
        .in("post_id", postIds)
        .order("created_at", { ascending: true });

      if (legacyCommentsError) {
        throw legacyCommentsError;
      }

      normalizedComments = (legacyComments || []).map((comment: any) => ({
        id: comment.id,
        post_id: comment.post_id,
        author_user_id: comment.user_id,
        body: comment.content,
        created_at: comment.created_at,
      }));
    } else {
      throw commentsError;
    }
  }

  const likesCountByPost: Record<string, number> = {};
  const likedByMeByPost: Record<string, boolean> = {};
  ((likesError ? [] : likes) || []).forEach((like: any) => {
    likesCountByPost[like.post_id] = (likesCountByPost[like.post_id] || 0) + 1;
    if (currentUserId && like.user_id === currentUserId) {
      likedByMeByPost[like.post_id] = true;
    }
  });

  const sharesCountByPost: Record<string, number> = {};
  ((sharesError ? [] : shares) || []).forEach((share: any) => {
    sharesCountByPost[share.post_id] = (sharesCountByPost[share.post_id] || 0) + 1;
  });

  const commentsByPost: Record<string, PostCommentRow[]> = {};
  (normalizedComments || []).forEach((comment: any) => {
    if (!commentsByPost[comment.post_id]) commentsByPost[comment.post_id] = [];
    commentsByPost[comment.post_id].push(comment as PostCommentRow);
  });

  return { likesCountByPost, likedByMeByPost, sharesCountByPost, commentsByPost };
}

export async function togglePostLike(postId: string, userId: string, currentlyLiked: boolean): Promise<void> {
  if (currentlyLiked) {
    const { error } = await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("post_likes")
    .upsert({ post_id: postId, user_id: userId }, { onConflict: "post_id,user_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function addPostComment(postId: string, userId: string, content: string): Promise<void> {
  const trimmed = content.trim();
  if (!trimmed) return;
  const { error } = await supabase.from("post_comments").insert({ post_id: postId, author_user_id: userId, body: trimmed });
  if (error) throw error;
}

export async function sharePost(postId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("post_shares")
    .upsert({ post_id: postId, user_id: userId }, { onConflict: "post_id,user_id", ignoreDuplicates: true });
  if (error) throw error;
}
