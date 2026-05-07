"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function VillagePage() {
  const [activeTab, setActiveTab] = useState<'members' | 'invitations' | 'invite'>('members');
  const [inviteMode, setInviteMode] = useState<'none' | 'conversations' | 'name'>('none');
  const [conversations, setConversations] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [sendingInviteId, setSendingInviteId] = useState<string | null>(null);
  const [inviteBanner, setInviteBanner] = useState<string>("");
  const [invitations, setInvitations] = useState<any[]>([]); // All invitations for this user (sent or received)
  const [loadingInvitations, setLoadingInvitations] = useState(false);

  useEffect(() => {
    // Fetch user and conversations/invitations when Invite or Invitations tab is opened
    if (activeTab === 'invite') {
      fetchUserAndConversations();
    }
    if (activeTab === 'invitations') {
      fetchUserAndInvitations();
    }
    // eslint-disable-next-line
  }, [activeTab]);

  async function fetchUserAndConversations() {
    setLoadingConversations(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      }
      // Fetch conversations for this user
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .or(`user1_id.eq.${session.user.id},user2_id.eq.${session.user.id}`)
        .order("updated_at", { ascending: false });
      if (!error && data) {
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUser(session.user);
      // Fetch invitations where user is sender or receiver
      const { data, error } = await supabase
        .from("village_invitations")
        .select("*")
        .or(`from_user_id.eq.${session.user.id},to_user_id.eq.${session.user.id}`)
        .order("created_at", { ascending: false });
      if (!error && data) {
        setInvitations(data);
      }
    } catch (e) {
      setInvitations([]);
    } finally {
      setLoadingInvitations(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900 p-6">
      <div className="max-w-4xl mx-auto">
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
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">Your village members will appear here.</p>
            <p className="text-zinc-400 text-xs">(Coming soon: member list, profile modal, actions)</p>
          </div>
        )}
        {activeTab === 'invitations' && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-3">📬</div>
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">Your invitations will appear here.</p>
            <p className="text-zinc-400 text-xs">(Coming soon: pending/accepted invites)</p>
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
                      // Figure out the other user
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
                      return (
                        <button
                          key={conv.id}
                          className="flex items-center gap-3 p-4 rounded-2xl border-2 border-pink-300 dark:border-pink-600 bg-pink-50 dark:bg-pink-900/20 w-full hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-pink-500"
                          style={{ cursor: 'pointer' }}
                          // TODO: Add invite logic here
                        >
                          {otherUserPhoto ? (
                            <img src={otherUserPhoto} alt={otherUserName} className="w-14 h-14 rounded-full object-cover" />
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-semibold text-2xl">
                              {otherUserName?.[0]?.toUpperCase() || '?'}
                            </div>
                          )}
                          <div className="flex-1 text-left">
                            <div className="font-semibold text-lg text-zinc-900 dark:text-zinc-50">{otherUserName}</div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">{otherUserCity}{otherUserCity && otherUserState ? ', ' : ''}{otherUserState}</div>
                          </div>
                          <span className="ml-4 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-base font-semibold">Invite</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <button className="mt-2 text-sm text-zinc-500 hover:underline" onClick={() => setInviteMode('none')}>Back</button>
              </div>
            )}

            {inviteMode === 'name' && (
              <div className="mt-6">
                <h2 className="text-lg font-bold mb-4">Invite by Name</h2>
                <p className="text-zinc-400 text-xs mb-4">(Coming soon: search and invite form)</p>
                <button className="mt-2 text-sm text-zinc-500 hover:underline" onClick={() => setInviteMode('none')}>Back</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
// ...existing code inside export default function VillagePage() only, no duplicate imports or code blocks...
