"use client";
import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";



// InviteByNameForm component
function InviteByNameForm({ onBack, onSelect }: { onBack: () => void; onSelect: (user: any) => void }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  // ...existing InviteByNameForm code...
  // (Assume this is correct and unchanged)
}

export default function VillagePage() {
  const [activeTab, setActiveTab] = useState("invite");
  const [inviteMode, setInviteMode] = useState<"none" | "conversations" | "name">("none");
  const [user, setUser] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [selectedMom, setSelectedMom] = useState<any>(null);
  const [selectedMomInvitation, setSelectedMomInvitation] = useState<any>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [sendingInviteId, setSendingInviteId] = useState<string | null>(null);
  const [inviteBanner, setInviteBanner] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
    };
    fetchUser();
  }, []);

  // Handler for inviting a mom
  const handleInviteMom = async () => {
    if (!user || !selectedMom) return;
    setSendingInviteId(selectedMom.id);
    try {
      // ...invitation logic...
      setInviteBanner(`Invitation sent to ${selectedMom.name}!`);
      setShowProfileModal(false);
    } catch (e) {
      setInviteBanner(`Failed to send invitation: ${e?.message || e}`);
    }
    setSendingInviteId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Place all tab logic, InviteByNameForm, modal, etc. here, inside this div. */}
      </div>
    </div>
  );
}


  // Fetch accepted village members for the current user
  async function fetchVillageMembers() {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;
      // Fetch all accepted invitations where user is sender or recipient
      const { data: invites, error: invitesError } = await supabase
        .from("village_invitations")
        .select("id, from_user_id, to_user_id, status")
        .or(`from_user_id.eq.${currentUser.id},to_user_id.eq.${currentUser.id}`)
        .eq("status", "accepted");
      if (invitesError) throw invitesError;
      // Get the other user's IDs
      const memberIds = [...new Set((invites ?? []).map((invite: any) => (
        invite.from_user_id === currentUser.id ? invite.to_user_id : invite.from_user_id
      )))];
      if (memberIds.length === 0) {
        setVillageMembers([]);
        return;
      }
      // Fetch their profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("user_public_profiles")
        .select("id, full_name, profile_photo_url, city, state, is_public")
        .in("id", memberIds);
      if (profilesError) throw profilesError;
      setVillageMembers(profiles ?? []);
    } catch (e) {
      setVillageMembers([]);
    }
  }

  async function fetchUserAndConversations() {
    setLoadingConversations(true);
    try {
      const { data: { user: currentUser }, error } = await supabase.auth.getUser();
      if (!currentUser) return;
      setUser(currentUser); // Ensure user is always set
      // Fetch conversations for this user
      const { data, error: convError } = await supabase
        .from("conversations")
        .select("*")
        .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`)
        .order("updated_at", { ascending: false });
      if (!convError && data) {
        setConversations(data);
      }
    } catch (e) {
      setConversations([]);
    } finally {
      setLoadingConversations(false);
    }
  }

  async function fetchUserAndInvitations() {
    setLoadingInvitations(true);
    try {
      const { data: { user: currentUser }, error } = await supabase.auth.getUser();
      if (!currentUser) return;
      setUser(currentUser);
      // Debug: Log currentUser.id
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line no-console
        console.log('[DEBUG] currentUser.id:', currentUser.id);
      }
      // Step 1: Fetch invitations
      const { data: invites, error: invitesError } = await supabase
        .from("village_invitations")
        .select("id, from_user_id, to_user_id, status, created_at")
        .or(`from_user_id.eq.${currentUser.id},to_user_id.eq.${currentUser.id}`)
        .order("created_at", { ascending: false });
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line no-console
        console.log('[DEBUG] invites.length:', invites?.length);
        // eslint-disable-next-line no-console
        console.log('[DEBUG] sample invites:', (invites ?? []).slice(0, 3));
      }
      if (invitesError) throw invitesError;
      // Step 2: Collect 'other' user ids
      const otherIds = [...new Set((invites ?? []).map((invite: any) => (
        invite.from_user_id === currentUser.id ? invite.to_user_id : invite.from_user_id
      )))];
      // Step 3: Fetch profiles for 'other' users
      const { data: profiles, error: profilesError } = await supabase
        .from("user_public_profiles")
        .select("id, full_name, profile_photo_url, city, state, is_public")
        .in("id", otherIds);
      if (profilesError) throw profilesError;
      const profileById = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      // Step 4: Merge into invitations, clarify sender/recipient
      // Always show invitations for both sender and recipient
      const invitationsWithOther = (invites ?? []).map((invite: any) => {
        const isSender = invite.from_user_id === currentUser.id;
        const isRecipient = invite.to_user_id === currentUser.id;
        if (typeof window !== 'undefined') {
          // eslint-disable-next-line no-console
          console.log('[DEBUG] invite row:', {
            id: invite.id,
            from_user_id: invite.from_user_id,
            to_user_id: invite.to_user_id,
            isSender,
            isRecipient
          });
        }
        // Show the other user (not yourself)
        let otherUserId = isSender ? invite.to_user_id : invite.from_user_id;
        // If somehow the other user is yourself (shouldn't happen), fallback to the other id
        if (otherUserId === currentUser.id) {
          otherUserId = isSender ? invite.from_user_id : invite.to_user_id;
        }
        const otherProfile = profileById.get(otherUserId) as any;
        return {
          ...invite,
          isSender,
          isRecipient,
          other: {
            id: otherUserId,
            name: otherProfile?.full_name ?? null,
            photoUrl: otherProfile?.profile_photo_url ?? null,
            city: otherProfile?.city ?? null,
            state: otherProfile?.state ?? null,
          },
        };
      });
      setInvitationsWithOther(invitationsWithOther);
    } catch (e) {
      setInvitationsWithOther([]);
    } finally {
      setLoadingInvitations(false);
    }
  }

  // Direction-agnostic send/resend logic: only allow one resend, and do not allow resending if already resent, accepted, or declined
  async function handleInviteMom() {
    if (!user || !selectedMom) return;
    setSendingInviteId(selectedMom.id);
    try {
      const fromUserId = user.id;
      const toUserId = selectedMom.id;
      if (typeof window !== 'undefined') {
        console.log('[DEBUG] handleInviteMom fromUserId:', fromUserId, 'toUserId:', toUserId);
      }
      if (fromUserId === toUserId) {
        setInviteBanner("You cannot invite yourself.");
        setSendingInviteId(null);
        return;
      }
      const low = fromUserId < toUserId ? fromUserId : toUserId;
      const high = fromUserId < toUserId ? toUserId : fromUserId;
      // Check for existing invitation (direction-agnostic)
      const { data: existing, error: findError } = await supabase
        .from("village_invitations")
        .select("id, status, from_user_id, to_user_id")
        .eq("from_to_low", low)
        .eq("from_to_high", high)
        .maybeSingle();
      if (findError) throw findError;
      if (existing) {
        // Only allow resend if status is 'pending' and user is the sender, and only allow one resend
        if (existing.status === 'pending' && existing.from_user_id === fromUserId) {
          const { error: updateError } = await supabase
            .from("village_invitations")
            .update({ status: "resent" })
            .eq("id", existing.id)
            .eq("status", "pending");
          if (updateError) throw updateError;
          setInviteBanner("Resent invitation!");
          await fetchUserAndInvitations();
        } else if (existing.status === 'resent') {
          setInviteBanner("You can only resend once.");
        } else if (existing.status === 'accepted') {
          setInviteBanner("This invitation has already been accepted.");
        } else if (existing.status === 'declined') {
          setInviteBanner("This invitation was declined.");
        } else {
          setInviteBanner("Cannot resend invitation.");
        }
        setShowProfileModal(false);
        await fetchUserAndInvitations();
      } else {
        // No existing invitation, create new
        if (typeof window !== 'undefined') {
          console.log('[DEBUG] Inserting invitation:', { from_user_id: fromUserId, to_user_id: toUserId, status: 'pending' });
        }
        const { error: insertError } = await supabase
          .from("village_invitations")
          .insert({
            from_user_id: fromUserId,
            to_user_id: toUserId,
            status: "pending",
          });
        if (insertError) {
          // If unique constraint violation, refresh invitations so user sees the existing invite
          if (insertError.code === '23505') {
            setInviteBanner('An invitation already exists.');
            setShowProfileModal(false);
            await fetchUserAndInvitations();
            return;
          }
          throw insertError;
        }
        setInviteBanner(`Invitation sent to ${selectedMom.name}!`);
        setShowProfileModal(false);
        await fetchUserAndInvitations();
      }
    } catch (e: any) {
      setInviteBanner(`Failed to send invitation: ${e?.message || e}`);
    } finally {
      setSendingInviteId(null);
    }
  }

  // Debug: Show session and user info
  async function handleDebugSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    // eslint-disable-next-line no-console
    console.log('[DEBUG] Supabase session:', session);
    // eslint-disable-next-line no-console
    console.log('[DEBUG] user state:', user);
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('supabase.auth.token');
        if (raw) {
          const parsed = JSON.parse(raw);
          // eslint-disable-next-line no-console
          console.log('[DEBUG] localStorage supabase.auth.token:', parsed);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log('[DEBUG] Could not parse supabase.auth.token from localStorage');
      }
    }
    if (error) {
      // eslint-disable-next-line no-console
      console.log('[DEBUG] Error from supabase.auth.getSession:', error);
    }
    alert('Check the console for session and user debug info.');
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Back to Home Button */}
        <a
          href="/home"
          className="inline-flex items-center gap-2 px-4 py-2 mb-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-lg shadow hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors font-medium"
        >
          <span aria-hidden="true">←</span> Back to Home
        </a>
        {/* Debug Button */}
        <button
          onClick={handleDebugSession}
          className="fixed top-4 right-4 z-50 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black rounded-lg shadow font-mono text-xs"
          style={{ opacity: 0.85 }}
        >
          Debug Session
        </button>
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">My Village 🏘️</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Your circle of mom support and friendship
          </p>
        </header>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
          <button
            onClick={() => setActiveTab('members')}
            className={`px-4 py-2 font-medium text-sm transition-colors whitespace-nowrap ${
              activeTab === 'members'
                ? 'text-pink-600 dark:text-pink-400 border-b-2 border-pink-600 dark:border-pink-400'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50'
            }`}
          >
            Members
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`px-4 py-2 font-medium text-sm transition-colors whitespace-nowrap ${
              activeTab === 'invitations'
                ? 'text-pink-600 dark:text-pink-400 border-b-2 border-pink-600 dark:border-pink-400'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50'
            }`}
          >
            Invitations
          </button>
          <button
            onClick={() => setActiveTab('invite')}
            className={`px-4 py-2 font-medium text-sm transition-colors whitespace-nowrap ${
              activeTab === 'invite'
                ? 'text-pink-600 dark:text-pink-400 border-b-2 border-pink-600 dark:border-pink-400'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50'
            }`}
          >
            Invite a Mom
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'members' && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-3">🏘️</div>
            <h2 className="text-lg font-bold mb-4">Your Village Members</h2>
            {villageMembers.length === 0 ? (
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">No members yet. Accepted invitations will appear here.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {villageMembers.map((member: any) => (
                  <div key={member.id} className="flex items-center gap-4 p-4 border rounded-xl bg-pink-50 dark:bg-pink-900/20">
                    {member.profile_photo_url ? (
                      <img src={member.profile_photo_url} alt={member.full_name} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-semibold text-xl">
                        {member.full_name?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div className="text-left">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-50">{member.full_name}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">{member.city}{member.city && member.state ? ', ' : ''}{member.state}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'invitations' && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
            <div className="text-4xl mb-3">📬</div>
            <h2 className="text-lg font-bold mb-4">Your Invitations</h2>
            {loadingInvitations ? (
              <div className="text-zinc-500">Loading invitations...</div>
            ) : invitationsWithOther.length === 0 ? (
              <div className="text-zinc-500">No invitations found.</div>
            ) : (
              <div className="space-y-4">
                {invitationsWithOther.map(invite => (
                  <div
                    key={invite.id}
                    className={
                      'flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border rounded-xl ' +
                      (invite.status === 'accepted'
                        ? 'bg-pink-100 dark:bg-pink-900 border-pink-400 dark:border-pink-600'
                        : invite.status === 'declined'
                        ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700'
                        : 'bg-zinc-50 dark:bg-zinc-800')
                    }
                  >
                    <div className="flex items-center gap-3 text-left" style={{ minWidth: 0 }}>
                      {invite.other.photoUrl ? (
                        <div className="w-12 h-12 flex-shrink-0">
                          <img src={invite.other.photoUrl} alt={invite.other.name} className="w-12 h-12 rounded-full object-cover shrink-0" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-semibold text-xl flex-shrink-0">
                          {invite.other.name?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-zinc-900 dark:text-zinc-50">
                          {invite.other.name || invite.other.id}
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {invite.status === 'pending' ? 'Pending invitation' : invite.status.charAt(0).toUpperCase() + invite.status.slice(1)}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-row gap-2 items-center justify-end w-full">
                      {/* Pending: Accept/Decline for recipient */}
                      {invite.status === 'pending' && invite.isRecipient && !invite.isSender && (
                        <div className="flex gap-2">
                          <button
                            className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-colors"
                            onClick={async () => {
                              // Accept invitation: update status to 'accepted'
                              try {
                                await supabase
                                  .from("village_invitations")
                                  .update({ status: "accepted" })
                                  .eq("id", invite.id)
                                  .eq("status", "pending");
                                setInviteBanner(`Accepted invitation from ${invite.other.name || invite.other.id}`);
                                await fetchUserAndInvitations();
                              } catch (e) {
                                setInviteBanner('Failed to accept invitation.');
                              }
                            }}
                          >
                            Accept
                          </button>
                          <button className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors" onClick={() => {/* TODO: Decline logic */}}>Decline</button>
                        </div>
                      )}
                      {/* Pending: Resend for sender */}
                      {invite.status === 'pending' && invite.isSender && (
                        <div className="flex items-center gap-2 w-full justify-center">
                          <span className="text-base text-pink-600 font-light text-center">Invitation sent</span>
                          <button
                            className="px-4 py-2 bg-pink-100 hover:bg-pink-200 text-pink-700 rounded-lg border border-pink-300 transition-colors"
                            onClick={async () => {
                              setSendingInviteId(invite.other.id);
                              try {
                                const fromUserId = user.id;
                                const toUserId = invite.other.id;
                                const low = fromUserId < toUserId ? fromUserId : toUserId;
                                const high = fromUserId < toUserId ? toUserId : fromUserId;
                                // Extra debug: log all invitations before update
                                const { data: allInvites } = await supabase
                                  .from("village_invitations")
                                  .select("id, status, from_user_id, to_user_id");
                                if (typeof window !== 'undefined') {
                                  console.log('[DEBUG][Resend] All invites before update:', allInvites);
                                }
                                const { data: existing, error: findError } = await supabase
                                  .from("village_invitations")
                                  .select("id, status, from_user_id, to_user_id")
                                  .eq("from_to_low", low)
                                  .eq("from_to_high", high)
                                  .maybeSingle();
                                console.log('[DEBUG][Resend] Existing before update:', existing);
                                if (findError) throw findError;
                                if (!existing || !existing.id) throw new Error("Invitation not found");
                                // Only allow resend if status is 'pending' (client-side check)
                                if (existing.status !== 'pending') {
                                  setInviteBanner("You can only resend a pending invitation.");
                                  await fetchUserAndInvitations();
                                  return;
                                }
                                // Update by id only, robust error handling
                                const { data: updated, error: updateError } = await supabase
                                  .from("village_invitations")
                                  .update({ status: "resent" })
                                  .eq("id", existing.id)
                                  .select()
                                  .single();
                                console.log('[DEBUG][Resend] Update result:', updated, updateError);
                                if (updateError) throw updateError;
                                if (!updated) throw new Error("Invitation not found / not updated");
                                setInviteBanner("Resent invitation!");
                                await fetchUserAndInvitations();
                              } catch (e: any) {
                                setInviteBanner(`Failed to resend invitation: ${e?.message || e}`);
                              } finally {
                                setSendingInviteId(null);
                              }
                            }}
                            disabled={sendingInviteId === invite.other.id || invite.status !== 'pending'}
                          >
                            {sendingInviteId === invite.other.id ? 'Resending...' : 'Resend invite'}
                          </button>
                        </div>
                      )}
                      {/* Resent: show button for sender */}
                      {invite.status === 'resent' && invite.isSender && (
                        <button
                          className="px-4 py-2 bg-pink-700 text-white rounded-lg border border-pink-800 font-semibold cursor-default"
                          tabIndex={-1}
                          disabled
                        >
                          Resent
                        </button>
                      )}
                      {/* Accepted: show label */}
                      {invite.status === 'accepted' && (
                        <span className="text-pink-600 font-semibold">Accepted</span>
                      )}
                      {/* Declined: show button */}
                      {invite.status === 'declined' && (
                        <button
                          className="px-4 py-2 bg-zinc-400 text-white rounded-lg border border-zinc-500 font-semibold cursor-default"
                          tabIndex={-1}
                          disabled
                        >
                          Declined
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'invite' && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-3">🤝</div>
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">Invite a mom to your village.</p>
            {inviteMode === 'none' && (
              <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6 mb-4">
                <button
                  className="flex-1 px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white font-medium rounded-lg transition-all"
                  onClick={() => setInviteMode('conversations')}
                >
                  💬 Invite from Conversations
                </button>
                <button
                  className="flex-1 px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-all"
                  onClick={() => setInviteMode('name')}
                >
                  🔍 Invite by Name
                </button>
              </div>
            )}


            {inviteMode === 'conversations' && (
              <div className="mt-6">
                <h2 className="text-lg font-bold mb-4">Select a Mom from Your Conversations</h2>
                {loadingConversations ? (
                  <div className="text-zinc-500">Loading conversations...</div>
                ) : conversations.length === 0 ? (
                  <div className="text-zinc-500">No conversations found.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    {conversations.map((conv) => {
                      // Enhanced debug log for diagnosis
                      if (typeof window !== 'undefined') {
                        console.log('[DEBUG] user.id:', user?.id, 'type:', typeof user?.id);
                        // Add session.user.id log
                        try {
                          const session = JSON.parse(localStorage.getItem('supabase.auth.token') || '{}');
                          const sessionUserId = session?.currentSession?.user?.id;
                          console.log('[DEBUG] session.user.id:', sessionUserId);
                        } catch (e) {
                          console.log('[DEBUG] Could not parse session from localStorage');
                        }
                        console.log('[DEBUG] conv ids:', conv.user1_id, conv.user2_id);
                      }
                      let otherUserId = null, otherUserName = '', otherUserPhoto = '', otherUserCity = '', otherUserState = '';
                      if (user) {
                        if (conv.user1_id === user.id) {
                          otherUserId = conv.user2_id;
                          otherUserName = conv.user2_name || '';
                          otherUserPhoto = conv.user2_photo || '';
                          otherUserCity = conv.user2_city || '';
                          otherUserState = conv.user2_state || '';
                        } else {
                          otherUserId = conv.user1_id;
                          otherUserName = conv.user1_name || '';
                          otherUserPhoto = conv.user1_photo || '';
                          otherUserCity = conv.user1_city || '';
                          otherUserState = conv.user1_state || '';
                        }
                      }
                      if (typeof window !== 'undefined') {
                        if (!otherUserId) {
                          console.log('[DEBUG] Skipping conversation: otherUserId is missing', conv);
                        } else if (otherUserId === user?.id) {
                          console.log('[DEBUG] Skipping conversation: otherUserId matches user.id', { otherUserId, userId: user?.id, conv });
                        } else {
                          console.log('[DEBUG] Rendering conversation for otherUserId:', otherUserId, 'otherUserName:', otherUserName);
                        }
                      }
                      // Skip if the other user is yourself or missing
                      if (!otherUserId || otherUserId === user?.id) return null;
                      return (
                        <button
                          key={conv.id}
                          className="flex items-center gap-3 p-6 rounded-2xl border-2 border-pink-300 dark:border-pink-600 bg-pink-50 dark:bg-pink-900/20 w-full hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-pink-500"
                          style={{ cursor: 'pointer' }}
                          onClick={async () => {
                            setSelectedMom({
                              id: otherUserId,
                              name: otherUserName,
                              photo: otherUserPhoto,
                              city: otherUserCity,
                              state: otherUserState,
                            });
                            // Check for existing invitation
                            let invitation = null;
                            if (user && user.id && otherUserId && user.id !== otherUserId) {
                              const fromUserId = user.id;
                              const toUserId = otherUserId;
                              const low = fromUserId < toUserId ? fromUserId : toUserId;
                              const high = fromUserId < toUserId ? toUserId : fromUserId;
                              const { data: existing } = await supabase
                                .from("village_invitations")
                                .select("id, status, from_user_id, to_user_id")
                                .eq("from_to_low", low)
                                .eq("from_to_high", high)
                                .maybeSingle();
                              if (existing && existing.id) {
                                invitation = existing;
                              }
                            }
                            setSelectedMomInvitation(invitation);
                            setShowProfileModal(true);
                          }}
                        >
                          {otherUserPhoto ? (
                            <img src={otherUserPhoto} alt={otherUserName} className="w-16 h-16 rounded-full object-cover" />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-semibold text-2xl">
                              {otherUserName?.[0]?.toUpperCase() || '?'}
                            </div>
                          )}
                          <div className="flex-1 text-left">
                            <div className="font-semibold text-lg text-zinc-900 dark:text-zinc-50">{otherUserName}</div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">{otherUserCity}{otherUserCity && otherUserState ? ', ' : ''}{otherUserState}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}


                <button className="mt-2 text-sm text-zinc-500 hover:underline" onClick={() => setInviteMode('none')}>Back</button>
              )}

            {inviteMode === 'name' && (
              <div className="mt-6">
                <h2 className="text-lg font-bold mb-4">Invite by Name</h2>
                {user ? (
                  <InviteByNameForm
                    onBack={() => setInviteMode('none')}
                    onSelect={async (selectedUser) => {
                      setSelectedMom({
                        id: selectedUser.id,
                        name: selectedUser.full_name,
                        photo: selectedUser.profile_photo_url,
                        city: selectedUser.city,
                        state: selectedUser.state,
                      });
                      setModalLoading(true);
                      let invitation = null;
                      if (user && user.id && selectedUser.id && user.id !== selectedUser.id) {
                        const fromUserId = user.id;
                        const toUserId = selectedUser.id;
                        const low = fromUserId < toUserId ? fromUserId : toUserId;
                        const high = fromUserId < toUserId ? toUserId : fromUserId;
                        const { data: existing } = await supabase
                          .from("village_invitations")
                          .select("id, status, from_user_id, to_user_id")
                          .eq("from_to_low", low)
                          .eq("from_to_high", high)
                          .maybeSingle();
                        if (existing && existing.id) {
                          invitation = existing;
                        }
                      }
                      setSelectedMomInvitation(invitation);
                      setShowProfileModal(true);
                      setModalLoading(false);
                    }}
                  />
                ) : (
                  <div className="text-zinc-500">Loading...</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Global Profile Modal for Invite by Name & Conversations */}
        {showProfileModal && selectedMom && (
          modalLoading ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 max-w-sm w-full shadow-xl text-center text-lg">Loading...</div>
            </div>
          ) : (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 max-w-sm w-full shadow-xl relative">
                <button className="absolute top-2 right-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 text-2xl" onClick={() => {
                  setShowProfileModal(false);
                  setSelectedMomInvitation(null);
                }}>&times;</button>
                {selectedMom.photo ? (
                  <img src={selectedMom.photo} alt={selectedMom.name} className="w-24 h-24 rounded-full object-cover mx-auto mb-4" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-semibold text-4xl mx-auto mb-4">
                    {selectedMom.name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="text-center">
                  <div className="font-bold text-2xl mb-1 text-zinc-900 dark:text-zinc-50">{selectedMom.name}</div>
                  <div className="text-zinc-500 dark:text-zinc-400 mb-2">{selectedMom.city}{selectedMom.city && selectedMom.state ? ', ' : ''}{selectedMom.state}</div>
                  {selectedMomInvitation ? (
                    <div className="mt-4">
                      <div className="mb-2">
                        {selectedMomInvitation.status === 'pending' && <span className="px-4 py-2 rounded-lg bg-yellow-100 text-yellow-800">Pending Invitation</span>}
                        {selectedMomInvitation.status === 'resent' && <span className="px-4 py-2 rounded-lg bg-pink-200 text-pink-800">Resent Invitation</span>}
                        {selectedMomInvitation.status === 'accepted' && <span className="px-4 py-2 rounded-lg bg-green-200 text-green-800">Accepted</span>}
                        {selectedMomInvitation.status === 'declined' && <span className="px-4 py-2 rounded-lg bg-zinc-300 text-zinc-700">Declined</span>}
                      </div>
                      <div className="text-xs text-zinc-500">You have already invited this mom.</div>
                    </div>
                  ) : (
                    <button
                      className="mt-4 px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white font-semibold rounded-lg w-full disabled:opacity-60"
                      onClick={handleInviteMom}
                      disabled={sendingInviteId === selectedMom.id}
                    >
                      {sendingInviteId === selectedMom.id ? 'Sending...' : `Invite ${selectedMom.name} to your village`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        )}

        {inviteBanner && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-pink-500 text-white px-6 py-3 rounded-xl shadow-lg z-50">
            {inviteBanner}
            <button className="ml-4 text-white/80 hover:text-white underline" onClick={() => setInviteBanner("")}>Dismiss</button>
          </div>
        )}
      </div>
    </div>
  );
}
