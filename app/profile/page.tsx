"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsCount, setPostsCount] = useState<number>(0);
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
      await loadUserProfile(session.user.id);
    } catch (error) {
      console.error("Error checking user:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  async function loadUserProfile(userId: string) {
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

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError("File size must be less than 5MB");
      return;
    }

    setUploading(true);
    setError("");

    try {
      // Create a preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Generate unique filename
      const fileName = `${user.id}-${Date.now()}-${file.name}`;
      const filePath = `profile-photos/${fileName}`;

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from("momvillage")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error("Supabase storage error:", uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("momvillage").getPublicUrl(filePath);

      setProfile({ ...profile, profile_photo_url: publicUrl });
      setMessage("Photo uploaded successfully!");
    } catch (error: any) {
      console.error("Photo upload error:", error);
      setError(`Failed to upload photo: ${error.message || "Unknown error"}`);
      setPreviewUrl("");
    } finally {
      setUploading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  async function handleSave() {
    if (!user) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: profile.full_name,
          phone: profile.phone,
          address: profile.address,
          city: profile.city,
          state: profile.state,
          zip_code: profile.zip_code,
          number_of_kids: profile.number_of_kids,
          kids_age_groups: profile.kids_age_groups,
          preferred_language: profile.preferred_language,
          parenting_style: profile.parenting_style,
          other_info: profile.other_info,
          profile_photo_url: profile.profile_photo_url,
        },
      });

      if (updateError) {
        console.error("Save error:", updateError);
        setError(`Failed to update profile: ${updateError.message}`);
      } else {
        // Check if this is first time setup (no availability set yet)
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();
        const hasAvailability =
          currentUser?.user_metadata?.availability ||
          currentUser?.user_metadata?.weeklyAvailability;

        if (!hasAvailability) {
          setMessage(
            "Profile updated successfully! Redirecting to availability...",
          );
          setEditing(false);
          await loadUserProfile(user.id);
          // Redirect to availability page for first-time setup
          setTimeout(() => {
            router.push("/calendar");
          }, 1500);
        } else {
          setMessage("Profile updated successfully!");
          setEditing(false);
          await loadUserProfile(user.id);
        }
      }
    } catch (error: any) {
      console.error("Error saving profile:", error);
      setError(`Failed to update profile: ${error.message || "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/home"
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-pink-600"
          >
            ← Back to Home
          </Link>
          <button
            onClick={handleSignOut}
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-pink-600"
          >
            Sign Out
          </button>
        </div>

        {/* Profile Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-8 shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              {/* Profile Photo */}
              <div className="relative">
                {previewUrl || profile.profile_photo_url ? (
                  <img
                    src={previewUrl || profile.profile_photo_url}
                    alt="Profile"
                    className="w-20 h-20 rounded-full object-cover border-2 border-pink-300"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white text-2xl font-semibold">
                    {user?.email?.[0].toUpperCase() || "?"}
                  </div>
                )}
                {editing && (
                  <label className="absolute bottom-0 right-0 bg-pink-600 text-white p-2 rounded-full cursor-pointer hover:bg-pink-700 text-xs">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                    📷
                  </label>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {editing
                    ? "Edit Profile"
                    : profile.full_name || "Your Profile"}
                </h1>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {user?.email}
                </p>
              </div>
            </div>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 text-sm bg-pink-600 text-white rounded-full hover:bg-pink-700"
              >
                Edit Profile
              </button>
            )}
          </div>

          {message && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md text-sm">
              {message}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Profile Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={profile.full_name || ""}
                onChange={(e) =>
                  setProfile({ ...profile, full_name: e.target.value })
                }
                disabled={!editing}
                className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-pink-300 disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="Your full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Phone
              </label>
              <input
                type="tel"
                value={profile.phone || ""}
                onChange={(e) =>
                  setProfile({ ...profile, phone: e.target.value })
                }
                disabled={!editing}
                className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-pink-300 disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="(123) 456-7890"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Address
              </label>
              <input
                type="text"
                value={profile.address || ""}
                onChange={(e) =>
                  setProfile({ ...profile, address: e.target.value })
                }
                disabled={!editing}
                className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-pink-300 disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="Street address"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  City
                </label>
                <input
                  type="text"
                  value={profile.city || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, city: e.target.value })
                  }
                  disabled={!editing}
                  className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-pink-300 disabled:opacity-60 disabled:cursor-not-allowed"
                  placeholder="City"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  State
                </label>
                <input
                  type="text"
                  value={profile.state || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, state: e.target.value })
                  }
                  disabled={!editing}
                  className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-pink-300 disabled:opacity-60 disabled:cursor-not-allowed"
                  placeholder="State"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                ZIP Code
              </label>
              <input
                type="text"
                value={profile.zip_code || ""}
                onChange={(e) =>
                  setProfile({ ...profile, zip_code: e.target.value })
                }
                disabled={!editing}
                className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-pink-300 disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="12345"
              />
            </div>

            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                Family Information
              </h3>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Number of Kids
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={profile.number_of_kids || 0}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        number_of_kids: parseInt(e.target.value) || 0,
                      })
                    }
                    disabled={!editing}
                    className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-pink-300 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Preferred Language
                  </label>
                  <select
                    value={profile.preferred_language || ""}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        preferred_language: e.target.value,
                      })
                    }
                    disabled={!editing}
                    className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-pink-300 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="">Select...</option>
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                    <option value="Mandarin">Mandarin</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Kids Age Groups (select all that apply)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    "0-1 years",
                    "1-3 years",
                    "3-5 years",
                    "5-8 years",
                    "8-12 years",
                    "12+ years",
                  ].map((ageGroup) => (
                    <label
                      key={ageGroup}
                      className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300"
                    >
                      <input
                        type="checkbox"
                        checked={
                          profile.kids_age_groups?.includes(ageGroup) || false
                        }
                        onChange={(e) => {
                          const current = profile.kids_age_groups || [];
                          if (e.target.checked) {
                            setProfile({
                              ...profile,
                              kids_age_groups: [...current, ageGroup],
                            });
                          } else {
                            setProfile({
                              ...profile,
                              kids_age_groups: current.filter(
                                (g) => g !== ageGroup,
                              ),
                            });
                          }
                        }}
                        disabled={!editing}
                        className="w-4 h-4 rounded border-zinc-300 text-pink-600 focus:ring-pink-300 disabled:opacity-60"
                      />
                      {ageGroup}
                    </label>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Parenting Style
                </label>
                <select
                  value={profile.parenting_style || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, parenting_style: e.target.value })
                  }
                  disabled={!editing}
                  className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-pink-300 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">Select...</option>
                  <option value="Authoritative">Authoritative</option>
                  <option value="Permissive">Permissive</option>
                  <option value="Authoritarian">Authoritarian</option>
                  <option value="Uninvolved">Uninvolved</option>
                  <option value="Gentle Parenting">Gentle Parenting</option>
                  <option value="Attachment Parenting">
                    Attachment Parenting
                  </option>
                  <option value="Free-Range">Free-Range</option>
                  <option value="Helicopter">Helicopter</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Other Important Info
                </label>
                <textarea
                  value={profile.other_info || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, other_info: e.target.value })
                  }
                  disabled={!editing}
                  rows={4}
                  className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-pink-300 disabled:opacity-60 disabled:cursor-not-allowed"
                  placeholder="Any additional information you'd like to share..."
                />
              </div>
            </div>

            {editing && (
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-full hover:bg-pink-700 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setMessage("");
                  }}
                  disabled={saving}
                  className="flex-1 px-4 py-2 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-full hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Account Info */}
          <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
              Account Information
            </h3>
            <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <div className="flex justify-between">
                <span>Email:</span>
                <span className="font-medium">{user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span>Member since:</span>
                <span className="font-medium">
                  {new Date(user?.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              My Posts
            </h2>
            <span className="text-sm font-semibold text-pink-600 dark:text-pink-300">
              {postsCount}
            </span>
          </div>

          {posts.length === 0 ? (
            <div className="text-zinc-400 italic">
              (Your posts will appear here)
            </div>
          ) : (
            <div className="grid gap-4">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="border rounded-xl p-4 shadow-sm bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                >
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
