"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PostContentWithPreview from "../../components/PostContentWithPreview";
import { supabase } from "../../../lib/supabase";
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
  const [membershipStatus, setMembershipStatus] = useState<"pending" | "approved" | null>(null);

  useEffect(() => {
    void initialize();
  }, [groupId]);

  const isPrivateGroup = group?.visibility === "by_permission";
  const isGroupCreator = group?.creator_user_id === user?.id;
  const canCreateGroupPosts = !isPrivateGroup || membershipStatus === "approved" || isGroupCreator;

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

      await loadGroup(groupId);
      await Promise.all([loadMembership(groupId, session.user.id), loadGroupPosts(groupId)]);
    } finally {
      setLoading(false);
    }
  }

  async function loadGroup(id: string) {
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
        setGroup({ ...(fallback.data as GroupRow), bio: null });
        return;
      }
      throw initial.error;
    }

    setGroup((initial.data as GroupRow) || null);
  }

  async function loadMembership(id: string, userId: string) {
    const { data } = await supabase
      .from("group_members")
      .select("status")
      .eq("group_id", id)
      .eq("user_id", userId)
      .maybeSingle();

    const status = (data?.status as "pending" | "approved" | undefined) || null;
    setMembershipStatus(status);
  }

  async function loadGroupPosts(id: string) {
    setGroupPostsLoading(true);
    setGroupPostMessage("");
    try {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("group_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGroupPosts((data || []) as Post[]);
    } catch (error) {
      setGroupPosts([]);
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
        author_name: profile?.full_name || user.email || "Mom",
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

      <div className="border rounded-xl p-4 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
        <h1 className="text-xl font-bold mb-2 text-zinc-900 dark:text-zinc-50">{group.name}</h1>
        {group.bio && <div className="text-sm text-zinc-700 dark:text-zinc-200 mb-3 whitespace-pre-line">{group.bio}</div>}

        {!canCreateGroupPosts ? (
          <button
            onClick={() => void handleRequestAccess()}
            disabled={requestingAccess || membershipStatus === "pending"}
            className="mt-2 px-4 py-2 rounded-full bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-60"
          >
            {membershipStatus === "pending" ? "Pending Approval" : requestingAccess ? "Sending..." : "Request Access"}
          </button>
        ) : (
          <button
            onClick={() => setShowGroupPostForm((value) => !value)}
            className="mt-2 px-4 py-2 rounded-full bg-pink-600 text-white hover:bg-pink-700"
          >
            {showGroupPostForm ? "Cancel" : "Create Post"}
          </button>
        )}

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
              className="px-4 py-2 rounded-full bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-60"
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
            <div key={post.id} className="border rounded-xl p-4 mb-3 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <div className="font-semibold text-zinc-900 dark:text-zinc-50">{post.title}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                {post.author_name || "Mom"} • {new Date(post.created_at).toLocaleString()}
              </div>
              <PostContentWithPreview text={post.content} className="text-zinc-700 dark:text-zinc-200 whitespace-pre-line" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
