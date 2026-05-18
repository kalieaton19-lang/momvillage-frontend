"use client";


import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { getPostsCount } from "../../../utils";
import { fetchPosts } from "../../../lib/posts";
import type { Post } from "../../../types/post";

export default function ProfilePage() {
  const { id } = useParams();
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [inviteStatus, setInviteStatus] = useState<"in-village"|"invited-by-me"|"invited-me"|"none">("none");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [villageMembers, setVillageMembers] = useState<any[]>([]);
  const [postsCount, setPostsCount] = useState<number | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [showVillageModal, setShowVillageModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removeLoading, setRemoveLoading] = useState(false);

  // (All logic and hooks are now inside the component)

  // Fetch profile info and posts count
  useEffect(() => {
    async function fetchProfile() {
      setLoading(true);
      setError("");
      const { data, error } = await supabase
        .from("user_public_profiles")
        .select("id, full_name, profile_photo_url, city, state, is_public, number_of_kids, kids_age_groups, parenting_style, bio")
        .eq("id", id)
        .single();
      if (error) {
        setError("Profile not found.");
        setProfile(null);
      } else {
        setProfile(data);
        getPostsCount(data.id).then(count => setPostsCount(count));
        fetchPosts({ author_user_id: data.id }).then(setPosts).catch(() => setPosts([]));
      }
      setLoading(false);
    }
    if (id) fetchProfile();
  }, [id]);

  // Fetch current user and invitation/village status
  useEffect(() => {
    async function fetchStatus() {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      if (!user || !id || user.id === id) return;
      // Check if in village
      const { data: members } = await supabase
        .from("village_invitations")
        .select("id, from_user_id, to_user_id, status")
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .eq("status", "accepted");
      const inVillage = (members ?? []).some((m: any) => (m.from_user_id === id || m.to_user_id === id));
      if (inVillage) {
        setInviteStatus("in-village");
        return;
      }
      // Check if invitation sent by me
      const { data: sentInvites } = await supabase
        .from("village_invitations")
        .select("id, status")
        .eq("from_user_id", user.id)
        .eq("to_user_id", id)
        .order("created_at", { ascending: false });
      if ((sentInvites ?? []).some((i: any) => i.status === "pending" || i.status === "resent")) {
        setInviteStatus("invited-by-me");
        return;
      }
      // Check if invitation sent to me
      const { data: receivedInvites } = await supabase
        .from("village_invitations")
        .select("id, status")
        .eq("from_user_id", id)
        .eq("to_user_id", user.id)
        .order("created_at", { ascending: false });
      if ((receivedInvites ?? []).some((i: any) => i.status === "pending" || i.status === "resent")) {
        setInviteStatus("invited-me");
        return;
      }
      setInviteStatus("none");
    }
    fetchStatus();
  }, [id]);

  // Fetch this user's village members
  useEffect(() => {
    async function fetchVillage() {
      if (!id) return;
      // Find all accepted invitations where this user is sender or recipient
      const { data: invites } = await supabase
        .from("village_invitations")
        .select("from_user_id, to_user_id, status")
        .or(`from_user_id.eq.${id},to_user_id.eq.${id}`)
        .eq("status", "accepted");
      const memberIds = [...new Set((invites ?? []).map((invite: any) => (
        invite.from_user_id === id ? invite.to_user_id : invite.from_user_id
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
  }, [id]);

  async function handleInvite() {
    if (!currentUser || !id) return;
    const targetUserId = Array.isArray(id) ? id[0] : id;
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
        <div className="w-full flex flex-row items-stretch gap-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 sm:px-10 pt-6 pb-4">
          {/* Profile Photo */}
          {profile.profile_photo_url ? (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-pink-400 shadow flex-shrink-0">
              <img src={profile.profile_photo_url} alt={profile.full_name || 'Profile'} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white text-2xl sm:text-3xl font-bold border-2 border-pink-400 shadow flex-shrink-0">
              {profile.full_name?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          {/* Profile Info */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-1 w-full">
              <span className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-zinc-50 truncate w-full text-left">{profile.full_name || 'Mom'}</span>
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
        {currentUser && currentUser.id !== id && (
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
                                    .or(`and(from_user_id.eq.${currentUser.id},to_user_id.eq.${id}),and(from_user_id.eq.${id},to_user_id.eq.${currentUser.id})`);
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
              className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-semibold text-base transition-colors whitespace-nowrap"
              onClick={async () => {
                // Find or create conversation between currentUser and profile user
                if (!currentUser || !id) return;
                let conversationId = null;
                const { data: existingConvos, error: convoError } = await supabase
                  .from("conversations")
                  .select("id,user1_id,user2_id")
                  .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${id}),and(user1_id.eq.${id},user2_id.eq.${currentUser.id})`)
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
                      user2_id: id,
                      user1_name: currentUser.user_metadata?.full_name || "",
                      user2_name: profile.full_name || "",
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
                <div key={post.id} className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl shadow p-4">
                  <div className="font-bold text-pink-700 mb-1">{post.title}</div>
                  <div className="text-zinc-700 dark:text-zinc-200 mb-2">{post.content}</div>
                  <div className="text-xs text-zinc-400">{new Date(post.created_at).toLocaleString()}</div>
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
    </div>
  );
}

