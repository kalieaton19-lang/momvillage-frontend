"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import {
  fetchPosts,
  fetchPostInteractions,
  togglePostLike,
  addPostComment,
  sharePost,
  PostCommentRow,
} from "../../lib/posts";
import type { Post } from "../../types/post";

interface UserProfile {
  id?: string;
  user_id?: string;
  full_name?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  number_of_kids?: number;
  kids_age_groups?: string[];
  preferred_language?: string;
  parenting_style?: string;
  other_info?: string;
  profile_photo_url?: string;
  created_at?: string;
  updated_at?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile>({
    full_name: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    number_of_kids: 0,
    kids_age_groups: [],
    preferred_language: "",
    parenting_style: "",
    other_info: "",
  });
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsCount, setPostsCount] = useState<number>(0);
  const [villageCount, setVillageCount] = useState<number>(0);
  const [commentsByPost, setCommentsByPost] = useState<
    Record<string, PostCommentRow[]>
  >({});
  const [authorPhotoById, setAuthorPhotoById] = useState<
    Record<string, string>
  >({});
  const [authorNameById, setAuthorNameById] = useState<Record<string, string>>(
    {},
  );
  const [likesCountByPost, setLikesCountByPost] = useState<
    Record<string, number>
  >({});
  const [likedByMeByPost, setLikedByMeByPost] = useState<
    Record<string, boolean>
  >({});
  const [sharesCountByPost, setSharesCountByPost] = useState<
    Record<string, number>
  >({});
  const [commentDraftByPost, setCommentDraftByPost] = useState<
    Record<string, string>
  >({});
  const [interactionBusyByPost, setInteractionBusyByPost] = useState<
    Record<string, boolean>
  >({});
  const [openPostMenuId, setOpenPostMenuId] = useState<string | null>(null);
  const [openCommentMenuId, setOpenCommentMenuId] = useState<string | null>(
    null,
  );
  const [expandedCommentsByPost, setExpandedCommentsByPost] = useState<
    Record<string, boolean>
  >({});
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentDraft, setEditingCommentDraft] = useState<string>("");

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadMyPosts(user.id);
    }
  }, [user?.id]);

  async function loadVillageCount(userId: string) {
    try {
      const { data } = await supabase
        .from("village_invitations")
        .select("id")
        .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
        .eq("status", "accepted");
      setVillageCount(data?.length ?? 0);
    } catch {
      setVillageCount(0);
    }
  }

  async function checkUser() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      console.log("Session:", session);

      if (!session) {
        router.push("/login");
        return;
      }

      setUser(session.user);
      await loadUserProfile();
      await loadVillageCount(session.user.id);
    } catch (error) {
      console.error("Error checking user:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  async function loadUserProfile() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.user_metadata) {
        console.log("Loaded user metadata:", user.user_metadata);
        setProfile({
          full_name: user.user_metadata.full_name || "",
          phone: user.user_metadata.phone || "",
          address: user.user_metadata.address || "",
          city: user.user_metadata.city || "",
          state: user.user_metadata.state || "",
          zip_code: user.user_metadata.zip_code || "",
          number_of_kids: user.user_metadata.number_of_kids || 0,
          kids_age_groups: user.user_metadata.kids_age_groups || [],
          preferred_language: user.user_metadata.preferred_language || "",
          parenting_style: user.user_metadata.parenting_style || "",
          other_info: user.user_metadata.other_info || "",
          profile_photo_url: user.user_metadata.profile_photo_url || "",
        });
      }
    } catch (error) {
      console.error("Error in loadUserProfile:", error);
    }
  }

  async function loadMyPosts(userId: string) {
    try {
      const myPosts = await fetchPosts({ author_user_id: userId });
      setPosts(myPosts);
      setPostsCount(myPosts.length);

      const authorIds = [
        ...new Set(myPosts.map((post) => post.author_user_id).filter(Boolean)),
      ];
      if (authorIds.length > 0) {
        const { data: authorProfiles } = await supabase
          .from("user_public_profiles")
          .select("id, full_name, profile_photo_url")
          .in("id", authorIds);

        const photoMap: Record<string, string> = {};
        const nameMap: Record<string, string> = {};
        (authorProfiles || []).forEach((entry: any) => {
          if (entry?.id && entry?.profile_photo_url)
            photoMap[entry.id] = entry.profile_photo_url;
          if (entry?.id && entry?.full_name)
            nameMap[entry.id] = entry.full_name;
        });
        setAuthorPhotoById(photoMap);
        setAuthorNameById(nameMap);
      } else {
        setAuthorPhotoById({});
        setAuthorNameById({});
      }

      const postIds = myPosts.map((post) => post.id);
      if (postIds.length === 0) {
        setLikesCountByPost({});
        setLikedByMeByPost({});
        setSharesCountByPost({});
        setCommentsByPost({});
        return;
      }

      const interactions = await fetchPostInteractions(postIds, userId);
      setLikesCountByPost(interactions.likesCountByPost);
      setLikedByMeByPost(interactions.likedByMeByPost);
      setSharesCountByPost(interactions.sharesCountByPost);
      setCommentsByPost(interactions.commentsByPost);

      const unknownCommenterIds = [
        ...new Set(
          Object.values(interactions.commentsByPost)
            .flat()
            .map((comment) => comment.author_user_id)
            .filter((authorId) => authorId && !authorIds.includes(authorId)),
        ),
      ];

      if (unknownCommenterIds.length > 0) {
        const { data: commentProfiles } = await supabase
          .from("user_public_profiles")
          .select("id, full_name, profile_photo_url")
          .in("id", unknownCommenterIds);
        if (commentProfiles) {
          setAuthorPhotoById((prev) => {
            const updated = { ...prev };
            commentProfiles.forEach((entry: any) => {
              if (entry?.id && entry?.profile_photo_url)
                updated[entry.id] = entry.profile_photo_url;
            });
            return updated;
          });
          setAuthorNameById((prev) => {
            const updated = { ...prev };
            commentProfiles.forEach((entry: any) => {
              if (entry?.id && entry?.full_name)
                updated[entry.id] = entry.full_name;
            });
            return updated;
          });
        }
      }
    } catch (loadPostsError) {
      console.error("Error loading profile posts:", loadPostsError);
      setPosts([]);
      setPostsCount(0);
      setLikesCountByPost({});
      setLikedByMeByPost({});
      setSharesCountByPost({});
      setCommentsByPost({});
    }
  }

  async function handleToggleLike(postId: string) {
    if (!user?.id) return;
    const currentlyLiked = !!likedByMeByPost[postId];
    setInteractionBusyByPost((prev) => ({ ...prev, [postId]: true }));
    try {
      await togglePostLike(postId, user.id, currentlyLiked);
      setLikedByMeByPost((prev) => ({ ...prev, [postId]: !currentlyLiked }));
      setLikesCountByPost((prev) => ({
        ...prev,
        [postId]: Math.max(0, (prev[postId] || 0) + (currentlyLiked ? -1 : 1)),
      }));
    } catch (e: any) {
      const maybeCode = e?.code ? ` (${e.code})` : "";
      alert(`Like failed${maybeCode}: ${e?.message || "Unknown error"}`);
    } finally {
      setInteractionBusyByPost((prev) => ({ ...prev, [postId]: false }));
    }
  }

  async function handleAddComment(postId: string) {
    if (!user?.id) return;
    const targetPost = posts.find((post) => post.id === postId);
    if (targetPost?.comments_disabled) {
      alert("Comments are disabled for this post.");
      return;
    }
    const draft = (commentDraftByPost[postId] || "").trim();
    if (!draft) return;
    setInteractionBusyByPost((prev) => ({ ...prev, [postId]: true }));
    try {
      await addPostComment(postId, user.id, draft);
      const newComment: PostCommentRow = {
        id: `${Date.now()}`,
        post_id: postId,
        author_user_id: user.id,
        body: draft,
        created_at: new Date().toISOString(),
      };
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newComment],
      }));
      setCommentDraftByPost((prev) => ({ ...prev, [postId]: "" }));
    } catch (e: any) {
      const maybeCode = e?.code ? ` (${e.code})` : "";
      alert(`Comment failed${maybeCode}: ${e?.message || "Unknown error"}`);
    } finally {
      setInteractionBusyByPost((prev) => ({ ...prev, [postId]: false }));
    }
  }

  async function handleShare(post: Post) {
    if (!user?.id) return;
    if (post.visibility !== "public") {
      alert("Only public posts can be shared.");
      return;
    }
    setInteractionBusyByPost((prev) => ({ ...prev, [post.id]: true }));
    try {
      await sharePost(post.id, user.id);
      setSharesCountByPost((prev) => ({
        ...prev,
        [post.id]: (prev[post.id] || 0) + 1,
      }));
      alert("Shared!");
    } catch (e: any) {
      const maybeCode = e?.code ? ` (${e.code})` : "";
      alert(`Share failed${maybeCode}: ${e?.message || "Unknown error"}`);
    } finally {
      setInteractionBusyByPost((prev) => ({ ...prev, [post.id]: false }));
    }
  }

  function handleStartEditComment(comment: PostCommentRow) {
    setEditingCommentId(comment.id);
    setEditingCommentDraft(comment.body);
    setOpenCommentMenuId(null);
  }

  function handleCancelEditComment() {
    setEditingCommentId(null);
    setEditingCommentDraft("");
  }

  async function handleSaveCommentEdit(post: Post, comment: PostCommentRow) {
    if (!user?.id) return;
    const trimmed = editingCommentDraft.trim();
    if (!trimmed) {
      alert("Comment can't be empty.");
      return;
    }
    setInteractionBusyByPost((prev) => ({ ...prev, [post.id]: true }));
    try {
      const { error } = await supabase
        .from("post_comments")
        .update({ body: trimmed })
        .eq("id", comment.id)
        .eq("author_user_id", user.id);
      if (error) throw error;

      setCommentsByPost((prev) => ({
        ...prev,
        [post.id]: (prev[post.id] || []).map((entry) =>
          entry.id === comment.id ? { ...entry, body: trimmed } : entry,
        ),
      }));
      handleCancelEditComment();
    } catch (e: any) {
      const maybeCode = e?.code ? ` (${e.code})` : "";
      alert(
        `Edit comment failed${maybeCode}: ${e?.message || "Unknown error"}`,
      );
    } finally {
      setInteractionBusyByPost((prev) => ({ ...prev, [post.id]: false }));
    }
  }

  async function handleDeleteComment(post: Post, comment: PostCommentRow) {
    if (!user?.id) return;
    const canDelete =
      user.id === comment.author_user_id || user.id === post.author_user_id;
    if (!canDelete) return;

    const confirmed = window.confirm(
      "Delete this comment? This cannot be undone.",
    );
    if (!confirmed) return;

    setInteractionBusyByPost((prev) => ({ ...prev, [post.id]: true }));
    try {
      const { error } = await supabase
        .from("post_comments")
        .delete()
        .eq("id", comment.id);
      if (error) throw error;

      if (editingCommentId === comment.id) {
        handleCancelEditComment();
      }
      setOpenCommentMenuId(null);

      setCommentsByPost((prev) => ({
        ...prev,
        [post.id]: (prev[post.id] || []).filter(
          (entry) => entry.id !== comment.id,
        ),
      }));
    } catch (e: any) {
      const maybeCode = e?.code ? ` (${e.code})` : "";
      alert(
        `Delete comment failed${maybeCode}: ${e?.message || "Unknown error"}`,
      );
    } finally {
      setInteractionBusyByPost((prev) => ({ ...prev, [post.id]: false }));
    }
  }

  async function handleDeletePost(postId: string) {
    if (!user?.id) return;
    const confirmed = window.confirm(
      "Delete this post? This cannot be undone.",
    );
    if (!confirmed) return;
    setInteractionBusyByPost((prev) => ({ ...prev, [postId]: true }));
    try {
      const { error } = await supabase.from("posts").delete().eq("id", postId);
      if (error) throw error;
      setPosts((prev) => prev.filter((post) => post.id !== postId));
      setCommentsByPost((prev) => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
      setLikesCountByPost((prev) => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
      setSharesCountByPost((prev) => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
      setOpenPostMenuId(null);
      setPostsCount((prev) => Math.max(0, prev - 1));
    } catch (e: any) {
      alert("Delete failed: " + (e?.message || "Unknown error"));
    } finally {
      setInteractionBusyByPost((prev) => ({ ...prev, [postId]: false }));
    }
  }

  async function handleToggleCommentsDisabled(post: Post) {
    if (!user?.id) return;
    const nextValue = !post.comments_disabled;
    setInteractionBusyByPost((prev) => ({ ...prev, [post.id]: true }));
    try {
      const { data: updatedRows, error } = await supabase
        .from("posts")
        .update({ comments_disabled: nextValue })
        .eq("id", post.id)
        .eq("author_user_id", user.id)
        .select("id");
      if (error) throw error;
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error("Not allowed to update this post.");
      }
      setPosts((prev) =>
        prev.map((entry) =>
          entry.id === post.id
            ? { ...entry, comments_disabled: nextValue }
            : entry,
        ),
      );
      setOpenPostMenuId(null);
    } catch (e: any) {
      const maybeCode = e?.code ? ` (${e.code})` : "";
      alert(`Update failed${maybeCode}: ${e?.message || "Unknown error"}`);
    } finally {
      setInteractionBusyByPost((prev) => ({ ...prev, [post.id]: false }));
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return <div className="p-8 text-center">Loading profile...</div>;
  }

  return (
    <div className="min-h-screen bg-pink-50 dark:bg-pink-950 p-0 sm:p-4">
      <div className="w-full max-w-2xl mx-auto flex items-center pt-4 pb-2 px-2 sm:px-0">
        <button
          onClick={() => router.push("/home")}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full p-2 shadow hover:bg-pink-50 dark:hover:bg-pink-800 transition focus:outline-none focus:ring-2 focus:ring-pink-400"
          aria-label="Back to Home"
        >
          <svg
            width="24"
            height="24"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            className="text-pink-600"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      <div className="w-full max-w-2xl mx-auto">
        <div className="w-full flex flex-row items-stretch gap-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 sm:px-10 pt-6 pb-4">
          {profile.profile_photo_url ? (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-pink-400 shadow flex-shrink-0">
              <img
                src={profile.profile_photo_url}
                alt={profile.full_name || "Profile"}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white text-2xl sm:text-3xl font-bold border-2 border-pink-400 shadow flex-shrink-0">
              {profile.full_name?.[0]?.toUpperCase() ||
                user?.email?.[0]?.toUpperCase() ||
                "?"}
            </div>
          )}

          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <span className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-zinc-50 truncate w-full text-left">
              {profile.full_name || "My Profile"}
            </span>
            <div className="flex flex-row items-center gap-8 mt-1 mb-2 w-full">
              <div className="flex flex-col items-center">
                <span className="text-2xl sm:text-3xl font-extrabold text-pink-600 leading-none text-center">
                  {villageCount}
                </span>
                <span className="text-[10px] font-medium text-pink-700 uppercase tracking-wide mt-0.5 text-center">
                  Village
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-2xl sm:text-3xl font-extrabold text-pink-300 leading-none text-center">
                  {postsCount}
                </span>
                <span className="text-[10px] font-medium text-pink-400 uppercase tracking-wide mt-0.5 text-center">
                  Posts
                </span>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              {profile.city && (
                <span>
                  Location:{" "}
                  <span className="font-medium text-zinc-700 dark:text-zinc-200">
                    {profile.city}
                    {profile.state ? `, ${profile.state}` : ""}
                  </span>
                </span>
              )}
              {profile.number_of_kids !== undefined &&
                profile.number_of_kids !== null &&
                profile.number_of_kids !== 0 && (
                  <span>
                    Children:{" "}
                    <span className="font-medium text-zinc-700 dark:text-zinc-200">
                      {profile.number_of_kids}
                    </span>
                  </span>
                )}
              {profile.kids_age_groups && profile.kids_age_groups.length > 0 && (
                <span>
                  Ages:{" "}
                  <span className="font-medium text-zinc-700 dark:text-zinc-200">
                    {Array.isArray(profile.kids_age_groups)
                      ? profile.kids_age_groups.join(", ")
                      : String(profile.kids_age_groups)}
                  </span>
                </span>
              )}
              {profile.parenting_style && (
                <span>
                  Parenting Style:{" "}
                  <span className="font-medium text-zinc-700 dark:text-zinc-200">
                    {profile.parenting_style}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-row justify-center items-center gap-3 mt-3 mb-2">
          <button
            onClick={() => router.push("/edit-profile")}
            className="px-4 py-2 bg-pink-100 hover:bg-pink-200 text-pink-700 border border-pink-500 rounded-lg font-semibold text-base transition-colors whitespace-nowrap dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700 dark:hover:bg-pink-900/45"
          >
            Edit Profile
          </button>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg font-semibold text-base transition-colors whitespace-nowrap"
          >
            Sign Out
          </button>
        </div>

        <div className="w-full flex flex-col gap-4 py-8">
          {posts.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl shadow-sm w-full max-w-2xl mx-auto p-6 flex flex-col items-center justify-center">
              <div className="text-zinc-400 italic">(Your posts will appear here)</div>
            </div>
          ) : (
            <div className="w-full max-w-2xl mx-auto grid gap-4">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className={`border rounded-xl p-4 shadow-sm ${post.type === "support" ? "bg-pink-50 border-pink-300 ring-2 ring-pink-200/70 dark:bg-pink-950/20 dark:border-pink-700 dark:ring-pink-800/70" : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"}`}
                >
                  {post.type === "support" && (
                    <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full bg-pink-100 text-pink-800 border border-pink-300 text-xs font-semibold dark:bg-pink-900/40 dark:text-pink-200 dark:border-pink-700">
                      <span>🆘</span>
                      <span>Support Post • Asking for Help</span>
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {authorPhotoById[post.author_user_id] ? (
                        <img
                          src={authorPhotoById[post.author_user_id]}
                          alt={post.author_name || "Mom"}
                          className="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 text-white flex items-center justify-center font-semibold border border-pink-300">
                          {(post.author_name || "M").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-50 truncate">
                          {post.author_name || "Mom"}
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {new Date(post.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {user?.id === post.author_user_id && (
                      <div className="relative">
                        <button
                          type="button"
                          aria-label="Post actions"
                          onClick={() =>
                            setOpenPostMenuId((prev) =>
                              prev === post.id ? null : post.id,
                            )
                          }
                          className="w-8 h-8 rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center"
                        >
                          ⋯
                        </button>
                        {openPostMenuId === post.id && (
                          <div className="absolute right-0 mt-2 z-20 w-44 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden">
                            <button
                              type="button"
                              onClick={() => handleToggleCommentsDisabled(post)}
                              className="w-full text-left px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                            >
                              {post.comments_disabled
                                ? "Enable comments"
                                : "Disable comments"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePost(post.id)}
                              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              Delete post
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {post.photo_url && (
                    <img
                      src={post.photo_url}
                      alt="Post photo"
                      className="w-full rounded-xl object-cover max-h-72 mb-3 border border-zinc-100 dark:border-zinc-800"
                    />
                  )}

                  <div className="font-bold text-lg mb-1 text-zinc-900 dark:text-zinc-50">
                    {post.title}
                  </div>
                  <div className="text-zinc-700 dark:text-zinc-200 whitespace-pre-line">
                    {post.content}
                  </div>

                  <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-3 text-sm">
                    <button
                      type="button"
                      disabled={!!interactionBusyByPost[post.id]}
                      onClick={() => handleToggleLike(post.id)}
                      className={`px-3 py-1 rounded-full border transition ${likedByMeByPost[post.id] ? "bg-pink-100 text-pink-700 border-pink-500 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700" : "bg-white text-zinc-700 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700"}`}
                    >
                      {likedByMeByPost[post.id] ? "♥" : "♡"} Like{" "}
                      {likesCountByPost[post.id] || 0}
                    </button>
                    {post.visibility === "public" && (
                      <button
                        type="button"
                        disabled={!!interactionBusyByPost[post.id]}
                        onClick={() => handleShare(post)}
                        className="px-3 py-1 rounded-full border bg-white text-zinc-700 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700"
                      >
                        ↗ Share {sharesCountByPost[post.id] || 0}
                      </button>
                    )}
                  </div>

                  <div className="mt-3 space-y-2">
                    {post.comments_disabled ? null : (
                      <>
                        {(() => {
                          const allComments = commentsByPost[post.id] || [];
                          const isExpanded = !!expandedCommentsByPost[post.id];
                          const visibleComments = isExpanded
                            ? allComments
                            : allComments.slice(0, 2);
                          const hiddenCount = Math.max(
                            0,
                            allComments.length - visibleComments.length,
                          );

                          return (
                            <>
                              {visibleComments.map((comment) => {
                                const isEditing =
                                  editingCommentId === comment.id;
                                const commentName =
                                  authorNameById[comment.author_user_id] ||
                                  (comment.author_user_id === user?.id
                                    ? profile.full_name || "You"
                                    : "Mom");
                                return (
                                  <div
                                    key={comment.id}
                                    className="flex gap-3 text-sm bg-zinc-50 dark:bg-zinc-800/60 rounded-lg px-3 py-3 border border-zinc-200 dark:border-zinc-700"
                                  >
                                    <div className="shrink-0">
                                      {authorPhotoById[
                                        comment.author_user_id
                                      ] ? (
                                        <img
                                          src={
                                            authorPhotoById[
                                              comment.author_user_id
                                            ]
                                          }
                                          alt={commentName}
                                          className="w-9 h-9 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                                        />
                                      ) : (
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 text-white flex items-center justify-center font-semibold border border-pink-300">
                                          {commentName.charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-start justify-between gap-3">
                                        <span className="font-semibold text-zinc-800 dark:text-zinc-100 truncate">
                                          {commentName}
                                        </span>
                                        <div className="relative shrink-0">
                                          <button
                                            type="button"
                                            aria-label="Comment actions"
                                            onClick={() =>
                                              setOpenCommentMenuId((prev) =>
                                                prev === comment.id
                                                  ? null
                                                  : comment.id,
                                              )
                                            }
                                            className="w-7 h-7 rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center"
                                          >
                                            ⋯
                                          </button>
                                          {openCommentMenuId === comment.id && (
                                            <div className="absolute right-0 mt-2 z-30 w-36 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden">
                                              {comment.author_user_id ===
                                                user?.id && (
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleStartEditComment(
                                                      comment,
                                                    )
                                                  }
                                                  className="w-full text-left px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                                >
                                                  Edit
                                                </button>
                                              )}
                                              {(user?.id ===
                                                comment.author_user_id ||
                                                user?.id ===
                                                  post.author_user_id) && (
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleDeleteComment(
                                                      post,
                                                      comment,
                                                    )
                                                  }
                                                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                >
                                                  Delete
                                                </button>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {isEditing ? (
                                        <div className="mt-2 space-y-2">
                                          <textarea
                                            value={editingCommentDraft}
                                            onChange={(e) =>
                                              setEditingCommentDraft(
                                                e.target.value,
                                              )
                                            }
                                            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm min-h-[84px]"
                                          />
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleSaveCommentEdit(
                                                  post,
                                                  comment,
                                                )
                                              }
                                              disabled={
                                                !!interactionBusyByPost[post.id]
                                              }
                                              className="px-3 py-2 rounded-lg bg-pink-100 text-pink-700 border border-pink-500 text-sm font-semibold hover:bg-pink-200 disabled:opacity-60 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700 dark:hover:bg-pink-900/45"
                                            >
                                              Save
                                            </button>
                                            <button
                                              type="button"
                                              onClick={handleCancelEditComment}
                                              disabled={
                                                !!interactionBusyByPost[post.id]
                                              }
                                              className="px-3 py-2 rounded-lg border bg-white text-zinc-700 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700 text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-60"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-zinc-700 dark:text-zinc-200 mt-1 whitespace-pre-line">
                                          {comment.body}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                              {hiddenCount > 0 && !isExpanded && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedCommentsByPost((prev) => ({
                                      ...prev,
                                      [post.id]: true,
                                    }))
                                  }
                                  className="text-sm font-semibold text-pink-600 hover:text-pink-700 px-1"
                                >
                                  {hiddenCount} more comments
                                </button>
                              )}

                              {isExpanded && allComments.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedCommentsByPost((prev) => ({
                                      ...prev,
                                      [post.id]: false,
                                    }))
                                  }
                                  className="text-sm font-semibold text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 px-1"
                                >
                                  Show fewer comments
                                </button>
                              )}
                            </>
                          );
                        })()}
                        <form
                          className="flex items-center gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            handleAddComment(post.id);
                          }}
                        >
                          <input
                            type="text"
                            value={commentDraftByPost[post.id] || ""}
                            onChange={(event) =>
                              setCommentDraftByPost((prev) => ({
                                ...prev,
                                [post.id]: event.target.value,
                              }))
                            }
                            placeholder="Write a comment..."
                            className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm"
                          />
                          <button
                            type="submit"
                            disabled={
                              !!interactionBusyByPost[post.id] ||
                              !(commentDraftByPost[post.id] || "").trim()
                            }
                            className="px-3 py-2 rounded-lg bg-pink-100 text-pink-700 border border-pink-500 text-sm font-semibold hover:bg-pink-200 disabled:opacity-60 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700 dark:hover:bg-pink-900/45"
                          >
                            Comment
                          </button>
                        </form>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
