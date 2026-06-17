"use client";


import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { fetchPosts, fetchPostInteractions, togglePostLike, addPostComment, sharePost, PostCommentRow } from "../../../lib/posts";
import PostContentWithPreview from "../../components/PostContentWithPreview";
import PostShareSheet from "../../components/PostShareSheet";
import ReportModal, { ReportType, ReportReason } from "../../components/ReportModal";
import type { Post } from "../../../types/post";

function getSafeDisplayName(name?: string | null, fallback = "Mom") {
  const normalized = (name || "").trim();
  if (!normalized) return fallback;
  const emailLocalPart = normalized.includes("@")
    ? normalized.split("@")[0]
    : normalized;

  const cleaned = emailLocalPart
    .replace(/[._-]+/g, " ")
    .replace(/[0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return fallback;

  const withWordBreaks = cleaned.replace(/([a-z])([A-Z])/g, "$1 $2");
  const words = withWordBreaks.split(" ").filter(Boolean);

  const pretty = words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
    .trim();

  return pretty || fallback;
}

function pickCanonicalProfileName(profile: any) {
  const fullName = (profile?.full_name || "").trim();
  const name = (profile?.name || "").trim();
  const fullNameLooksLikeEmail = fullName.includes("@");
  if (fullName && !fullNameLooksLikeEmail) return fullName;
  if (name) return name;
  return fullName;
}

export default function ProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const profileUserId = Array.isArray(id) ? id[0] : id;

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [inviteStatus, setInviteStatus] = useState<"in-village"|"invited-by-me"|"invited-me"|"none">("none");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [villageMembers, setVillageMembers] = useState<any[]>([]);
  const [postsCount, setPostsCount] = useState<number | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostCommentRow[]>>({});
  const [authorPhotoById, setAuthorPhotoById] = useState<Record<string, string>>({});
  const [authorNameById, setAuthorNameById] = useState<Record<string, string>>({});
  const [likesCountByPost, setLikesCountByPost] = useState<Record<string, number>>({});
  const [likedByMeByPost, setLikedByMeByPost] = useState<Record<string, boolean>>({});
  const [sharesCountByPost, setSharesCountByPost] = useState<Record<string, number>>({});
  const [commentDraftByPost, setCommentDraftByPost] = useState<Record<string, string>>({});
  const [interactionBusyByPost, setInteractionBusyByPost] = useState<Record<string, boolean>>({});
  const [openPostMenuId, setOpenPostMenuId] = useState<string | null>(null);
  const [openCommentMenuId, setOpenCommentMenuId] = useState<string | null>(null);
  const [expandedCommentsByPost, setExpandedCommentsByPost] = useState<Record<string, boolean>>({});
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentDraft, setEditingCommentDraft] = useState<string>("");
  const [showVillageModal, setShowVillageModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportModalType, setReportModalType] = useState<ReportType>("post");
  const [reportModalTargetId, setReportModalTargetId] = useState<string>("");
  const [shareSheetPost, setShareSheetPost] = useState<Post | null>(null);

  function getProfileHref(authorUserId?: string | null) {
    if (!authorUserId) return null;
    return authorUserId === currentUser?.id ? "/profile" : `/profile/${authorUserId}`;
  }

  // (All logic and hooks are now inside the component)

  // Fetch profile info and posts count
  useEffect(() => {
    async function fetchProfile() {
      setLoading(true);
      setError("");
      const { data, error } = await supabase
        .from("user_public_profiles")
        .select("id, full_name, name, profile_photo_url, city, state, is_public, number_of_kids, kids_age_groups, parenting_style, bio")
        .eq("id", profileUserId)
        .single();
      if (error) {
        setError("Profile not found.");
        setProfile(null);
      } else {
        const metadataName =
          profileUserId === currentUser?.id
            ? (currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.name || "")
            : "";
        setProfile({
          ...data,
          full_name: metadataName || pickCanonicalProfileName(data) || "",
        });
        const nextPosts = await fetchPosts({ author_user_id: data.id });

        const groupIds = [...new Set(nextPosts.map((post) => post.group_id).filter((entry): entry is string => !!entry))];
        let visiblePosts = nextPosts;
        if (groupIds.length > 0) {
          const viewerUserId = currentUser?.id || "";
          const groupResult = await supabase
            .from("groups")
            .select("id,visibility,creator_user_id")
            .in("id", groupIds);

          const membershipResult = viewerUserId
            ? await supabase
                .from("group_members")
                .select("group_id,status")
                .eq("user_id", viewerUserId)
                .in("group_id", groupIds)
            : { data: [] as any[] };

          const groupById: Record<string, { visibility: "open" | "by_permission"; creator_user_id: string }> = {};
          (groupResult.data || []).forEach((group: any) => {
            if (group?.id) {
              groupById[group.id] = {
                visibility: (group.visibility as "open" | "by_permission") || "by_permission",
                creator_user_id: group.creator_user_id || "",
              };
            }
          });

          const approvedMemberships = new Set(
            (membershipResult.data || [])
              .filter((row: any) => row?.status === "approved" && row?.group_id)
              .map((row: any) => row.group_id as string)
          );

          visiblePosts = nextPosts.filter((post) => {
            if (!post.group_id) return true;
            const groupMeta = groupById[post.group_id];
            if (!groupMeta) return false;
            if (groupMeta.visibility === "open") return true;
            if (groupMeta.creator_user_id === viewerUserId) return true;
            return approvedMemberships.has(post.group_id);
          });
        }

        setPosts(visiblePosts);
        setPostsCount(visiblePosts.length);

        const authorIds = [...new Set(visiblePosts.map((post) => post.author_user_id).filter(Boolean))];
        if (authorIds.length > 0) {
          const { data: profiles } = await supabase
            .from("user_public_profiles")
            .select("id, full_name, name, profile_photo_url")
            .in("id", authorIds);

          const photoMap: Record<string, string> = {};
          const nameMap: Record<string, string> = {};
          (profiles || []).forEach((entry: any) => {
            if (entry?.id && entry?.profile_photo_url) photoMap[entry.id] = entry.profile_photo_url;
            const canonicalName = pickCanonicalProfileName(entry);
            if (entry?.id && canonicalName) nameMap[entry.id] = getSafeDisplayName(canonicalName);
          });
          setAuthorPhotoById(photoMap);
          setAuthorNameById(nameMap);
        } else {
          setAuthorPhotoById({});
          setAuthorNameById({});
        }

        const postIds = visiblePosts.map((post) => post.id);
        if (postIds.length > 0) {
          const interactions = await fetchPostInteractions(postIds, currentUser?.id);
          setLikesCountByPost(interactions.likesCountByPost);
          setLikedByMeByPost(interactions.likedByMeByPost);
          setSharesCountByPost(interactions.sharesCountByPost);
          setCommentsByPost(interactions.commentsByPost);

          const unknownCommenterIds = [...new Set(
            Object.values(interactions.commentsByPost)
              .flat()
              .map((comment) => comment.author_user_id)
              .filter((authorId) => authorId && !authorIds.includes(authorId))
          )];

          if (unknownCommenterIds.length > 0) {
            const { data: commentProfiles } = await supabase
              .from("user_public_profiles")
              .select("id, full_name, name, profile_photo_url")
              .in("id", unknownCommenterIds);
            if (commentProfiles) {
              setAuthorPhotoById((prev) => {
                const updated = { ...prev };
                commentProfiles.forEach((entry: any) => {
                  if (entry?.id && entry?.profile_photo_url) updated[entry.id] = entry.profile_photo_url;
                });
                return updated;
              });
              setAuthorNameById((prev) => {
                const updated = { ...prev };
                commentProfiles.forEach((entry: any) => {
                  const canonicalName = pickCanonicalProfileName(entry);
                  if (entry?.id && canonicalName) updated[entry.id] = getSafeDisplayName(canonicalName);
                });
                return updated;
              });
            }
          }
        } else {
          setLikesCountByPost({});
          setLikedByMeByPost({});
          setSharesCountByPost({});
          setCommentsByPost({});
        }
      }
      setLoading(false);
    }
    if (profileUserId) fetchProfile();
  }, [profileUserId, currentUser?.id]);

  // Fetch current user and invitation/village status
  useEffect(() => {
    async function fetchStatus() {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      if (!user || !profileUserId) return;
      if (user.id === profileUserId) {
        router.replace("/profile");
        return;
      }
      // Check if in village
      const { data: members } = await supabase
        .from("village_invitations")
        .select("id, from_user_id, to_user_id, status")
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .eq("status", "accepted");
      const inVillage = (members ?? []).some((m: any) => (m.from_user_id === profileUserId || m.to_user_id === profileUserId));
      if (inVillage) {
        setInviteStatus("in-village");
        return;
      }
      // Check if invitation sent by me
      const { data: sentInvites } = await supabase
        .from("village_invitations")
        .select("id, status")
        .eq("from_user_id", user.id)
        .eq("to_user_id", profileUserId)
        .order("created_at", { ascending: false });
      if ((sentInvites ?? []).some((i: any) => i.status === "pending" || i.status === "resent")) {
        setInviteStatus("invited-by-me");
        return;
      }
      // Check if invitation sent to me
      const { data: receivedInvites } = await supabase
        .from("village_invitations")
        .select("id, status")
        .eq("from_user_id", profileUserId)
        .eq("to_user_id", user.id)
        .order("created_at", { ascending: false });
      if ((receivedInvites ?? []).some((i: any) => i.status === "pending" || i.status === "resent")) {
        setInviteStatus("invited-me");
        return;
      }
      setInviteStatus("none");
    }
    fetchStatus();
  }, [profileUserId, router]);

  // Fetch this user's village members
  useEffect(() => {
    async function fetchVillage() {
      if (!profileUserId) return;
      // Find all accepted invitations where this user is sender or recipient
      const { data: invites } = await supabase
        .from("village_invitations")
        .select("from_user_id, to_user_id, status")
        .or(`from_user_id.eq.${profileUserId},to_user_id.eq.${profileUserId}`)
        .eq("status", "accepted");
      const memberIds = [...new Set((invites ?? []).map((invite: any) => (
        invite.from_user_id === profileUserId ? invite.to_user_id : invite.from_user_id
      )))];
      if (memberIds.length === 0) {
        setVillageMembers([]);
        return;
      }
      const { data: profiles } = await supabase
        .from("user_public_profiles")
        .select("id, full_name, profile_photo_url, city, state, is_public")
        .in("id", memberIds);
      setVillageMembers(profiles ?? []);
    }
    fetchVillage();
  }, [profileUserId]);

  async function handleInvite() {
    if (!currentUser || !profileUserId) return;
    const targetUserId = profileUserId;
    setInviteLoading(true);
    try {
      const { error } = await supabase
        .from("village_invitations")
        .insert({ from_user_id: currentUser.id, to_user_id: targetUserId, status: "pending" });
      if (error) throw error;
      setInviteStatus("invited-by-me");
    } catch (e) {
      alert("Failed to send invitation.");
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleToggleLike(postId: string) {
    if (!currentUser?.id) return;
    const currentlyLiked = !!likedByMeByPost[postId];
    setInteractionBusyByPost((prev) => ({ ...prev, [postId]: true }));
    try {
      await togglePostLike(postId, currentUser.id, currentlyLiked);
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
    if (!currentUser?.id) return;
    const targetPost = posts.find((post) => post.id === postId);
    if (targetPost?.comments_disabled) {
      alert("Comments are disabled for this post.");
      return;
    }
    const draft = (commentDraftByPost[postId] || "").trim();
    if (!draft) return;
    setInteractionBusyByPost((prev) => ({ ...prev, [postId]: true }));
    try {
      await addPostComment(postId, currentUser.id, draft);
      const newComment: PostCommentRow = {
        id: `${Date.now()}`,
        post_id: postId,
        author_user_id: currentUser.id,
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
    if (!currentUser?.id) return;
    if (post.visibility !== "public") {
      alert("Only public posts can be shared.");
      return;
    }
    setShareSheetPost(post);
  }

  async function handleTrackShare(post: Post) {
    if (!currentUser?.id) return;
    if (post.visibility !== "public") {
      alert("Only public posts can be shared.");
      return;
    }
    setInteractionBusyByPost((prev) => ({ ...prev, [post.id]: true }));
    try {
      await sharePost(post.id, currentUser.id);
      setSharesCountByPost((prev) => ({
        ...prev,
        [post.id]: (prev[post.id] || 0) + 1,
      }));
    } catch (e: any) {
      const maybeCode = e?.code ? ` (${e.code})` : "";
      alert(`Share failed${maybeCode}: ${e?.message || "Unknown error"}`);
    } finally {
      setInteractionBusyByPost((prev) => ({ ...prev, [post.id]: false }));
    }
  }

  async function handleReport(reason: ReportReason, details?: string) {
    try {
      const endpoint = reportModalType === "post" 
        ? "/api/reports/post"
        : reportModalType === "comment"
        ? "/api/reports/comment"
        : "/api/reports/account";

      const body = reportModalType === "post"
        ? { postId: reportModalTargetId, reason, details }
        : reportModalType === "comment"
        ? { commentId: reportModalTargetId, reason, details }
        : { accountUserId: reportModalTargetId, reason, details };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit report");
      }

      alert("Report submitted. Thank you for helping keep our community safe.");
      setReportModalOpen(false);
    } catch (error: any) {
      throw error;
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
    if (!currentUser?.id) return;
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
        .eq("author_user_id", currentUser.id);
      if (error) throw error;

      setCommentsByPost((prev) => ({
        ...prev,
        [post.id]: (prev[post.id] || []).map((entry) =>
          entry.id === comment.id ? { ...entry, body: trimmed } : entry
        ),
      }));
      handleCancelEditComment();
    } catch (e: any) {
      const maybeCode = e?.code ? ` (${e.code})` : "";
      alert(`Edit comment failed${maybeCode}: ${e?.message || "Unknown error"}`);
    } finally {
      setInteractionBusyByPost((prev) => ({ ...prev, [post.id]: false }));
    }
  }

  async function handleDeleteComment(post: Post, comment: PostCommentRow) {
    if (!currentUser?.id) return;
    const canDelete = currentUser.id === comment.author_user_id || currentUser.id === post.author_user_id;
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
    } catch (e: any) {
      const maybeCode = e?.code ? ` (${e.code})` : "";
      alert(`Delete comment failed${maybeCode}: ${e?.message || "Unknown error"}`);
    } finally {
      setInteractionBusyByPost((prev) => ({ ...prev, [post.id]: false }));
    }
  }

  async function handleDeletePost(postId: string) {
    if (!currentUser?.id) return;
    const confirmed = window.confirm("Delete this post? This cannot be undone.");
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
    } catch (e: any) {
      alert("Delete failed: " + (e?.message || "Unknown error"));
    } finally {
      setInteractionBusyByPost((prev) => ({ ...prev, [postId]: false }));
    }
  }

  async function handleToggleCommentsDisabled(post: Post) {
    if (!currentUser?.id) return;
    const nextValue = !post.comments_disabled;
    setInteractionBusyByPost((prev) => ({ ...prev, [post.id]: true }));
    try {
      const { data: updatedRows, error } = await supabase
        .from("posts")
        .update({ comments_disabled: nextValue })
        .eq("id", post.id)
        .eq("author_user_id", currentUser.id)
        .select("id");
      if (error) throw error;
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error("Not allowed to update this post.");
      }
      setPosts((prev) => prev.map((entry) => (
        entry.id === post.id ? { ...entry, comments_disabled: nextValue } : entry
      )));
      setOpenPostMenuId(null);
    } catch (e: any) {
      const maybeCode = e?.code ? ` (${e.code})` : "";
      alert(`Update failed${maybeCode}: ${e?.message || "Unknown error"}`);
    } finally {
      setInteractionBusyByPost((prev) => ({ ...prev, [post.id]: false }));
    }
  }

  if (loading) return <div className="p-8 text-center">Loading profile...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!profile) return null;

  return (
    <div className="min-h-screen bg-pink-50 dark:bg-pink-950 p-0 sm:p-4">
      <div className="w-full max-w-2xl mx-auto flex items-center pt-4 pb-2 px-2 sm:px-0">
        <button
          onClick={() => router.push('/home')}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full p-2 shadow hover:bg-pink-50 dark:hover:bg-pink-800 transition focus:outline-none focus:ring-2 focus:ring-pink-400"
          aria-label="Back to Home"
        >
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-pink-600">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>
      <div className="w-full max-w-2xl mx-auto">
        <div className="relative w-full flex flex-row items-stretch gap-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 sm:px-10 pt-6 pb-4">
          <div className="absolute right-3 top-3 sm:right-4 sm:top-4 z-20">
            <div className="relative">
              <button
                type="button"
                aria-label="Profile actions"
                onClick={() => setOpenPostMenuId(openPostMenuId ? null : "profile-menu")}
                className="w-8 h-8 rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center"
              >
                ⋯
              </button>
              {openPostMenuId === "profile-menu" && (
                <div className="absolute right-0 mt-2 z-20 w-44 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setReportModalType("account");
                      setReportModalTargetId(profileUserId || "");
                      setReportModalOpen(true);
                      setOpenPostMenuId(null);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                  >
                    Report profile
                  </button>
                </div>
              )}
            </div>
          </div>
          {/* Profile Photo */}
          {profile.profile_photo_url ? (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-pink-400 shadow flex-shrink-0">
              <img src={profile.profile_photo_url} alt={getSafeDisplayName(profile.full_name, 'Profile')} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white text-2xl sm:text-3xl font-bold border-2 border-pink-400 shadow flex-shrink-0">
              {getSafeDisplayName(profile.full_name)?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          {/* Profile Info */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-1 w-full">
              <span className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-zinc-50 truncate w-full text-left">{getSafeDisplayName(profile.full_name)}</span>
            </div>
            <div className="flex flex-row items-center gap-8 mt-1 mb-2 w-full">
              <button className="flex flex-col items-center group focus:outline-none" onClick={() => setShowVillageModal(true)} title="Show Village">
                <span className="text-2xl sm:text-3xl font-extrabold text-pink-600 leading-none text-center group-hover:underline">{villageMembers.length}</span>
                <span className="text-[10px] font-medium text-pink-700 uppercase tracking-wide mt-0.5 text-center">Village</span>
              </button>
              {typeof postsCount === "number" && (
                <div className="flex flex-col items-center">
                  <span className="text-2xl sm:text-3xl font-extrabold text-pink-300 leading-none text-center">{postsCount}</span>
                  <span className="text-[10px] font-medium text-pink-400 uppercase tracking-wide mt-0.5 text-center">Posts</span>
                </div>
              )}
            </div>
            <div className="flex gap-3 flex-wrap text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              {profile.city && (
                <span>Location: <span className="font-medium text-zinc-700 dark:text-zinc-200">{profile.city}{profile.state ? `, ${profile.state}` : ''}</span></span>
              )}
              {(profile.number_of_kids !== undefined && profile.number_of_kids !== null && profile.number_of_kids !== 0) && (
                <span>Children: <span className="font-medium text-zinc-700 dark:text-zinc-200">{profile.number_of_kids}</span></span>
              )}
              {profile.kids_age_groups && profile.kids_age_groups.length > 0 && (
                <span>Ages: <span className="font-medium text-zinc-700 dark:text-zinc-200">{Array.isArray(profile.kids_age_groups) ? profile.kids_age_groups.join(', ') : String(profile.kids_age_groups)}</span></span>
              )}
              {profile.parenting_style && (
                <span>Parenting Style: <span className="font-medium text-zinc-700 dark:text-zinc-200">{profile.parenting_style}</span></span>
              )}
            </div>
          </div>
          {/* Message Button removed from banner as now redundant */}
        </div>
        {/* Status banner or invite button below banner */}
        {currentUser && currentUser.id !== profileUserId && (
          <div className="flex flex-row justify-center items-center gap-3 mt-3 mb-2">
            {/* Status/invite button */}
            {inviteStatus === "in-village" && (
              <button
                className="px-4 py-2 bg-green-100 hover:bg-green-200 text-green-800 rounded-lg font-semibold text-base transition-colors whitespace-nowrap border border-green-300 shadow"
                onClick={() => setShowRemoveModal(true)}
                type="button"
              >
                In Your Village
              </button>
            )}
                    {/* Remove from Village Modal */}
                    {showRemoveModal && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <div className="bg-white dark:bg-zinc-900 rounded-xl p-8 shadow-xl w-full max-w-md relative">
                          <button
                            onClick={() => setShowRemoveModal(false)}
                            className="absolute top-3 right-3 text-zinc-400 hover:text-pink-600 dark:hover:text-pink-300 text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-pink-400"
                            aria-label="Close Remove Modal"
                          >
                            &times;
                          </button>
                          <div className="text-center mb-4">
                            <div className="text-lg font-bold text-pink-700 mb-2">Remove from Your Village?</div>
                            <div className="text-zinc-700 dark:text-zinc-200 mb-6">Are you sure you want to remove this mom from your village? This action cannot be undone.</div>
                            <div className="flex gap-4 justify-center">
                              <button
                                className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-lg font-semibold text-base transition-colors"
                                onClick={() => setShowRemoveModal(false)}
                              >
                                Cancel
                              </button>
                              <button
                                className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-semibold text-base transition-colors"
                                onClick={async () => {
                                  setRemoveLoading(true);
                                  // Remove both directions of invitation
                                  await supabase
                                    .from('village_invitations')
                                    .delete()
                                    .or(`and(from_user_id.eq.${currentUser.id},to_user_id.eq.${profileUserId}),and(from_user_id.eq.${profileUserId},to_user_id.eq.${currentUser.id})`);
                                  setRemoveLoading(false);
                                  setInviteStatus('none');
                                  setShowRemoveModal(false);
                                }}
                                disabled={removeLoading}
                              >
                                {removeLoading ? 'Removing...' : 'Remove'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
            {inviteStatus === "invited-by-me" && (
              <div className="inline-block bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg text-base font-semibold whitespace-nowrap">Invitation Sent</div>
            )}
            {inviteStatus === "invited-me" && (
              <div className="inline-block bg-blue-100 text-blue-800 px-4 py-2 rounded-lg text-base font-semibold whitespace-nowrap">Invited You</div>
            )}
            {inviteStatus === "none" && (
              <button
                className="inline-block bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg text-base font-semibold whitespace-nowrap transition-colors"
                onClick={handleInvite}
                disabled={inviteLoading}
              >
                {inviteLoading ? 'Sending...' : 'Invite to Village'}
              </button>
            )}
            {/* Message button */}
            <button
              className="px-4 py-2 bg-pink-100 hover:bg-pink-200 text-pink-700 border border-pink-500 rounded-lg font-semibold text-base transition-colors whitespace-nowrap dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700 dark:hover:bg-pink-900/45"
              onClick={async () => {
                // Find or create conversation between currentUser and profile user
                if (!currentUser || !profileUserId) return;
                let conversationId = null;
                const { data: existingConvos, error: convoError } = await supabase
                  .from("conversations")
                  .select("id,user1_id,user2_id")
                  .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${profileUserId}),and(user1_id.eq.${profileUserId},user2_id.eq.${currentUser.id})`)
                  .limit(1);
                if (convoError) {
                  alert("Failed to check conversations");
                  return;
                }
                if (existingConvos && existingConvos.length > 0) {
                  conversationId = existingConvos[0].id;
                } else {
                  const { data: newConvo, error: createError } = await supabase
                    .from("conversations")
                    .insert({
                      user1_id: currentUser.id,
                      user2_id: profileUserId,
                      user1_name: currentUser.user_metadata?.full_name || "",
                      user2_name: getSafeDisplayName(profile.full_name, ""),
                      user1_photo: currentUser.user_metadata?.profile_photo_url || "",
                      user2_photo: profile.profile_photo_url || "",
                    })
                    .select()
                    .single();
                  if (createError || !newConvo) {
                    alert("Failed to create conversation");
                    return;
                  }
                  conversationId = newConvo.id;
                }
                   router.push(`/messages/${conversationId}`);
              }}
            >
              Message
            </button>
          </div>
        )}
        {/* Bio Section (below profile info, above posts) */}
        {/* Profile posts or other content can go here */}
        <div className="w-full flex flex-col gap-4 py-8">
          {posts.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl shadow-sm w-full max-w-2xl mx-auto p-6 flex flex-col items-center justify-center">
              <div className="text-zinc-400 italic">(Their posts will appear here)</div>
            </div>
          ) : (
            <div className="w-full max-w-2xl mx-auto grid gap-4">
              {posts.map(post => (
                <div
                  key={post.id}
                  className={`border rounded-xl p-4 shadow-sm ${post.type === 'support' ? 'bg-pink-50 border-pink-300 ring-2 ring-pink-200/70 dark:bg-pink-950/20 dark:border-pink-700 dark:ring-pink-800/70' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}
                >
                  {post.type === 'support' && (
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

                    {currentUser?.id === post.author_user_id && (
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
                    {currentUser?.id !== post.author_user_id && (
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
                              onClick={() => {
                                setReportModalType("post");
                                setReportModalTargetId(post.id);
                                setReportModalOpen(true);
                                setOpenPostMenuId(null);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                            >
                              Report post
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

                  <div className="font-bold text-lg mb-1 text-zinc-900 dark:text-zinc-50">{post.title}</div>
                  <PostContentWithPreview
                    text={post.content}
                    className="text-zinc-700 dark:text-zinc-200 whitespace-pre-line"
                  />

                  <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-3 text-sm">
                    <button
                      type="button"
                      disabled={!!interactionBusyByPost[post.id]}
                      onClick={() => handleToggleLike(post.id)}
                      className={`px-3 py-1 rounded-full border transition ${likedByMeByPost[post.id] ? 'bg-pink-100 text-pink-700 border-pink-500 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700' : 'bg-white text-zinc-700 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700'}`}
                    >
                      {likedByMeByPost[post.id] ? '♥' : '♡'} Like {likesCountByPost[post.id] || 0}
                    </button>
                    {post.visibility === 'public' && (
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
                                const commentName = authorNameById[comment.author_user_id] || (comment.author_user_id === currentUser?.id ? "You" : "Mom");
                                const commentProfileHref = getProfileHref(comment.author_user_id);

                                return (
                                  <div key={comment.id} className="flex gap-3 text-sm bg-zinc-50 dark:bg-zinc-800/60 rounded-lg px-3 py-3 border border-zinc-200 dark:border-zinc-700">
                                    <div className="shrink-0">
                                      {commentProfileHref ? (
                                        <Link href={commentProfileHref} className="block">
                                          {authorPhotoById[comment.author_user_id] ? (
                                            <img
                                              src={authorPhotoById[comment.author_user_id]}
                                              alt={commentName}
                                              className="w-9 h-9 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                                            />
                                          ) : (
                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 text-white flex items-center justify-center font-semibold border border-pink-300">
                                              {commentName.charAt(0).toUpperCase()}
                                            </div>
                                          )}
                                        </Link>
                                      ) : (
                                        authorPhotoById[comment.author_user_id] ? (
                                          <img
                                            src={authorPhotoById[comment.author_user_id]}
                                            alt={commentName}
                                            className="w-9 h-9 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                                          />
                                        ) : (
                                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 text-white flex items-center justify-center font-semibold border border-pink-300">
                                            {commentName.charAt(0).toUpperCase()}
                                          </div>
                                        )
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-start justify-between gap-3">
                                        {commentProfileHref ? (
                                          <Link href={commentProfileHref} className="font-semibold text-zinc-800 dark:text-zinc-100 truncate hover:underline">
                                            {commentName}
                                          </Link>
                                        ) : (
                                          <span className="font-semibold text-zinc-800 dark:text-zinc-100 truncate">
                                            {commentName}
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
                                              {comment.author_user_id === currentUser?.id && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleStartEditComment(comment)}
                                                  className="w-full text-left px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                                >
                                                  Edit
                                                </button>
                                              )}
                                              {(currentUser?.id === comment.author_user_id || currentUser?.id === post.author_user_id) && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleDeleteComment(post, comment)}
                                                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                >
                                                  Delete
                                                </button>
                                              )}
                                              {comment.author_user_id !== currentUser?.id && (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setReportModalType("comment");
                                                    setReportModalTargetId(comment.id);
                                                    setReportModalOpen(true);
                                                    setOpenCommentMenuId(null);
                                                  }}
                                                  className="w-full text-left px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                                                >
                                                  Report
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
                                            onChange={(e) => setEditingCommentDraft(e.target.value)}
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
                                        <div className="text-zinc-700 dark:text-zinc-200 mt-1 whitespace-pre-line">{comment.body}</div>
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
                            handleAddComment(post.id);
                          }}
                        >
                          <input
                            type="text"
                            value={commentDraftByPost[post.id] || ''}
                            onChange={(event) => setCommentDraftByPost((prev) => ({ ...prev, [post.id]: event.target.value }))}
                            placeholder="Write a comment..."
                            className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm"
                          />
                          <button
                            type="submit"
                            disabled={!!interactionBusyByPost[post.id] || !(commentDraftByPost[post.id] || '').trim()}
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
        {/* Village Members Modal */}
        {showVillageModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-8 shadow-xl w-full max-w-md relative">
              <button
                onClick={() => setShowVillageModal(false)}
                className="absolute top-3 right-3 text-zinc-400 hover:text-pink-600 dark:hover:text-pink-300 text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-pink-400"
                aria-label="Close Villagers"
              >
                &times;
              </button>
              <div className="text-center mb-4">
                <div className="text-lg font-bold text-pink-700">Village Members</div>
                {villageMembers.length === 0 ? (
                  <div className="text-zinc-500 mt-4">No villagers yet.</div>
                ) : (
                  <div className="mt-4 space-y-3 max-h-72 overflow-y-auto">
                    {villageMembers.map((m: any) => (
                      <button
                        key={m.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-pink-100 dark:hover:bg-pink-900 transition w-full text-left"
                        onClick={() => {
                          setShowVillageModal(false);
                          router.push(`/profile/${m.id}`);
                        }}
                        tabIndex={0}
                        aria-label={`View ${m.full_name}'s profile`}
                      >
                        {m.profile_photo_url ? (
                          <img src={m.profile_photo_url} alt={m.full_name} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-bold text-lg">
                            {m.full_name?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-zinc-900 dark:text-zinc-50">{m.full_name}</div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">{m.city}{m.city && m.state ? ', ' : ''}{m.state}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <ReportModal
        isOpen={reportModalOpen}
        reportType={reportModalType}
        targetId={reportModalTargetId}
        onClose={() => setReportModalOpen(false)}
        onSubmit={handleReport}
      />
      <PostShareSheet
        isOpen={!!shareSheetPost}
        post={shareSheetPost}
        currentUser={currentUser ? { id: currentUser.id, user_metadata: currentUser.user_metadata } : null}
        onClose={() => setShareSheetPost(null)}
        onShareTracked={handleTrackShare}
      />
    </div>
  );
}

