"use client";


import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

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
  const [showVillageModal, setShowVillageModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removeLoading, setRemoveLoading] = useState(false);

  // (All logic and hooks are now inside the component)

  // Fetch profile info
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
    setInviteLoading(true);
    try {
      const { error } = await supabase
        .from("village_invitations")
        .insert({ from_user_id: currentUser.id, to_user_id: id, status: "pending" });
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
    <div className="max-w-xl mx-auto p-8">
      <div className="flex flex-col items-center">
        {profile.profile_photo_url ? (
          <img src={profile.profile_photo_url} alt={profile.full_name} className="w-32 h-32 rounded-full object-cover mb-4" />
        ) : (
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-bold text-4xl mb-4">
            {profile.full_name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <h1 className="text-3xl font-bold mb-1">{profile.full_name}</h1>
        {/* Village count directly under name */}
        <div className="flex items-center gap-4 mb-3">
          <button
            className="flex flex-col items-center focus:outline-none"
            onClick={() => setShowVillageModal(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <span className="text-2xl font-extrabold text-pink-600 leading-none">{villageMembers.length}</span>
            <span className="text-xs text-zinc-500 mt-1 tracking-wide uppercase">{profile.full_name.split(" ")[0]}'s Village</span>
          </button>
          {/* Status badge/button */}
          {currentUser && currentUser.id !== id && (
            <div className="ml-1">
              {inviteStatus === "in-village" && (
                <button
                  className="inline-block bg-green-100 text-green-800 px-4 py-2 rounded-full text-base font-semibold whitespace-nowrap hover:bg-green-200 transition-colors focus:outline-none"
                  onClick={() => setShowRemoveModal(true)}
                  type="button"
                >
                  In Your Village
                </button>
              )}
                      {/* Remove from village modal */}
                      {showRemoveModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 max-w-sm w-full shadow-xl relative">
                            <button className="absolute top-2 right-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 text-2xl" onClick={() => setShowRemoveModal(false)}>&times;</button>
                            <h2 className="text-lg font-bold mb-4">Remove from Your Village?</h2>
                            <p className="mb-6 text-zinc-700 dark:text-zinc-300">Are you sure you want to remove {profile.full_name.split(" ")[0]} from your village?</p>
                            <div className="flex gap-4">
                              <button
                                className="flex-1 px-4 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 rounded-lg font-semibold"
                                onClick={() => setShowRemoveModal(false)}
                                disabled={removeLoading}
                              >
                                Cancel
                              </button>
                              <button
                                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold"
                                onClick={async () => {
                                  setRemoveLoading(true);
                                  try {
                                    // Remove the accepted invitation (either direction)
                                    const { data: { user } } = await supabase.auth.getUser();
                                    if (!user) throw new Error("Not authenticated");
                                    await supabase
                                      .from("village_invitations")
                                      .delete()
                                      .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${id},status.eq.accepted),and(from_user_id.eq.${id},to_user_id.eq.${user.id},status.eq.accepted)`);
                                    setInviteStatus("none");
                                    setShowRemoveModal(false);
                                  } catch (e) {
                                    alert("Failed to remove from village.");
                                  } finally {
                                    setRemoveLoading(false);
                                  }
                                }}
                                disabled={removeLoading}
                              >
                                {removeLoading ? "Removing..." : "Remove"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
              {inviteStatus === "invited-by-me" && (
                <span className="inline-block bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full text-base font-semibold whitespace-nowrap">Invitation Sent</span>
              )}
              {inviteStatus === "invited-me" && (
                <span className="inline-block bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-base font-semibold whitespace-nowrap">Invited You</span>
              )}
              {inviteStatus === "none" && (
                <button
                  className="inline-block bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-full text-base font-semibold whitespace-nowrap transition-colors"
                  onClick={handleInvite}
                  disabled={inviteLoading}
                >
                  {inviteLoading ? "Sending..." : "Invite to Village"}
                </button>
              )}
            </div>
          )}
        </div>
        {/* Send a Message Button */}
        {currentUser && currentUser.id !== id && (
          <div className="w-full max-w-xs mx-auto mb-3">
            <button
              className="w-full px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-semibold text-base transition-colors"
              onClick={async () => {
                // Find or create conversation between currentUser and profile user
                if (!currentUser || !id) return;
                // 1. Try to find existing conversation
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
                  // 2. Create new conversation
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
                // 3. Navigate to messages page with conversation param
                router.push(`/messages?conversation=${conversationId}`);
              }}
            >
              Send a Message
            </button>
          </div>
        )}
        <div className="text-zinc-600 dark:text-zinc-400 mb-2">{profile.city}{profile.city && profile.state ? ', ' : ''}{profile.state}</div>
        {/* Kids & Parenting Info */}
        <div className="w-full max-w-xs mx-auto mt-2 mb-2 space-y-1">
          {profile.number_of_kids && (
            <div className="text-sm text-zinc-700 dark:text-zinc-300"><span className="font-semibold">Number of kids:</span> {profile.number_of_kids}</div>
          )}
          {profile.kids_age_groups && (
            <div className="text-sm text-zinc-700 dark:text-zinc-300"><span className="font-semibold">Kids' ages:</span> {Array.isArray(profile.kids_age_groups) ? profile.kids_age_groups.join(", ") : String(profile.kids_age_groups)}</div>
          )}
          {profile.parenting_style && (
            <div className="text-sm text-zinc-700 dark:text-zinc-300"><span className="font-semibold">Parenting style:</span> {profile.parenting_style}</div>
          )}
        </div>
        {/* Bio */}
        {profile.bio && (
          <div className="w-full max-w-xs mx-auto mt-2 mb-2">
            <div className="font-semibold text-zinc-800 dark:text-zinc-100 mb-1">Bio</div>
            <div className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-line">{profile.bio}</div>
          </div>
        )}
        {/* Status badge/button moved next to village count */}
        {/* Village modal trigger moved above */}
        {/* Modal for village members */}
        {showVillageModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 max-w-sm w-full shadow-xl relative">
              <button className="absolute top-2 right-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 text-2xl" onClick={() => setShowVillageModal(false)}>&times;</button>
              <h2 className="text-lg font-bold mb-4">{profile.full_name.split(" ")[0]}'s Village Members</h2>
              {villageMembers.length === 0 ? (
                <div className="text-zinc-500">No members yet.</div>
              ) : (
                <div className="space-y-3">
                  {villageMembers.map((m: any) => (
                    <div key={m.id} className="flex items-center gap-3">
                      {m.profile_photo_url ? (
                        <img src={m.profile_photo_url} alt={m.full_name} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-bold text-lg">
                          {m.full_name?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                      <span className="font-medium">{m.full_name}</span>
                      <span className="text-xs text-zinc-500">{m.city}{m.city && m.state ? ', ' : ''}{m.state}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {/* User ID intentionally hidden */}
      </div>
    </div>

  );
}

