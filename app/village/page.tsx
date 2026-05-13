"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
// InviteByNameForm component (top-level)
function InviteByNameForm({ onBack, onInvite }: { onBack: () => void; onInvite: (user: any) => void }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      setError("");
      return;
    }
    const trimmed = search.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    const handler = setTimeout(async () => {
      try {
        const { data, error: searchError } = await supabase
          .from("user_public_profiles")
          .select("id, full_name, profile_photo_url, city, state, is_public")
          .or(`full_name.ilike.%${trimmed}%,city.ilike.%${trimmed}%`)
          .limit(10);
        if (searchError) throw searchError;
        setResults(data || []);
        if ((data || []).length === 0) setError("No users found.");
      } catch (e: any) {
        setError("Search failed. Try again.");
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          className="flex-1 px-4 py-2 border rounded-lg"
          placeholder="Enter name or city..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          required
        />
      </div>
      {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
      <div className="space-y-2">
        {results.map((user: any) => (
          <button
            key={user.id}
            className="w-full flex items-center gap-3 p-3 border rounded-lg bg-zinc-50 dark:bg-zinc-800 hover:bg-pink-100 dark:hover:bg-pink-900 transition-all"
            onClick={() => onInvite(user)}
          >
            {user.profile_photo_url ? (
              <img src={user.profile_photo_url} alt={user.full_name} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-semibold text-lg">
                {user.full_name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div className="flex-1 text-left">
              <div className="font-semibold text-zinc-900 dark:text-zinc-50">{user.full_name}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">{user.city}{user.city && user.state ? ', ' : ''}{user.state}</div>
            </div>
          </button>
        ))}
      </div>
      <button className="mt-4 text-sm text-zinc-500 hover:underline" onClick={onBack}>Back</button>
    </div>
  );
}
// (removed duplicate broken InviteByNameForm JSX and import)

export default function VillagePage() {
  // Only show invite UI
  const [inviteMode, setInviteMode] = useState<'none' | 'conversations' | 'name'>('none');

  // Remove all tab logic and references to activeTab/setActiveTab
  const [conversations, setConversations] = useState<any[]>([]);
  const [villageMembers, setVillageMembers] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [debugInvites, setDebugInvites] = useState<any[]>([]);
  const [debugProfiles, setDebugProfiles] = useState<any[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [sendingInviteId, setSendingInviteId] = useState<string | null>(null);
  const [inviteBanner, setInviteBanner] = useState<string>("");
  const [invitations, setInvitations] = useState<any[]>([]); // All invitations for this user (sent or received)
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [selectedMom, setSelectedMom] = useState<any>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileModalMember, setProfileModalMember] = useState<any>(null);
  const [invitationsWithOther, setInvitationsWithOther] = useState<any[]>([]);

  // Only fetch conversations for invite UI
  useEffect(() => {
    fetchUserAndConversations();
  }, []);

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
            return;
          }
          throw insertError;
        }
        setInviteBanner(`Invitation sent to ${selectedMom.name}!`);
        setShowProfileModal(false);
      }
    } catch (e: any) {
      setInviteBanner(`Failed to send invitation: ${e?.message || e}`);
    } finally {
      setSendingInviteId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900 p-6">
      <div className="max-w-2xl mx-auto">
        <a
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 mb-6 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-lg shadow hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors font-medium"
          style={{ position: 'relative', top: 0, left: 0 }}
        >
          <span aria-hidden="true">←</span> Back to Home
        </a>
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
                    if (!otherUserId || otherUserId === user?.id) return null;
                    return (
                      <button
                        key={conv.id}
                        className="flex items-center gap-3 p-6 rounded-2xl border-2 border-pink-300 dark:border-pink-600 bg-pink-50 dark:bg-pink-900/20 w-full hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-pink-500"
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          setSelectedMom({
                            id: otherUserId,
                            name: otherUserName,
                            photo: otherUserPhoto,
                            city: otherUserCity,
                            state: otherUserState,
                          });
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
              {/* Profile Modal */}
              {showProfileModal && selectedMom && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 max-w-sm w-full shadow-xl relative">
                    <button className="absolute top-2 right-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 text-2xl" onClick={() => setShowProfileModal(false)}>&times;</button>
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
                      <button
                        className="mt-4 px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white font-semibold rounded-lg w-full disabled:opacity-60"
                        onClick={handleInviteMom}
                        disabled={sendingInviteId === selectedMom.id}
                      >
                        {sendingInviteId === selectedMom.id ? 'Sending...' : `Invite ${selectedMom.name} to your village`}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {inviteMode === 'name' && (
            <div className="mt-6">
              <h2 className="text-lg font-bold mb-4">Invite by Name</h2>
              <InviteByNameForm
                onBack={() => setInviteMode('none')}
                onInvite={async (user) => {
                  setSelectedMom({
                    id: user.id,
                    name: user.full_name,
                    photo: user.profile_photo_url,
                    city: user.city,
                    state: user.state,
                  });
                  setShowProfileModal(true);
                }}
              />
            </div>
          )}
        </div>
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
