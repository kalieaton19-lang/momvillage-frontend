"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
// InviteByNameForm component (top-level)
function InviteByNameForm({ onBack, onInvite }: { onBack: () => void; onInvite: (user: any) => void }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
          className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
          placeholder="Enter name or city..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          required
        />
      </div>
      {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
      <div className="space-y-2">
        {results.map((user: any) => {
          const isSelected = selectedId === user.id;
          return (
            <button
              key={user.id}
              className={
                `w-full flex items-center gap-3 p-3 border-2 rounded-2xl transition-all ` +
                `bg-pink-100 dark:bg-pink-900/40 border-pink-300 dark:border-pink-600 ` +
                (isSelected ? 'ring-2 ring-pink-600 border-pink-600' : '')
              }
              onClick={() => {
                setSelectedId(user.id);
                onInvite(user);
              }}
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
          );
        })}
      </div>
      <button className="mt-4 text-sm text-zinc-500 hover:underline" onClick={onBack}>Back</button>
    </div>
  );
}
export default function VillagePage() {
  // Only show invite UI
  const [inviteMode, setInviteMode] = useState<'none' | 'conversations' | 'name'>('name');

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

  const router = useRouter();
  return (
    <div className="min-h-screen bg-pink-50 dark:bg-zinc-900 p-6">
      <div className="max-w-xs w-full mx-auto">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center justify-center w-10 h-10 mb-6 bg-white text-pink-500 border border-pink-200 rounded-full shadow hover:bg-pink-50 transition-colors"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" className="" />
          </svg>
        </button>
        {/* Full-width title banner */}
        <div className="-mx-6 px-6 py-6 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 text-center rounded-t-2xl">
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Invite a mom to your village</h1>
        </div>
        {/* Browser-like tab bar */}
          <div className="flex gap-0 px-0 pt-6 pb-0 bg-transparent border-b border-zinc-200 dark:border-zinc-800">
            <button
              className={`flex-1 py-2 px-4 font-medium text-base border-t border-l border-r rounded-t-2xl transition-all
                ${inviteMode === 'name'
                  ? 'bg-white dark:bg-zinc-900 text-pink-600 border-pink-500 z-10'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-200 border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-700'}
              `}
              style={{ marginBottom: inviteMode === 'name' ? '-1px' : '0' }}
              onClick={() => setInviteMode('name')}
            >
              Invite by Name
            </button>
            <button
              className={`flex-1 py-2 px-4 font-medium text-base border-t border-l border-r rounded-t-2xl transition-all
                ${inviteMode === 'conversations'
                  ? 'bg-white dark:bg-zinc-900 text-pink-600 border-pink-500 z-10'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-200 border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-700'}
              `}
              style={{ marginBottom: inviteMode === 'conversations' ? '-1px' : '0' }}
              onClick={() => setInviteMode('conversations')}
            >
              Invite from Conversations
            </button>
          </div>
          <div className="px-6 pb-6 pt-4 bg-white dark:bg-zinc-900 rounded-b-2xl">
            {inviteMode === 'name' && (
              <div className="mt-4">
                {/* InviteByNameForm with pink profile cards and highlight */}
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
            {inviteMode === 'conversations' && (
              <div className="mt-4">
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
                      const isSelected = selectedMom && selectedMom.id === otherUserId;
                      return (
                        <button
                          key={conv.id}
                          className={
                            `flex items-center gap-3 p-6 rounded-2xl border-2 w-full transition-all focus:outline-none focus:ring-2 focus:ring-pink-500 ` +
                            `bg-pink-100 dark:bg-pink-900/40 border-pink-300 dark:border-pink-600 ` +
                            (isSelected ? 'ring-2 ring-pink-600 border-pink-600' : '')
                          }
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
          </div>
        </div>
        {inviteBanner && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-pink-500 text-white px-6 py-3 rounded-xl shadow-lg z-50">
            {inviteBanner}
            <button className="ml-4 text-white/80 hover:text-white underline" onClick={() => setInviteBanner("")}>Dismiss</button>
          </div>
        )}
    </div>
  );
}
