"use client";
import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

function InviteByNameForm({ onBack, onSelect }: { onBack: () => void; onSelect: (user: any) => void }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (search.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(async () => {
      const { data, error } = await supabase
        .from("user_public_profiles")
        .select("id, full_name, city, state, profile_photo_url")
        .ilike("full_name", `%${search}%`);
      setResults(data || []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input
          className="flex-1 px-4 py-2 border rounded-lg"
          placeholder="Search by name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="px-4 py-2 bg-zinc-200 rounded-lg" onClick={onBack}>Back</button>
      </div>
      {loading && <div className="text-zinc-500">Searching...</div>}
      {!loading && results.length === 0 && search.length > 1 && (
        <div className="text-zinc-500">No results found.</div>
      )}
      <div className="space-y-2">
        {results.map(user => (
          <button
            key={user.id}
            className="flex items-center gap-3 p-4 rounded-xl border bg-white w-full hover:bg-pink-50"
            onClick={() => onSelect(user)}
          >
            {user.profile_photo_url ? (
              <img src={user.profile_photo_url} alt={user.full_name} className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-semibold text-xl">
                {user.full_name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div className="flex-1 text-left">
              <div className="font-semibold text-base">{user.full_name}</div>
              <div className="text-xs text-zinc-500">{user.city}{user.city && user.state ? ', ' : ''}{user.state}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
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

  useEffect(() => {
    if (inviteMode === "conversations" && user) {
      setLoadingConversations(true);
      supabase
        .from("conversations")
        .select("*")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .then(({ data }) => {
          setConversations(data || []);
          setLoadingConversations(false);
        });
    }
  }, [inviteMode, user]);

  // Handler for inviting a mom
  const handleInviteMom = async () => {
    if (!user || !selectedMom) return;
    setSendingInviteId(selectedMom.id);
    try {
      const fromUserId = user.id;
      const toUserId = selectedMom.id;
      if (fromUserId === toUserId) {
        setInviteBanner("You cannot invite yourself.");
        setSendingInviteId(null);
        return;
      }
      const low = fromUserId < toUserId ? fromUserId : toUserId;
      const high = fromUserId < toUserId ? toUserId : fromUserId;
      const { data: existing } = await supabase
        .from("village_invitations")
        .select("id, status, from_user_id, to_user_id")
        .eq("from_to_low", low)
        .eq("from_to_high", high)
        .maybeSingle();
      if (existing && existing.id) {
        setInviteBanner("An invitation already exists.");
        setShowProfileModal(false);
        setSendingInviteId(null);
        return;
      }
      const { error: insertError } = await supabase
        .from("village_invitations")
        .insert([
          {
            from_user_id: fromUserId,
            to_user_id: toUserId,
            from_to_low: low,
            from_to_high: high,
            status: "pending",
          },
        ]);
      if (insertError) throw insertError;
      setInviteBanner(`Invitation sent to ${selectedMom.name}!`);
      setShowProfileModal(false);
    } catch (e: any) {
      setInviteBanner(`Failed to send invitation: ${e?.message || e}`);
    }
    setSendingInviteId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex gap-4 mb-6">
          <button
            className={`flex-1 px-6 py-3 rounded-lg font-semibold ${inviteMode === "conversations" ? "bg-pink-500 text-white" : "bg-zinc-100 text-zinc-700"}`}
            onClick={() => setInviteMode("conversations")}
          >
            💬 Invite from Conversations
          </button>
          <button
            className={`flex-1 px-6 py-3 rounded-lg font-semibold ${inviteMode === "name" ? "bg-pink-500 text-white" : "bg-zinc-100 text-zinc-700"}`}
            onClick={() => setInviteMode("name")}
          >
            🔍 Invite by Name
          </button>
        </div>

        {inviteMode === "conversations" && (
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
                      onClick={async () => {
                        setSelectedMom({
                          id: otherUserId,
                          name: otherUserName,
                          photo: otherUserPhoto,
                          city: otherUserCity,
                          state: otherUserState,
                        });
                        setModalLoading(true);
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
                        setModalLoading(false);
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
          </div>
        )}

        {inviteMode === "name" && (
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
