"use client";

// LocationField component for post modal (must be outside HomePage)
function LocationField({ profileLocation, formLocation, setForm }: { profileLocation: string, formLocation: string, setForm: any }) {
  const [custom, setCustom] = React.useState(false);
  const isDefault = !custom && (formLocation === profileLocation || !formLocation);

  React.useEffect(() => {
    // If user switches back to default, reset location to profile
    if (!custom) setForm((f: any) => ({ ...f, location: profileLocation }));
  }, [custom, profileLocation, setForm]);

  return (
    <div>
      <label htmlFor="post-location" className="block text-sm font-medium text-pink-700 mb-1">Location</label>
      {isDefault ? (
        <div className="flex items-center gap-2">
          <span className="px-3 py-2 rounded-lg bg-pink-50 border border-pink-200 text-zinc-900 font-semibold">
            {profileLocation || 'No location set in profile'}
          </span>
          <button
            type="button"
            className="ml-2 text-pink-600 hover:underline text-sm font-medium"
            onClick={() => setCustom(true)}
          >
            Other location
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            id="post-location"
            name="location"
            className="w-full rounded-lg border border-pink-200 px-4 py-2 bg-pink-50 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-pink-400 transition placeholder-pink-300"
            placeholder="Enter a different location"
            value={formLocation}
            onChange={e => setForm((f: any) => ({ ...f, location: e.target.value }))}
          />
          <button
            type="button"
            className="ml-2 text-pink-600 hover:underline text-sm font-medium"
            onClick={() => setCustom(false)}
          >
            Use profile location
          </button>
        </div>
      )}
      <div className="text-xs text-pink-400 mt-1">
        Posting location: <span className="font-semibold text-pink-600">{formLocation || profileLocation || 'Not set'}</span>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { fetchPosts, createPost, fetchPostInteractions, togglePostLike, addPostComment, sharePost, PostCommentRow } from "../../lib/posts";
import { Post, PostType, PostScope, PostVisibility } from "../../types/post";
import type { JSX } from "react";

// Mock group and group post data
const MOCK_GROUPS = [
  { id: '1', name: 'Single Moms Support' },
  { id: '2', name: 'Moms of Toddlers' },
  { id: '3', name: 'Working Moms' },
];
const MOCK_GROUP_POSTS = {
  '1': [
    { id: 'g1p1', title: 'Welcome to Single Moms!', content: 'Introduce yourself!', author_name: 'Alice', created_at: new Date().toISOString() },
    { id: 'g1p2', title: 'Meetup this weekend', content: 'Anyone up for coffee?', author_name: 'Beth', created_at: new Date().toISOString() },
  ],
  '2': [
    { id: 'g2p1', title: 'Toddler tantrums', content: 'Share your tips!', author_name: 'Cara', created_at: new Date().toISOString() },
  ],
  '3': [
    { id: 'g3p1', title: 'Work/life balance', content: 'How do you manage?', author_name: 'Dana', created_at: new Date().toISOString() },
  ],
};

export default function HomePage() {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [feedType, setFeedType] = useState<'local' | 'village' | 'groups'>('local');
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null); // For groups logic
  const [authorPhotoById, setAuthorPhotoById] = useState<Record<string, string>>({});
  const [likesCountByPost, setLikesCountByPost] = useState<Record<string, number>>({});
  const [likedByMeByPost, setLikedByMeByPost] = useState<Record<string, boolean>>({});
  const [sharesCountByPost, setSharesCountByPost] = useState<Record<string, number>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostCommentRow[]>>({});
  const [commentDraftByPost, setCommentDraftByPost] = useState<Record<string, string>>({});
  const [interactionBusyByPost, setInteractionBusyByPost] = useState<Record<string, boolean>>({});
  const [openPostMenuId, setOpenPostMenuId] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: '',
    content: '',
    type: 'general' as PostType,
    visibility: 'public' as PostVisibility,
    location: profile?.city ? `${profile.city}${profile.state ? ', ' + profile.state : ''}` : '',
  });

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) loadPosts();
  }, [user, feedType]);

  async function checkUser() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser?.user_metadata) {
        setProfile(currentUser.user_metadata);
      }
    } catch (error) {
      console.error('Error checking user:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  async function loadPosts() {
    setLoading(true);
    try {
      let nextPosts: Post[] = [];
      if (feedType === 'village' && user) {
        // Fetch village member user IDs for the current user
        const { data: memberRows } = await supabase
          .from('village_members')
          .select('user_id, member_id')
          .or(`user_id.eq.${user.id},member_id.eq.${user.id}`);

        // Collect all user IDs in the village (excluding self)
        const villageUserIds: string[] = [];
        (memberRows || []).forEach((row: any) => {
          if (row.user_id !== user.id) villageUserIds.push(row.user_id);
          if (row.member_id !== user.id) villageUserIds.push(row.member_id);
        });
        // Always include self
        villageUserIds.push(user.id);
        const uniqueVillageUserIds = [...new Set(villageUserIds)];

        // Fetch village-scoped posts + public posts from village members
        const [villagePosts, publicVillagePosts] = await Promise.all([
          fetchPosts({ scope: 'village' }),
          uniqueVillageUserIds.length > 0
            ? supabase
                .from('posts')
                .select('*')
                .eq('scope', 'public')
                .in('author_user_id', uniqueVillageUserIds)
                .order('created_at', { ascending: false })
                .then(({ data }) => data || [])
            : Promise.resolve([]),
        ]);

        // Merge, deduplicate by id, sort by created_at desc
        const merged = [...villagePosts, ...publicVillagePosts];
        const seen = new Set<string>();
        const deduped = merged.filter((p: any) => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });
        deduped.sort((a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        nextPosts = deduped as Post[];
      } else {
        // Local feed: all public posts
        nextPosts = await fetchPosts({ scope: 'public' });
      }

      setPosts(nextPosts);

      // Hydrate author profile photos for post cards (non-blocking)
      try {
        const authorIds = [...new Set(nextPosts.map((post) => post.author_user_id).filter(Boolean))];
        if (authorIds.length === 0) {
          setAuthorPhotoById({});
        } else {
          const { data: authorProfiles } = await supabase
            .from('user_public_profiles')
            .select('id, profile_photo_url')
            .in('id', authorIds);

          const authorPhotoMap: Record<string, string> = {};
          (authorProfiles || []).forEach((profile: any) => {
            if (profile?.id && profile?.profile_photo_url) {
              authorPhotoMap[profile.id] = profile.profile_photo_url;
            }
          });
          setAuthorPhotoById(authorPhotoMap);
        }
      } catch (e) {
        setAuthorPhotoById({});
      }

      // Fetch interactions (non-blocking so posts still render even if migration isn't applied yet)
      try {
        const postIds = nextPosts.map((post) => post.id);
        const interactions = await fetchPostInteractions(postIds, user?.id);
        setLikesCountByPost(interactions.likesCountByPost);
        setLikedByMeByPost(interactions.likedByMeByPost);
        setSharesCountByPost(interactions.sharesCountByPost);
        setCommentsByPost(interactions.commentsByPost);
      } catch (e) {
        setLikesCountByPost({});
        setLikedByMeByPost({});
        setSharesCountByPost({});
        setCommentsByPost({});
      }
    } catch (e) {
      setPosts([]);
      setAuthorPhotoById({});
      setLikesCountByPost({});
      setLikedByMeByPost({});
      setSharesCountByPost({});
      setCommentsByPost({});
    } finally {
      setLoading(false);
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
      const maybeDetails = e?.details ? `\n${e.details}` : "";
      const maybeHint = e?.hint ? `\nHint: ${e.hint}` : "";
      const maybeMissingTable = String(e?.message || "").includes("post_likes") || String(e?.message || "").includes("does not exist")
        ? "\nInteraction tables may be missing. Run migration 009 in Supabase SQL Editor."
        : "";
      alert(`Like failed${maybeCode}: ${e?.message || "Unknown error"}${maybeDetails}${maybeHint}${maybeMissingTable}`);
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
      const maybeDetails = e?.details ? `\n${e.details}` : "";
      const maybeHint = e?.hint ? `\nHint: ${e.hint}` : "";
      const maybeMissingTable = String(e?.message || "").includes("post_comments") || String(e?.message || "").includes("does not exist")
        ? "\nInteraction tables may be missing. Run migration 009 in Supabase SQL Editor."
        : "";
      alert(`Comment failed${maybeCode}: ${e?.message || "Unknown error"}${maybeDetails}${maybeHint}${maybeMissingTable}`);
    } finally {
      setInteractionBusyByPost((prev) => ({ ...prev, [postId]: false }));
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
      setPosts((prev) => prev.map((entry) => (entry.id === post.id ? { ...entry, comments_disabled: nextValue } : entry)));
      setOpenPostMenuId(null);
    } catch (e: any) {
      const maybeCode = e?.code ? ` (${e.code})` : "";
      const maybeDetails = e?.details ? `\n${e.details}` : "";
      const maybeHint = e?.hint ? `\nHint: ${e.hint}` : "";
      const message = e?.message || "Unknown error";
      const missingColumnHint = message.includes("comments_disabled") || message.includes("column")
        ? "\n`comments_disabled` may not exist in your live DB yet. Run migration 010 in Supabase SQL Editor."
        : "";
      alert(`Update failed${maybeCode}: ${message}${maybeDetails}${maybeHint}${missingColumnHint}`);
    } finally {
      setInteractionBusyByPost((prev) => ({ ...prev, [post.id]: false }));
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
      setSharesCountByPost((prev) => ({ ...prev, [post.id]: (prev[post.id] || 0) + 1 }));

      const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/home#post-${post.id}` : "";
      if (typeof navigator !== "undefined" && (navigator as any).share && shareUrl) {
        await (navigator as any).share({ title: post.title, text: post.content, url: shareUrl });
      } else if (shareUrl && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        alert("Post link copied to clipboard.");
      }
    } catch (e: any) {
      const maybeCode = e?.code ? ` (${e.code})` : "";
      const maybeDetails = e?.details ? `\n${e.details}` : "";
      const maybeHint = e?.hint ? `\nHint: ${e.hint}` : "";
      const maybeMissingTable = String(e?.message || "").includes("post_shares") || String(e?.message || "").includes("does not exist")
        ? "\nInteraction tables may be missing. Run migration 009 in Supabase SQL Editor."
        : "";
      alert(`Share failed${maybeCode}: ${e?.message || "Unknown error"}${maybeDetails}${maybeHint}${maybeMissingTable}`);
    } finally {
      setInteractionBusyByPost((prev) => ({ ...prev, [post.id]: false }));
    }
  }


  async function handleCreatePost(e: React.FormEvent) {
      // Log session before RPC for debugging
      const { data: { session: debugSession } } = await supabase.auth.getSession();
      console.log("Session before RPC:", debugSession);
    e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
    if (creating) {
      // Prevent double submission
      return;
    }
    setCreating(true);
    // Session/auth gate before post creation
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error("Session error:", sessionError);
      alert("Auth error. Please reload and try again.");
      setCreating(false);
      return;
    }
    if (!session?.user) {
      alert("You must be logged in to create a post.");
      setCreating(false);
      return;
    }
    console.log("Authenticated user id:", session.user.id);
    try {
      let village_member_id: string | null = null;
      if (form.visibility === "village") {
        const { data, error } = await supabase
          .from("village_members")
          .select("id")
          .or(`user_id.eq.${user.id},member_id.eq.${user.id}`)
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        village_member_id = data?.id ?? null;
        if (!village_member_id) {
          alert("Join a village first to post to your village.");
          setCreating(false);
          return;
        }
      }
      // Log scope and village_member_id before RPC
      // Always use 'public' for non-village posts, never 'local', and normalize
      let scope = form.visibility === "village" ? "village" : "public";
      const normalizedScope = scope.trim().toLowerCase();

      // Upload photo if selected
      let photo_url: string | undefined = undefined;
      if (photoFile) {
        const ext = photoFile.name.split('.').pop() || 'jpg';
        const fileName = `${user.id}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('post-photos')
          .upload(fileName, photoFile, { upsert: true });
        if (uploadError) {
          alert('Photo upload failed: ' + uploadError.message);
          setCreating(false);
          return;
        }
        const { data: urlData } = supabase.storage.from('post-photos').getPublicUrl(fileName);
        photo_url = urlData.publicUrl;
      }

      const { data, error } = await createPost({
        ...form,
        author_user_id: user.id,
        author_name: profile?.full_name || "Anonymous",
        scope: normalizedScope as PostScope,
        village_member_id: normalizedScope === "village" ? village_member_id ?? undefined : undefined,
        photo_url,
      });
      // Persistent debug logs for backend feedback
      console.log("RPC error:", error);
      console.log("RPC data:", data);
      console.log("typeof data:", typeof data);
      console.log("isArray:", Array.isArray(data));
      if (error) {
        alert("Post error: " + JSON.stringify(error));
        console.error("createPost RPC error:", error);
      } else {
        console.log("createPost RPC result:", data);
        if (data && data.id) {
          const { data: row, error: selectError } = await supabase
            .from("posts")
            .select("*")
            .eq("id", data.id)
            .maybeSingle();
          if (selectError) alert("Select error: " + JSON.stringify(selectError));
          console.log("select error:", selectError);
          console.log("select row:", row);
        }
        setForm({
          title: "",
          content: "",
          type: "general",
          visibility: "public",
          location: profile?.city ? `${profile.city}${profile.state ? ", " + profile.state : ""}` : "",
        });
        setPhotoFile(null);
        setPhotoPreview(null);
        if (photoInputRef.current) photoInputRef.current.value = '';
        await loadPosts();
        // Only navigate after post is created and loaded
        // router.push('/home'); // TEMP: Commented out to confirm logs appear before navigation
      }
    } catch (e) {
      console.error("Create post error:", e);
      alert("Failed to create post");
    } finally {
      setCreating(false);
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
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900 flex flex-col">
      <div className="max-w-2xl w-full mx-auto p-4 flex-1 flex flex-col pt-8 sm:pt-4">
        <header className="mb-4 flex items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            {profile?.profile_photo_url ? (
              <div className="w-20 h-20 min-w-[5rem] min-h-[5rem] aspect-square rounded-full overflow-hidden border-2 border-pink-400 shadow flex items-center justify-center">
                <img
                  src={profile.profile_photo_url}
                  alt={profile?.full_name || "Profile"}
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
            ) : (
              <div className="w-20 h-20 min-w-[5rem] min-h-[5rem] aspect-square rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white text-3xl font-semibold border-2 border-pink-400 shadow">
                {profile?.full_name?.[0]?.toUpperCase() || "?"}
              </div>
            )}
            <div>
              <Link href="/profile">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 hover:underline cursor-pointer">
                  {profile?.full_name || 'Mom'}
                </h1>
              </Link>
            </div>
          </div>
          {/* Messages button beside profile image */}
          <div className="flex items-center mt-2 sm:mt-0">
            <NavButton href="/messages" icon="chat" label="" className="w-12 h-12 ml-2" />
          </div>
        </header>
        {/* Post creation modal */}
        {showCreateModal && (
          <>
            {/* Backdrop overlay disables all interaction with homepage buttons */}
            <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm pointer-events-auto" aria-hidden="true"></div>
            <div className="fixed inset-0 z-50 flex items-center justify-center animate-fadeIn">
              <div className="relative w-full max-w-md sm:max-w-sm p-4 sm:p-6 md:p-8 rounded-3xl shadow-2xl animate-modalIn bg-white border-2 border-pink-200 mx-2"
                style={{ maxHeight: '95vh', overflowY: 'auto' }}
              >
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="absolute top-3 right-3 text-pink-400 hover:text-pink-600 text-3xl font-bold focus:outline-none focus:ring-2 focus:ring-pink-400"
                  aria-label="Close"
                >
                  &times;
                </button>
                <h2 className="text-2xl font-extrabold mb-4 text-center text-pink-600 tracking-tight">Create a Post</h2>
                <form onSubmit={handleCreatePost} className="flex flex-col gap-4">
                {/* Post Type Tabs */}
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    className={`flex-1 py-2 rounded-lg font-semibold text-lg transition border-2 ${form.type === 'general' ? 'bg-pink-600 text-white border-pink-600 shadow' : 'bg-pink-50 text-pink-700 border-pink-200'}`}
                    onClick={() => setForm(f => ({ ...f, type: 'general' }))}
                    aria-pressed={form.type === 'general'}
                  >
                    General
                  </button>
                  <button
                    type="button"
                    className={`flex-1 py-2 rounded-lg font-semibold text-lg transition border-2 ${form.type === 'support' ? 'bg-pink-600 text-white border-pink-600 shadow' : 'bg-pink-50 text-pink-700 border-pink-200'}`}
                    onClick={() => setForm(f => ({ ...f, type: 'support' }))}
                    aria-pressed={form.type === 'support'}
                  >
                    Support
                  </button>
                </div>
                <div>
                  <label htmlFor="post-title" className="block text-sm font-medium text-pink-700 mb-1">Title</label>
                  <input
                    id="post-title"
                    name="title"
                    className="w-full border border-pink-200 rounded-lg px-4 py-2 bg-pink-50 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-pink-400 transition placeholder-pink-300"
                    placeholder="e.g. Need help with school pickup"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="post-content" className="block text-sm font-medium text-pink-700 mb-1">Content</label>
                  <textarea
                    id="post-content"
                    name="content"
                    className="w-full border border-pink-200 rounded-lg px-4 py-2 bg-pink-50 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-pink-400 transition min-h-[80px] placeholder-pink-300"
                    placeholder="What's on your mind?"
                    value={form.content}
                    onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                    required
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <div>
                    <label htmlFor="post-visibility" className="block text-sm font-medium text-pink-700 mb-1">Visibility</label>
                    <select
                      id="post-visibility"
                      name="visibility"
                      value={form.visibility}
                      onChange={e => setForm(f => ({ ...f, visibility: e.target.value as PostVisibility }))}
                      className="w-full rounded-lg border border-pink-200 px-4 py-2 bg-pink-50 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-pink-400 transition"
                    >
                      <option value="public">Public (visible to all)</option>
                      <option value="village">My Village Only</option>
                    </select>
                  </div>
                  <LocationField
                    profileLocation={profile?.city ? `${profile.city}${profile.state ? ', ' + profile.state : ''}` : ''}
                    formLocation={form.location}
                    setForm={setForm}
                  />
                </div>
                {/* Optional photo upload */}
                <div>
                  <label className="block text-sm font-medium text-pink-700 mb-1">Photo <span className="text-zinc-400 font-normal">(optional)</span></label>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="post-photo-input"
                    onChange={e => {
                      const file = e.target.files?.[0] ?? null;
                      setPhotoFile(file);
                      if (file) {
                        const url = URL.createObjectURL(file);
                        setPhotoPreview(url);
                      } else {
                        setPhotoPreview(null);
                      }
                    }}
                  />
                  {photoPreview ? (
                    <div className="relative mt-1">
                      <img src={photoPreview} alt="Preview" className="w-full rounded-xl object-cover max-h-48 border border-pink-200" />
                      <button
                        type="button"
                        onClick={() => { setPhotoFile(null); setPhotoPreview(null); if (photoInputRef.current) photoInputRef.current.value = ''; }}
                        className="absolute top-2 right-2 bg-white/80 hover:bg-white text-pink-600 rounded-full p-1 text-xs font-bold shadow"
                        aria-label="Remove photo"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="mt-1 w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-pink-200 py-3 text-pink-500 hover:border-pink-400 hover:text-pink-600 transition text-sm font-medium bg-pink-50"
                    >
                      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586A2 2 0 0111.414 11H12m0 0l2-2m0 0l2 2m-2-2v6m6-10a2 2 0 00-2-2H6a2 2 0 00-2 2v2" /></svg>
                      Add a photo
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className="w-full rounded-lg py-3 text-lg font-bold shadow-md bg-rose-500 text-white hover:bg-rose-600 hover:scale-105 transition-transform disabled:opacity-60 mt-2"
                  disabled={creating}
                  onClick={handleCreatePost}
                >
                  {creating ? 'Posting...' : 'Post'}
                </button>
                </form>
              </div>
            </div>
          </>
        )}
              {/* Bottom navigation bar with Search, Post, Notifications */}
              <div className={`fixed bottom-6 left-0 w-full flex items-center justify-center z-40 pointer-events-none ${showCreateModal ? 'opacity-60 select-none pointer-events-none' : ''}`}>
                <div className="flex justify-between items-center w-full max-w-xs mx-auto px-4 pointer-events-auto">
                  <NavButton href="/find-moms" icon="search" label="" className="w-14 h-14 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-2xl flex items-center justify-center" />
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-rose-500 hover:bg-rose-600 text-white rounded-2xl w-20 h-20 flex items-center justify-center shadow-xl border-4 border-white dark:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-rose-300 -mt-6 mx-2"
                    aria-label="Create Post"
                    style={{ zIndex: 2 }}
                    disabled={showCreateModal}
                  >
                    <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth="2" d="M12 5v14m7-7H5"/></svg>
                  </button>
                  <NavButton href="/notifications" icon="alarm" label="" className="w-14 h-14 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-2xl flex items-center justify-center" />
                </div>
              </div>
        {/* Feed type toggle */}
        <div className="flex gap-3 mb-4">
          <button onClick={() => { setFeedType('local'); setSelectedGroupId(null); }} className={`px-5 py-2 rounded-full text-base font-semibold ${feedType === 'local' ? 'bg-rose-500 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200'}`}>Local</button>
          <button onClick={() => { setFeedType('village'); setSelectedGroupId(null); }} className={`px-5 py-2 rounded-full text-base font-semibold ${feedType === 'village' ? 'bg-rose-500 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200'}`}>My Village</button>
          <button onClick={() => { setFeedType('groups'); }} className={`px-5 py-2 rounded-full text-base font-semibold ${feedType === 'groups' ? 'bg-rose-500 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200'}`}>Groups</button>
        </div>
        {/* Feed logic: Local, Village, Groups */}
        <main className="flex-1 overflow-y-auto">
          {feedType === 'groups' ? (
            selectedGroupId ? (
              (() => {
                // ...existing group logic...
                const groupId = selectedGroupId as keyof typeof MOCK_GROUP_POSTS;
                const posts = MOCK_GROUP_POSTS[groupId] || [];
                return (
                  <div>
                    <button
                      className="mb-4 text-pink-600 hover:underline text-sm"
                      onClick={() => setSelectedGroupId(null)}
                    >
                      ← Back to Groups
                    </button>
                    <h2 className="text-xl font-bold mb-2 text-zinc-900 dark:text-zinc-50">
                      {MOCK_GROUPS.find(g => g.id === selectedGroupId)?.name}
                    </h2>
                    {/* TODO: Replace MOCK_GROUP_POSTS with real group posts from backend */}
                    {posts.length === 0 ? (
                      <div className="text-center text-zinc-500 py-8">No posts in this group yet.</div>
                    ) : (
                      posts.map((post: any) => (
                        <div
                          key={post.id}
                          className={`border rounded-xl p-4 mb-4 shadow-sm ${post.type === 'support' ? 'bg-pink-50 border-zinc-200 shadow-[0_6px_18px_rgba(244,114,182,0.22)] dark:bg-pink-950/20 dark:border-zinc-800 dark:shadow-[0_6px_18px_rgba(244,114,182,0.16)]' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}
                        >
                          <div className="flex items-center gap-3 mb-3">
                            {post.author_user_id && authorPhotoById[post.author_user_id] ? (
                              <img
                                src={authorPhotoById[post.author_user_id]}
                                alt={post.author_name || 'Mom'}
                                className="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 text-white flex items-center justify-center font-semibold border border-pink-300">
                                {(post.author_name || 'M').charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-semibold text-zinc-900 dark:text-zinc-50 truncate">{post.author_name || 'Mom'}</div>
                              <div className="text-xs text-zinc-500 dark:text-zinc-400">{new Date(post.created_at).toLocaleString()}</div>
                            </div>
                          </div>
                          {post.photo_url && (
                            <img
                              src={post.photo_url}
                              alt="Post photo"
                              className="w-full rounded-xl object-cover max-h-72 mb-2 border border-zinc-100 dark:border-zinc-800"
                            />
                          )}
                          <div className="font-bold text-lg mb-1">{post.title}</div>
                          <div className="text-zinc-700 dark:text-zinc-200 whitespace-pre-line">{post.content}</div>
                        </div>
                      ))
                    )}
                  </div>
                );
              })()
            ) : (
              <div>
                <h2 className="text-xl font-bold mb-4 text-zinc-900 dark:text-zinc-50">Your Groups</h2>
                {/* TODO: Replace MOCK_GROUPS with real groups from backend */}
                <div className="grid gap-3">
                  {MOCK_GROUPS.map(group => (
                    <button
                      key={group.id}
                      className="w-full text-left bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm hover:bg-pink-50 dark:hover:bg-pink-900/20 transition"
                      onClick={() => setSelectedGroupId(group.id)}
                    >
                      <span className="font-semibold text-zinc-900 dark:text-zinc-50">{group.name}</span>
                    </button>
                  ))}
                </div>
                <div className="text-xs text-zinc-500 mt-4">(TODO: Show real groups and allow joining/leaving groups)</div>
              </div>
            )
          ) : loading ? (
            <div className="text-center text-zinc-500 py-8">Loading feed...</div>
          ) : posts.length === 0 ? (
            <div className="text-center text-zinc-500 py-8">No posts yet. Be the first to post!</div>
          ) : (
            <>
              {posts.map(post => (
                <div
                  key={post.id}
                  id={`post-${post.id}`}
                  className={`border rounded-xl p-4 mb-4 shadow-sm ${post.type === 'support' ? 'bg-pink-50 border-zinc-200 shadow-[0_6px_18px_rgba(244,114,182,0.22)] dark:bg-pink-950/20 dark:border-zinc-800 dark:shadow-[0_6px_18px_rgba(244,114,182,0.16)]' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {authorPhotoById[post.author_user_id] ? (
                        <img
                          src={authorPhotoById[post.author_user_id]}
                          alt={post.author_name || 'Mom'}
                          className="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 text-white flex items-center justify-center font-semibold border border-pink-300">
                          {(post.author_name || 'M').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-50 truncate">{post.author_name || 'Mom'}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">{new Date(post.created_at).toLocaleString()}</div>
                      </div>
                    </div>

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
                  <div className="text-zinc-700 dark:text-zinc-200 whitespace-pre-line">{post.content}</div>

                  <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-3 text-sm">
                    <button
                      type="button"
                      disabled={!!interactionBusyByPost[post.id]}
                      onClick={() => handleToggleLike(post.id)}
                      className={`px-3 py-1 rounded-full border transition ${likedByMeByPost[post.id] ? 'bg-pink-100 text-pink-700 border-pink-300 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700' : 'bg-white text-zinc-700 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700'}`}
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
                    {(commentsByPost[post.id] || []).map((comment) => (
                      <div key={comment.id} className="text-sm bg-zinc-50 dark:bg-zinc-800/60 rounded-lg px-3 py-2 border border-zinc-200 dark:border-zinc-700">
                        <span className="font-semibold text-zinc-800 dark:text-zinc-100 mr-2">{comment.author_user_id === user?.id ? 'You' : 'Mom'}</span>
                        <span className="text-zinc-700 dark:text-zinc-200">{comment.body}</span>
                      </div>
                    ))}
                    {post.comments_disabled ? (
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 px-1">Comments are disabled by the post owner.</div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={commentDraftByPost[post.id] || ''}
                          onChange={(e) => setCommentDraftByPost((prev) => ({ ...prev, [post.id]: e.target.value }))}
                          placeholder="Write a comment..."
                          className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm"
                        />
                        <button
                          type="button"
                          disabled={!!interactionBusyByPost[post.id]}
                          onClick={() => handleAddComment(post.id)}
                          className="px-3 py-2 rounded-lg bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 disabled:opacity-60"
                        >
                          Comment
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </main>
      </div>
    </div>
  );

//

// Ensure handleCreatePost is defined as:
// async function handleCreatePost() {
//   setCreating(true);
//   try {
//     await createPost({
//       ...form,
//       author_id: user.id,
//       author_name: profile?.full_name || 'Anonymous',
//       type: 'general', // default type
//       scope: form.visibility === 'village' ? 'village' : 'local', // derive scope from visibility
//     });
//     setForm({
//       title: '',
//       content: '',
//       visibility: 'public',
//       location: profile?.city ? `${profile.city}${profile.state ? ', ' + profile.state : ''}` : '',
//     });
//     await loadPosts();
//   } catch (e) {
//     alert('Failed to create post');
//   } finally {
//     setCreating(false);
//   }
// }

// Remove stray button/svg JSX outside of any component.

// ...existing code...
}

function NavButton({ href, icon, label, className = "" }: { href: string; icon: 'user' | 'chat' | 'search' | 'plus' | 'alarm'; label?: string; className?: string }) {
  const isIconOnly = !label;
  // Highlight if the button's href matches the current path (for main nav pages)
  const pathname = usePathname ? usePathname() : undefined;
  const isActive = pathname && (pathname === href || (href === "/find-moms" && pathname.startsWith("/find-moms")) || (href === "/messages" && pathname.startsWith("/messages")) || (href === "/notifications" && pathname.startsWith("/notifications")));
  // Add pink highlight if active
  const activeClass = isActive ? "bg-pink-600 text-white border-pink-600 dark:bg-pink-700 dark:border-pink-700" : "";
  const iconMap: Record<string, JSX.Element> = {
    user: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-7 h-7"><circle cx="12" cy="8" r="4" strokeWidth="1.5"/><path strokeWidth="1.5" d="M4 20c0-2.5 3.5-4 8-4s8 1.5 8 4"/></svg>
    ),
    chat: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-7 h-7"><path strokeWidth="1.5" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    ),
    search: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-7 h-7"><circle cx="11" cy="11" r="7" strokeWidth="1.5"/><path strokeWidth="1.5" d="M21 21l-4.35-4.35"/></svg>
    ),
    plus: (
      <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-8 h-8"><path strokeWidth="2" d="M12 5v14m7-7H5"/></svg>
    ),
    alarm: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-7 h-7">
        <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9Z" />
        <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M4 17h16" />
        <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  };
  return (
    <Link
      href={href}
      className={`flex items-center justify-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-2xl w-12 h-12 hover:bg-pink-50 dark:hover:bg-pink-900/30 transition-all focus:outline-none focus:ring-2 focus:ring-pink-400 active:scale-95 active:ring-4 active:ring-pink-300 ${activeClass} ${className}`}
      aria-label={label || icon}
    >
      {iconMap[icon]}
      {!isIconOnly && label}
    </Link>
  );
}
