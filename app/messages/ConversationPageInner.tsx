"use client";

import React, { useState, useEffect, useRef } from "react";
import { useNotification } from "../components/useNotification";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { sendMessageToMatch } from "./sendMessageToMatch";


// ProfileModal component for displaying user profile info in a modal
function ProfileModal({ userId, open, onClose }: { userId: string, open: boolean, onClose: () => void }) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [villageMembers, setVillageMembers] = useState<any[]>([]);
  const [showVillageModal, setShowVillageModal] = useState(false);

  // Fetch profile info
  useEffect(() => {
    if (!userId || !open) return;
    setLoading(true);
    setError("");
    supabase
      .from("user_public_profiles")
      .select("id, full_name, profile_photo_url, city, state, is_public, number_of_kids, kids_age_groups, parenting_style, bio")
      .eq("id", userId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          setError("Profile not found.");
          setProfile(null);
        } else {
          setProfile(data);
        }
        setLoading(false);
      });
  }, [userId, open]);

  // Fetch this user's village members
  useEffect(() => {
    if (!userId || !open) return;
    supabase
      .from("village_invitations")
      .select("from_user_id, to_user_id, status")
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .eq("status", "accepted")
      .then(({ data: invites }) => {
        const memberIds = [...new Set((invites ?? []).map((invite: any) => (
          invite.from_user_id === userId ? invite.to_user_id : invite.from_user_id
        )))];
        if (memberIds.length === 0) {
          setVillageMembers([]);
          return;
        }
        supabase
          .from("user_public_profiles")
          .select("id, full_name, profile_photo_url, city, state, is_public")
          .in("id", memberIds)
          .then(({ data: profiles }) => setVillageMembers(profiles ?? []));
      });
  }, [userId, open]);

  if (!open) return null;
  const router = useRouter();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 max-w-xl w-full shadow-xl relative">
        <button className="absolute top-2 right-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 text-2xl" onClick={onClose}>&times;</button>
        {loading ? (
          <div className="p-8 text-center">Loading profile...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : !profile ? null : (
          <div className="flex flex-col items-center">
            {profile.profile_photo_url ? (
              <img src={profile.profile_photo_url} alt={profile.full_name} className="w-32 h-32 rounded-full object-cover mb-4" />
            ) : (
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-bold text-4xl mb-4">
                {profile.full_name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <h1 className="text-3xl font-bold mb-1">{profile.full_name}</h1>
            <div className="flex items-center gap-4 mb-3">
              <button
                className="flex flex-col items-center focus:outline-none"
                onClick={() => setShowVillageModal(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <span className="text-2xl font-extrabold text-pink-600 leading-none">{villageMembers.length}</span>
                <span className="text-xs text-zinc-500 mt-1 tracking-wide uppercase">{profile.full_name.split(" ")[0]}'s Village</span>
              </button>
            </div>
            <button
              className="mb-4 px-6 py-2 bg-pink-100 hover:bg-pink-200 text-pink-700 border border-pink-500 rounded-lg font-semibold text-base transition-colors dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700 dark:hover:bg-pink-900/45"
              onClick={() => router.push(`/profile/${profile.id}`)}
            >
              Go to Profile
            </button>
            <div className="text-zinc-600 dark:text-zinc-400 mb-2">{profile.city}{profile.city && profile.state ? ', ' : ''}{profile.state}</div>
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
            {profile.bio && (
              <div className="w-full max-w-xs mx-auto mt-2 mb-2">
                <div className="font-semibold text-zinc-800 dark:text-zinc-100 mb-1">Bio</div>
                <div className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-line">{profile.bio}</div>
              </div>
            )}
            {/* Village modal for members */}
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
          </div>
        )}
      </div>
    </div>
  );
}


interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  user1_name?: string;
  user2_name?: string;
  other_user_id?: string;
  other_user_name?: string;
  other_user_photo?: string;
  last_message: string;
  last_message_time: string;
}

export default function ConversationPageInner({ conversationId }: { conversationId: string }) {
  // Debug log for conversationId
  console.log('[ConversationPageInner] conversationId:', conversationId);
  if (!conversationId) {
    return <div className="min-h-screen flex items-center justify-center text-red-600">Error: No conversationId provided in route.</div>;
  }
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const router = useRouter();
  const { showNotification, NotificationComponent } = useNotification();
  const [user, setUser] = useState<any>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [villageStatus, setVillageStatus] = useState<
    | { status: 'in-village' | 'invited-by-me' | 'invited-me' | 'none' }
    | null
  >(null);
  const [inviteBanner, setInviteBanner] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadConversation(user.id);
    }
  }, [user, conversationId]);

  useEffect(() => {
    if (conversation && user) {
      loadMessages(conversation.id);
      // Enhanced: Check all invitation statuses
      const otherUserId = conversation.user1_id === user.id ? conversation.user2_id : conversation.user1_id;
      (async () => {
        // 1. Check if in village (accepted invitation either direction)
        const { data: accepted } = await supabase
          .from('village_invitations')
          .select('id')
          .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${otherUserId}),and(from_user_id.eq.${otherUserId},to_user_id.eq.${user.id})`)
          .eq('status', 'accepted');
        if (accepted && accepted.length > 0) {
          setVillageStatus({ status: 'in-village' });
          return;
        }
        // 2. Check if invitation sent by me (pending/resent)
        const { data: sent } = await supabase
          .from('village_invitations')
          .select('id,status')
          .eq('from_user_id', user.id)
          .eq('to_user_id', otherUserId)
          .in('status', ['pending', 'resent']);
        if (sent && sent.length > 0) {
          setVillageStatus({ status: 'invited-by-me' });
          return;
        }
        // 3. Check if invitation sent to me (pending/resent)
        const { data: received } = await supabase
          .from('village_invitations')
          .select('id,status')
          .eq('from_user_id', otherUserId)
          .eq('to_user_id', user.id)
          .in('status', ['pending', 'resent']);
        if (received && received.length > 0) {
          setVillageStatus({ status: 'invited-me' });
          return;
        }
        setVillageStatus({ status: 'none' });
      })();
    } else {
      setVillageStatus(null);
    }
  }, [conversation, user]);

  async function handleSendVillageInvitation() {
    if (!user || !conversation) return;
    const otherUserId = conversation.user1_id === user.id ? conversation.user2_id : conversation.user1_id;
    setInviteLoading(true);
    setInviteBanner("");
    try {
      const invitation = {
        id: `vinv_${Date.now()}`,
        from_user_id: user.id,
        from_user_name: user.user_metadata?.full_name || 'A Mom',
        from_user_photo: user.user_metadata?.profile_photo_url || '',
        status: 'pending',
        created_at: new Date().toISOString(),
        to_user_id: otherUserId,
      };
      const { error } = await supabase.from('village_invitations').insert([invitation]);
      if (error) throw error;
      setInviteBanner('Village invitation sent!');
      setVillageStatus({ status: 'invited-by-me' });
      setTimeout(() => setInviteBanner("") , 4000);
    } catch (e) {
      setInviteBanner('Failed to send invitation.');
      setTimeout(() => setInviteBanner("") , 4000);
    } finally {
      setInviteLoading(false);
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function checkUser() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      setUser(session.user);
    } catch (error) {
      router.push("/login");
    }
  }

  async function loadConversation(userId: string) {
    try {
      const convosRes = await supabase
        .from("conversations")
        .select("*")
        .eq("id", conversationId);
      if (convosRes.error) throw convosRes.error;
      setConversation(convosRes.data && convosRes.data.length > 0 ? convosRes.data[0] : null);
    } catch (error) {
      showNotification("Failed to load conversation");
    }
  }

  async function loadMessages(conversationId: string) {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      showNotification("Failed to load messages");
    }
  }

  function getOtherUserInfo(conv: any) {
    if (!user) return {};
    if (conv.user1_id === user.id) {
      return {
        name: conv.user2_name,
        photo: conv.user2_photo,
      };
    } else {
      return {
        name: conv.user1_name,
        photo: conv.user1_photo,
      };
    }
  }

  function formatTime(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours > 24) {
      // Show date as e.g. May 13
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } else {
      // Show time as e.g. 2:30 PM
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
  }

  async function sendMessage() {
    if (!messageText.trim() || !conversation || !user) {
      showNotification("Cannot send: missing message, conversation, or user.");
      return;
    }
    setSendingMessage(true);
    try {
      const conv = conversation;
      const matchId = conv.id;
      const receiverId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id;
      // Strict UUID validation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!receiverId || typeof receiverId !== 'string' || !uuidRegex.test(receiverId)) {
        showNotification('Cannot send: missing or invalid receiverId (must be a valid UUID).');
        setSendingMessage(false);
        return;
      }
      if (!user.id || typeof user.id !== 'string' || !uuidRegex.test(user.id)) {
        showNotification('Cannot send: missing or invalid senderId (must be a valid UUID).');
        setSendingMessage(false);
        return;
      }
      const { data } = await sendMessageToMatch({
        supabase,
        selectedConversation: conv.id,
        userId: user.id,
        messageText: messageText.trim(),
        matchId,
        receiverId,
      });
      setMessageText("");
      if (data) {
        setMessages((prev) => [...prev, data]);
      }
    } catch (error) {
      const errMsg = (error && typeof error === 'object' && 'message' in error) ? (error as any).message : 'Failed to send message';
      showNotification(errMsg);
    } finally {
      setSendingMessage(false);
    }
  }

  if (!conversation) {
    return <div className="min-h-screen flex items-center justify-center">Loading conversation...</div>;
  }

  const otherUser = getOtherUserInfo(conversation);
  const otherUserId = conversation.user1_id === user?.id ? conversation.user2_id : conversation.user1_id;
  const otherUserProfileHref = otherUserId ? (otherUserId === user?.id ? "/profile" : `/profile/${otherUserId}`) : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      <div className="max-w-2xl mx-auto h-screen flex flex-col">
        <header className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
          <button
            className="text-pink-600 dark:text-pink-400 hover:opacity-80 flex items-center"
            onClick={() => { window.location.href = '/messages'; }}
            aria-label="Back to Conversations"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        </header>
        {/* Profile header above messages, with invite button/indicator */}
        <div className="flex items-center gap-4 p-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <button
            type="button"
            className="flex items-center gap-4 no-underline hover:opacity-80 bg-transparent border-none p-0"
            onClick={() => {
              if (otherUserProfileHref) {
                router.push(otherUserProfileHref);
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            {otherUser.photo ? (
              <img
                src={otherUser.photo}
                alt={otherUser.name}
                className="w-14 h-14 rounded-full object-cover flex-shrink-0 border-2 border-pink-400"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-bold text-xl flex-shrink-0 border-2 border-pink-400">
                {otherUser.name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <span className="font-semibold text-lg text-zinc-900 dark:text-zinc-50">{otherUser.name}</span>
          </button>
          {/* Profile modal for conversation user */}
          {otherUserId ? (
            <ProfileModal userId={otherUserId} open={profileModalOpen} onClose={() => setProfileModalOpen(false)} />
          ) : null}
          {villageStatus && (
            <div className="ml-auto flex items-center gap-2">
              {villageStatus.status === 'in-village' && (
                <span className="px-4 py-2 text-xs rounded-lg bg-green-100 text-green-800 font-semibold flex items-center justify-center min-w-[90px] text-center">In Your Village</span>
              )}
              {villageStatus.status === 'invited-by-me' && (
                <span className="px-4 py-2 text-xs rounded-lg bg-yellow-100 text-yellow-800 font-semibold flex items-center justify-center min-w-[90px] text-center">Invitation Pending</span>
              )}
              {villageStatus.status === 'invited-me' && (
                <span className="px-4 py-2 text-xs rounded-lg bg-blue-100 text-blue-800 font-semibold flex items-center justify-center min-w-[90px] text-center">Invited You</span>
              )}
              {villageStatus.status === 'none' && (
                <button
                  onClick={handleSendVillageInvitation}
                  disabled={inviteLoading}
                  className="px-4 py-2 text-xs bg-pink-100 hover:bg-pink-200 text-pink-700 border border-pink-500 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700 dark:hover:bg-pink-900/45"
                >
                  {inviteLoading ? 'Sending...' : 'Send Village Invitation'}
                </button>
              )}
            </div>
          )}
        </div>
        {/* Feedback banner for invitation sent */}
        {inviteBanner && (
          <div className="mx-6 mt-2 mb-[-8px] p-3 rounded bg-green-100 text-green-800 text-center font-medium">
            {inviteBanner}
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-0 sm:p-2 bg-white dark:bg-black space-y-2 sm:space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-4xl mb-3">👋</div>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Start the conversation!
                </p>
              </div>
            </div>
          ) : (
            <>
              {messages.map(msg => {
                let senderName = "You";
                if (msg.sender_id !== user?.id) {
                  if (msg.sender_id === conversation.user1_id) {
                    senderName = conversation.user1_name || "";
                  } else if (msg.sender_id === conversation.user2_id) {
                    senderName = conversation.user2_name || "";
                  } else {
                    senderName = "Other";
                  }
                }
                return (
                  <div
                    key={msg.id}
                    className={`flex w-full ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                    style={{ marginBottom: 1 }}
                  >
                    <div
                      className={`px-2 py-1 rounded-2xl sm:px-3 sm:py-2 ${
                        msg.sender_id === user?.id
                          ? 'bg-pink-100 text-pink-900 rounded-br-none ml-2 sm:ml-32 max-w-[96vw] sm:max-w-xs'
                          : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 rounded-bl-none mr-2 sm:mr-32 max-w-[96vw] sm:max-w-xs'
                      }`}
                      style={{ wordBreak: 'break-word', width: 'fit-content', minWidth: 0 }}
                    >
                      {msg.sender_id !== user?.id && (
                        <div className="text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-200">
                          {msg.sender_id === otherUserId && otherUserProfileHref ? (
                            <Link href={otherUserProfileHref} className="hover:underline">
                              {senderName}
                            </Link>
                          ) : (
                            senderName
                          )}
                        </div>
                      )}
                      <p className="break-words text-base leading-snug">{msg.message_text}</p>
                      <p className={`text-xs mt-1 ${
                        msg.sender_id === user?.id
                          ? 'text-pink-400'
                          : 'text-zinc-500 dark:text-zinc-400'
                      }`}>
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
        <div className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1 sm:p-2">
          <div className="flex gap-1 sm:gap-3">
            <input
              type="text"
              id="messageText"
              name="messageText"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type your message..."
              className="flex-1 px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-full bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-pink-500 text-sm"
            />
            <button
              onClick={sendMessage}
              disabled={sendingMessage || !messageText.trim()}
              className="px-4 py-2 bg-pink-100 hover:bg-pink-200 text-pink-700 border border-pink-500 rounded-full font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700 dark:hover:bg-pink-900/45"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
