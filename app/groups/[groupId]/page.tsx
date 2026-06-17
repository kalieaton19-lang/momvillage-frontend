"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PostContentWithPreview from "../../components/PostContentWithPreview";
import PostShareSheet from "../../components/PostShareSheet";
import { supabase } from "../../../lib/supabase";
import { addPostComment, fetchPostInteractions, PostCommentRow, sharePost, togglePostLike } from "../../../lib/posts";
import { Post } from "../../../types/post";

type GroupRow = {
  id: string;
  name: string;
  bio?: string | null;
  visibility: "open" | "by_permission";
  creator_user_id: string;
  created_at: string;
};

function isMissingGroupIdColumnError(error: any) {
  return (
    error?.code === "42703" ||
    String(error?.message || "").toLowerCase().includes("group_id")
  );
}

export default function GroupDetailPage() {
  const router = useRouter();
  const params = useParams<{ groupId: string }>();
  const groupId = params?.groupId;

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [group, setGroup] = useState<GroupRow | null>(null);
  const [groupPosts, setGroupPosts] = useState<Post[]>([]);
  const [groupPostsLoading, setGroupPostsLoading] = useState(false);
  const [groupPostMessage, setGroupPostMessage] = useState("");
  const [showGroupPostForm, setShowGroupPostForm] = useState(false);
  const [groupPostTitle, setGroupPostTitle] = useState("");
  const [groupPostContent, setGroupPostContent] = useState("");
  const [creatingGroupPost, setCreatingGroupPost] = useState(false);
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [updatingMembership, setUpdatingMembership] = useState(false);
  const [membershipStatus, setMembershipStatus] = useState<"pending" | "approved" | null>(null);
  const [authorPhotoById, setAuthorPhotoById] = useState<Record<string, string>>({});
  const [authorNameById, setAuthorNameById] = useState<Record<string, string>>({});
  const [likesCountByPost, setLikesCountByPost] = useState<Record<string, number>>({});
  const [likedByMeByPost, setLikedByMeByPost] = useState<Record<string, boolean>>({});
  const [sharesCountByPost, setSharesCountByPost] = useState<Record<string, number>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostCommentRow[]>>({});
  const [commentDraftByPost, setCommentDraftByPost] = useState<Record<string, string>>({});
  const [interactionBusyByPost, setInteractionBusyByPost] = useState<Record<string, boolean>>({});
  const [openPostMenuId, setOpenPostMenuId] = useState<string | null>(null);
  const [openCommentMenuId, setOpenCommentMenuId] = useState<string | null>(null);
  const [expandedCommentsByPost, setExpandedCommentsByPost] = useState<Record<string, boolean>>({});
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentDraft, setEditingCommentDraft] = useState<string>("");
  const [shareSheetPost, setShareSheetPost] = useState<Post | null>(null);

  useEffect(() => {
    void initialize();
  }, [groupId]);

  const isPrivateGroup = group?.visibility === "by_permission";
  const isGroupCreator = group?.creator_user_id === user?.id;
  const canCreateGroupPosts = !isPrivateGroup || membershipStatus === "approved" || isGroupCreator;
  const groupMembershipLabel = isGroupCreator
    ? "Creator"
    : membershipStatus === "approved"
      ? "Member"
      : membershipStatus === "pending"
        ? "Pending Approval"
        : "Not a Member";

  function getProfileHref(authorUserId?: string | null) {
    if (!authorUserId) return null;
    return authorUserId === user?.id ? "/profile" : `/profile/${authorUserId}`;
  }

  async function initialize() {
    if (!groupId) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      setUser(session.user);

      const { data: { user: authUser } } = await supabase.auth.getUser();
      setProfile(authUser?.user_metadata || null);

      const loadedGroup = await loadGroup(groupId);
      const loadedMembership = await loadMembership(groupId, session.user.id);
      await loadGroupPosts(groupId, loadedGroup, loadedMembership);
    } finally {
      setLoading(false);
    }
  }

  async function loadGroup(id: string): Promise<GroupRow | null> {
    const initial = await supabase
      .from("groups")
      .select("id,name,bio,visibility,creator_user_id,created_at")
      .eq("id", id)
      .single();

    if (initial.error) {
      const missingBio = initial.error.code === "42703" || String(initial.error.message || "").toLowerCase().includes("bio");
      if (missingBio) {
        const fallback = await supabase
          .from("groups")
          .select("id,name,visibility,creator_user_id,created_at")
          .eq("id", id)
          .single();
        if (fallback.error) throw fallback.error;
        const fallbackGroup = { ...(fallback.data as GroupRow), bio: null };
        setGroup(fallbackGroup);
        return fallbackGroup;
      }
      throw initial.error;
    }

    const loadedGroup = (initial.data as GroupRow) || null;
    setGroup(loadedGroup);
    return loadedGroup;
  }

  async function loadMembership(id: string, userId: string): Promise<"pending" | "approved" | null> {
    const { data } = await supabase
      .from("group_members")
      .select("status")
      .eq("group_id", id)
      .eq("user_id", userId)
      .maybeSingle();

    const status = (data?.status as "pending" | "approved" | undefined) || null;
    setMembershipStatus(status);
    return status;
  }

  async function loadGroupPosts(
    id: string,
    groupOverride?: GroupRow | null,
    membershipOverride?: "pending" | "approved" | null,
  ) {
    setGroupPostsLoading(true);
    setGroupPostMessage("");
    try {
      const effectiveGroup = groupOverride !== undefined ? groupOverride : group;
      const effectiveMembership = membershipOverride !== undefined ? membershipOverride : membershipStatus;
      const isPrivate = effectiveGroup?.visibility === "by_permission";
      const isCreator = effectiveGroup?.creator_user_id === user?.id;
      const canViewPrivatePosts = !isPrivate || isCreator || effectiveMembership === "approved";
      if (!canViewPrivatePosts) {
        setGroupPosts([]);
        setGroupPostMessage("Join this group to view posts.");
        return;
      }

      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("group_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const nextPosts = (data || []) as Post[];
      setGroupPosts(nextPosts);

      try {
        const authorIds = [...new Set(nextPosts.map((post) => post.author_user_id).filter(Boolean))];
        if (authorIds.length === 0) {
          setAuthorPhotoById({});
          setAuthorNameById({});
        } else {
          const { data: authorProfiles } = await supabase
            .from("user_public_profiles")
            .select("id, profile_photo_url, full_name")
            .in("id", authorIds);

          const authorPhotoMap: Record<string, string> = {};
          const authorNameMap: Record<string, string> = {};
          (authorProfiles || []).forEach((entry: any) => {
            if (entry?.id && entry?.profile_photo_url) {
              authorPhotoMap[entry.id] = entry.profile_photo_url;
            }
            if (entry?.id && entry?.full_name) {
              authorNameMap[entry.id] = entry.full_name;
            }
          });
          setAuthorPhotoById(authorPhotoMap);
          setAuthorNameById(authorNameMap);
        }
      } catch {
        setAuthorPhotoById({});
        setAuthorNameById({});
      }

      try {
        const postIds = nextPosts.map((post) => post.id);
        const interactions = await fetchPostInteractions(postIds, user?.id);
        setLikesCountByPost(interactions.likesCountByPost);
        setLikedByMeByPost(interactions.likedByMeByPost);
        setSharesCountByPost(interactions.sharesCountByPost);
        setCommentsByPost(interactions.commentsByPost);

        const allComments = Object.values(interactions.commentsByPost).flat() as PostCommentRow[];
        const knownIds = new Set([...nextPosts.map((post) => post.author_user_id), user?.id].filter(Boolean) as string[]);
        const unknownCommentAuthorIds = [...new Set(allComments.map((comment) => comment.author_user_id).filter((entry): entry is string => !!entry && !knownIds.has(entry)))];
        if (unknownCommentAuthorIds.length > 0) {
          const { data: commentAuthorProfiles } = await supabase
            .from("user_public_profiles")
            .select("id, full_name, profile_photo_url")
            .in("id", unknownCommentAuthorIds);
          if (commentAuthorProfiles) {
            setAuthorNameById((prev) => {
              const updated = { ...prev };
              commentAuthorProfiles.forEach((entry: any) => {
                if (entry?.id && entry?.full_name) updated[entry.id] = entry.full_name;
              });
              return updated;
            });
            setAuthorPhotoById((prev) => {
              const updated = { ...prev };
              commentAuthorProfiles.forEach((entry: any) => {
                if (entry?.id && entry?.profile_photo_url) updated[entry.id] = entry.profile_photo_url;
              });
              return updated;
            });
          }
        }
      } catch {
        setLikesCountByPost({});
        setLikedByMeByPost({});
        setSharesCountByPost({});
        setCommentsByPost({});
      }
    } catch (error) {
      setGroupPosts([]);
      setAuthorPhotoById({});
      setAuthorNameById({});
      setLikesCountByPost({});
      setLikedByMeByPost({});
      setSharesCountByPost({});
      setCommentsByPost({});
      if (isMissingGroupIdColumnError(error)) {
        setGroupPostMessage("Group posts require migration 016 (posts.group_id). Please run it in Supabase.");
      } else {
        setGroupPostMessage("Could not load posts for this group.");
      }
    } finally {
      setGroupPostsLoading(false);
    }
  }

  async function handleRequestAccess() {
    if (!user?.id || !groupId) return;
    setRequestingAccess(true);
    setGroupPostMessage("");
    try {
      const { error } = await supabase.from("group_members").insert({
        group_id: groupId,
        user_id: user.id,
        status: "pending",
      });

      if (error && error.code !== "23505") throw error;
      setMembershipStatus("pending");
      setGroupPostMessage("Access request sent.");
    } catch {
      setGroupPostMessage("Could not request access.");
    } finally {
      setRequestingAccess(false);
    }
  }

  async function handleJoinOrLeaveGroup() {
    if (!user?.id || !groupId || !group) return;
    if (isGroupCreator) return;

    setUpdatingMembership(true);
    setGroupPostMessage("");
    try {
      if (membershipStatus === "approved") {
        const { error } = await supabase
          .from("group_members")
          .delete()
          .eq("group_id", groupId)
          .eq("user_id", user.id);
        if (error) throw error;
        setMembershipStatus(null);
        setShowGroupPostForm(false);
        setGroupPostMessage("You left the group.");
        await loadGroupPosts(groupId);
        return;
      }

      if (group.visibility === "by_permission") {
        await handleRequestAccess();
        return;
      }

      const { error } = await supabase
        .from("group_members")
        .upsert(
          {
            group_id: groupId,
            user_id: user.id,
            status: "approved",
          },
          { onConflict: "group_id,user_id" }
        );
      if (error) throw error;
      setMembershipStatus("approved");
      setGroupPostMessage("You joined the group.");
      await loadGroupPosts(groupId);
    } catch {
      setGroupPostMessage("Could not update membership.");
    } finally {
      setUpdatingMembership(false);
    }
  }

  async function handleCreateGroupPost() {
    if (!user?.id || !groupId) return;
    const trimmedTitle = groupPostTitle.trim();
    const trimmedContent = groupPostContent.trim();
    if (!trimmedTitle || !trimmedContent) {
      setGroupPostMessage("Title and content are required.");
      return;
    }

    setCreatingGroupPost(true);
    setGroupPostMessage("");
    try {
      const { error } = await supabase.from("posts").insert({
        author_user_id: user.id,
        author_name: profile?.full_name || "Mom",
        type: "general",
        scope: "public",
        visibility: "public",
        title: trimmedTitle,
        content: trimmedContent,
        location: profile?.city ? `${profile.city}${profile.state ? `, ${profile.state}` : ""}` : null,
        group_id: groupId,
      });

      if (error) throw error;

      setGroupPostTitle("");
      setGroupPostContent("");
      setShowGroupPostForm(false);
      setGroupPostMessage("Post created.");
      await loadGroupPosts(groupId);
    } catch (error) {
      if (isMissingGroupIdColumnError(error)) {
        setGroupPostMessage("Could not create group post: run migration 016 to add posts.group_id.");
      } else {
        setGroupPostMessage("Could not create group post.");
      }
    } finally {
      setCreatingGroupPost(false);
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
    } finally {
      setInteractionBusyByPost((prev) => ({ ...prev, [postId]: false }));
    }
  }

  async function handleShare(post: Post) {
    if (!user?.id) return;
    if (post.visibility !== "public") return;
    setShareSheetPost(post);
  }

  async function handleTrackShare(post: Post) {
    if (!user?.id) return;
    if (post.visibility !== "public") return;
    setInteractionBusyByPost((prev) => ({ ...prev, [post.id]: true }));
    try {
      await sharePost(post.id, user.id);
      setSharesCountByPost((prev) => ({ ...prev, [post.id]: (prev[post.id] || 0) + 1 }));
    } finally {
      setInteractionBusyByPost((prev) => ({ ...prev, [post.id]: false }));
    }
  }

  async function handleAddComment(postId: string) {
    if (!user?.id) return;
    const targetPost = groupPosts.find((post) => post.id === postId);
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
    } finally {
      setInteractionBusyByPost((prev) => ({ ...prev, [postId]: false }));
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
    if (!trimmed) return;
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
          entry.id === comment.id ? { ...entry, body: trimmed } : entry
        ),
      }));
      handleCancelEditComment();
    } finally {
      setInteractionBusyByPost((prev) => ({ ...prev, [post.id]: false }));
    }
  }

  async function handleDeleteComment(post: Post, comment: PostCommentRow) {
    if (!user?.id) return;
    const canDelete = user.id === comment.author_user_id || user.id === post.author_user_id;
    if (!canDelete) return;

    const confirmed = window.confirm("Delete this comment? This cannot be undone.");
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
        [post.id]: (prev[post.id] || []).filter((entry) => entry.id !== comment.id),
      }));
    } finally {
      setInteractionBusyByPost((prev) => ({ ...prev, [post.id]: false }));
    }
  }

  async function handleDeletePost(postId: string) {
    if (!user?.id) return;
    const confirmed = window.confirm("Delete this post? This cannot be undone.");
    if (!confirmed) return;
    setInteractionBusyByPost((prev) => ({ ...prev, [postId]: true }));
    try {
      const { error } = await supabase.from("posts").delete().eq("id", postId);
      if (error) throw error;
      setGroupPosts((prev) => prev.filter((post) => post.id !== postId));
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
        throw new Error("No rows updated. You may not be the owner of this post or RLS blocked the update.");
      }
      setGroupPosts((prev) => prev.map((entry) => (entry.id === post.id ? { ...entry, comments_disabled: nextValue } : entry)));
      setOpenPostMenuId(null);
    } finally {
      setInteractionBusyByPost((prev) => ({ ...prev, [post.id]: false }));
    }
  }

  if (loading) {
    return <div className="p-6 text-zinc-500">Loading group...</div>;
  }

  if (!group) {
    return <div className="p-6 text-zinc-500">Group not found.</div>;
  }

  return (
    <div className="min-h-screen bg-pink-50 dark:bg-zinc-900 p-6">
      <button
        className="inline-flex items-center justify-center w-10 h-10 mb-4 bg-white text-pink-500 border border-pink-200 rounded-full shadow hover:bg-pink-50 transition-colors dark:bg-zinc-900 dark:border-zinc-700"
        onClick={() => router.push("/home")}
        aria-label="Back"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </button>

      <div className="-mx-6 mb-4 bg-white dark:bg-zinc-900 border-y border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="w-full px-2">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 text-center">{group.name}</h1>
          <div className="text-center mt-2 mb-3">
            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-pink-100 text-pink-700 border border-pink-300 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700">
              Status: {groupMembershipLabel}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => setShowGroupPostForm((value) => !value)}
              disabled={!canCreateGroupPosts}
              className="px-4 py-2 rounded-full bg-pink-100 text-pink-700 border border-pink-400 hover:bg-pink-200 disabled:opacity-50 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700"
            >
              {showGroupPostForm ? "Cancel" : "Create Post"}
            </button>
            <button
              onClick={() => void handleJoinOrLeaveGroup()}
              disabled={isGroupCreator || updatingMembership || membershipStatus === "pending" || requestingAccess}
              className="px-4 py-2 rounded-full bg-pink-100 text-pink-700 border border-pink-400 hover:bg-pink-200 disabled:opacity-50 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700"
            >
              {isGroupCreator
                ? "Creator"
                : membershipStatus === "approved"
                  ? "Leave Group"
                  : membershipStatus === "pending"
                    ? "Pending Approval"
                    : updatingMembership
                      ? "Updating..."
                      : group.visibility === "by_permission"
                        ? "Join Group"
                        : "Join Group"}
            </button>
          </div>
        </div>
      </div>

      <div className="border rounded-xl p-4 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
        {group.bio && <div className="text-sm text-zinc-700 dark:text-zinc-200 mb-3 whitespace-pre-line">{group.bio}</div>}

        {canCreateGroupPosts && showGroupPostForm && (
          <div className="mt-3 space-y-2">
            <input
              type="text"
              value={groupPostTitle}
              onChange={(event) => setGroupPostTitle(event.target.value)}
              placeholder="Post title"
              className="w-full rounded-lg border border-pink-200 px-4 py-2 bg-pink-50 text-zinc-900 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
            />
            <textarea
              value={groupPostContent}
              onChange={(event) => setGroupPostContent(event.target.value)}
              placeholder="What do you want to share with this group?"
              rows={4}
              className="w-full rounded-lg border border-pink-200 px-4 py-2 bg-pink-50 text-zinc-900 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
            />
            <button
              onClick={() => void handleCreateGroupPost()}
              disabled={creatingGroupPost}
              className="px-4 py-2 rounded-full bg-pink-100 text-pink-700 border border-pink-400 hover:bg-pink-200 disabled:opacity-60 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700"
            >
              {creatingGroupPost ? "Posting..." : "Publish to Group"}
            </button>
          </div>
        )}

        {groupPostMessage && <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{groupPostMessage}</div>}
      </div>

      <div className="mt-4">
        <h2 className="text-lg font-semibold mb-3 text-zinc-900 dark:text-zinc-50">Posts</h2>
        {groupPostsLoading ? (
          <div className="text-sm text-zinc-500">Loading posts...</div>
        ) : groupPosts.length === 0 ? (
          <div className="text-sm text-zinc-500">No posts in this group yet.</div>
        ) : (
          groupPosts.map((post) => (
            <div
              key={post.id}
              id={`post-${post.id}`}
              className={`border rounded-xl p-4 mb-4 shadow-sm ${post.type === "support" ? "bg-pink-50 border-pink-300 ring-2 ring-pink-200/70 shadow-[0_6px_18px_rgba(244,114,182,0.22)] dark:bg-pink-950/20 dark:border-pink-700 dark:ring-pink-800/70 dark:shadow-[0_6px_18px_rgba(244,114,182,0.16)]" : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"}`}
            >
              {post.type === "support" && (
                <div className="-mx-4 -mt-4 mb-3 px-4 py-2 rounded-t-xl bg-pink-600 text-white text-xs font-semibold uppercase tracking-wide">
                  Support Post
                </div>
              )}

              <div className="flex items-start justify-between gap-3 mb-3">
                {getProfileHref(post.author_user_id) ? (
                  <Link href={getProfileHref(post.author_user_id)!} className="flex items-center gap-3 min-w-0 group w-fit max-w-full">
                    {authorPhotoById[post.author_user_id] ? (
                      <img
                        src={authorPhotoById[post.author_user_id]}
                        alt={authorNameById[post.author_user_id] || post.author_name || "Mom"}
                        className="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 text-white flex items-center justify-center font-semibold border border-pink-300">
                        {(authorNameById[post.author_user_id] || post.author_name || "M").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-50 truncate group-hover:underline">{authorNameById[post.author_user_id] || post.author_name || "Mom"}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">{new Date(post.created_at).toLocaleString()}</div>
                    </div>
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 min-w-0">
                    {authorPhotoById[post.author_user_id] ? (
                      <img
                        src={authorPhotoById[post.author_user_id]}
                        alt={authorNameById[post.author_user_id] || post.author_name || "Mom"}
                        className="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 text-white flex items-center justify-center font-semibold border border-pink-300">
                        {(authorNameById[post.author_user_id] || post.author_name || "M").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-50 truncate">{authorNameById[post.author_user_id] || post.author_name || "Mom"}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">{new Date(post.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                )}

                {user?.id === post.author_user_id && (
                  <div className="relative">
                    <button
                      type="button"
                      aria-label="Post actions"
                      onClick={() => setOpenPostMenuId((prev) => (prev === post.id ? null : post.id))}
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
                          {post.comments_disabled ? "Enable comments" : "Disable comments"}
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
                  className="w-full rounded-xl object-cover max-h-72 mb-2 border border-zinc-100 dark:border-zinc-800"
                />
              )}
              <div className="font-bold text-lg mb-1">{post.title}</div>
              <PostContentWithPreview
                text={post.content}
                className="text-zinc-700 dark:text-zinc-200 whitespace-pre-line"
              />

              <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-3 text-sm">
                <button
                  type="button"
                  disabled={!!interactionBusyByPost[post.id]}
                  onClick={() => handleToggleLike(post.id)}
                  className={`px-3 py-1 rounded-full border transition ${likedByMeByPost[post.id] ? "bg-pink-100 text-pink-700 border-pink-500 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700" : "bg-white text-zinc-700 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700"}`}
                >
                  {likedByMeByPost[post.id] ? "♥" : "♡"} Like {likesCountByPost[post.id] || 0}
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
                      const visibleComments = isExpanded ? allComments : allComments.slice(0, 2);
                      const hiddenCount = Math.max(0, allComments.length - visibleComments.length);

                      return (
                        <>
                          {visibleComments.map((comment) => {
                            const isEditing = editingCommentId === comment.id;
                            const displayName = authorNameById[comment.author_user_id] || (comment.author_user_id === user?.id ? (profile?.full_name || "You") : "Mom");
                            const commentProfileHref = getProfileHref(comment.author_user_id);

                            return (
                              <div key={comment.id} className="flex gap-3 text-sm bg-zinc-50 dark:bg-zinc-800/60 rounded-lg px-3 py-3 border border-zinc-200 dark:border-zinc-700">
                                <div className="shrink-0">
                                  {commentProfileHref ? (
                                    <Link href={commentProfileHref} className="block">
                                      {authorPhotoById[comment.author_user_id] ? (
                                        <img
                                          src={authorPhotoById[comment.author_user_id]}
                                          alt={displayName}
                                          className="w-9 h-9 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                                        />
                                      ) : (
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 text-white flex items-center justify-center font-semibold border border-pink-300">
                                          {displayName.charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                    </Link>
                                  ) : (
                                    authorPhotoById[comment.author_user_id] ? (
                                      <img
                                        src={authorPhotoById[comment.author_user_id]}
                                        alt={displayName}
                                        className="w-9 h-9 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                                      />
                                    ) : (
                                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 text-white flex items-center justify-center font-semibold border border-pink-300">
                                        {displayName.charAt(0).toUpperCase()}
                                      </div>
                                    )
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    {commentProfileHref ? (
                                      <Link href={commentProfileHref} className="font-semibold text-zinc-800 dark:text-zinc-100 truncate hover:underline">
                                        {displayName}
                                      </Link>
                                    ) : (
                                      <span className="font-semibold text-zinc-800 dark:text-zinc-100 truncate">
                                        {displayName}
                                      </span>
                                    )}
                                    <div className="relative shrink-0">
                                      <button
                                        type="button"
                                        aria-label="Comment actions"
                                        onClick={() => setOpenCommentMenuId((prev) => (prev === comment.id ? null : comment.id))}
                                        className="w-7 h-7 rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center"
                                      >
                                        ⋯
                                      </button>
                                      {openCommentMenuId === comment.id && (
                                        <div className="absolute right-0 mt-2 z-30 w-36 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden">
                                          {comment.author_user_id === user?.id && (
                                            <button
                                              type="button"
                                              onClick={() => handleStartEditComment(comment)}
                                              className="w-full text-left px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                            >
                                              Edit
                                            </button>
                                          )}
                                          {(user?.id === comment.author_user_id || user?.id === post.author_user_id) && (
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteComment(post, comment)}
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
                                        onChange={(event) => setEditingCommentDraft(event.target.value)}
                                        className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm min-h-[84px]"
                                      />
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleSaveCommentEdit(post, comment)}
                                          disabled={!!interactionBusyByPost[post.id]}
                                          className="px-3 py-2 rounded-lg bg-pink-100 text-pink-700 border border-pink-500 text-sm font-semibold hover:bg-pink-200 disabled:opacity-60 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700 dark:hover:bg-pink-900/45"
                                        >
                                          Save
                                        </button>
                                        <button
                                          type="button"
                                          onClick={handleCancelEditComment}
                                          disabled={!!interactionBusyByPost[post.id]}
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
                              onClick={() => setExpandedCommentsByPost((prev) => ({ ...prev, [post.id]: true }))}
                              className="text-sm font-semibold text-pink-600 hover:text-pink-700 px-1"
                            >
                              {hiddenCount} more comments
                            </button>
                          )}

                          {isExpanded && allComments.length > 2 && (
                            <button
                              type="button"
                              onClick={() => setExpandedCommentsByPost((prev) => ({ ...prev, [post.id]: false }))}
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
                        void handleAddComment(post.id);
                      }}
                    >
                      <input
                        type="text"
                        value={commentDraftByPost[post.id] || ""}
                        onChange={(event) => setCommentDraftByPost((prev) => ({ ...prev, [post.id]: event.target.value }))}
                        placeholder="Write a comment..."
                        className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={!!interactionBusyByPost[post.id] || !(commentDraftByPost[post.id] || "").trim()}
                        className="px-3 py-2 rounded-lg bg-pink-100 text-pink-700 border border-pink-500 text-sm font-semibold hover:bg-pink-200 disabled:opacity-60 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700 dark:hover:bg-pink-900/45"
                      >
                        Comment
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      <PostShareSheet
        isOpen={!!shareSheetPost}
        post={shareSheetPost}
        currentUser={user ? { id: user.id, user_metadata: user.user_metadata } : null}
        onClose={() => setShareSheetPost(null)}
        onShareTracked={handleTrackShare}
      />
    </div>
  );
}
