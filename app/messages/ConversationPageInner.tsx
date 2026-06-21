"use client";

import React, { useState, useEffect, useRef } from "react";
import { useNotification } from "../components/useNotification";
import { useRouter } from "next/navigation";
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

interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id?: string | null;
  message_text: string;
  created_at: string;
  read_at?: string | null;
  metadata?: Record<string, any> | null;
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [villageStatus, setVillageStatus] = useState<
    | { status: 'in-village' | 'invited-by-me' | 'invited-me' | 'none' }
    | null
  >(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [showInvitationDecisionModal, setShowInvitationDecisionModal] = useState(false);
  const [showInvitedActionsModal, setShowInvitedActionsModal] = useState(false);
  const [showVillageMemberModal, setShowVillageMemberModal] = useState(false);
  const [viewportHeightPx, setViewportHeightPx] = useState<number | null>(null);
  const [viewportOffsetTopPx, setViewportOffsetTopPx] = useState(0);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const previousMessagesCountRef = useRef(0);
  const typingChannelRef = useRef<any>(null);
  const typingStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingIndicatorHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingSentActiveRef = useRef(false);
  const lastTypingTrueSentAtRef = useRef(0);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const scrollY = window.scrollY;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;
    const previousBodyTouchAction = document.body.style.touchAction;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyLeft = document.body.style.left;
    const previousBodyRight = document.body.style.right;
    const previousBodyWidth = document.body.style.width;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.body.style.touchAction = "manipulation";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
      document.body.style.touchAction = previousBodyTouchAction;
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.left = previousBodyLeft;
      document.body.style.right = previousBodyRight;
      document.body.style.width = previousBodyWidth;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateViewportMetrics = () => {
      const vv = window.visualViewport;
      if (!vv) {
        setViewportHeightPx(window.innerHeight);
        setViewportOffsetTopPx(0);
        return;
      }

      setViewportHeightPx(Math.round(vv.height));
      setViewportOffsetTopPx(Math.round(vv.offsetTop));
    };

    updateViewportMetrics();

    const vv = window.visualViewport;
    vv?.addEventListener("resize", updateViewportMetrics);
    vv?.addEventListener("scroll", updateViewportMetrics);
    window.addEventListener("resize", updateViewportMetrics);

    return () => {
      vv?.removeEventListener("resize", updateViewportMetrics);
      vv?.removeEventListener("scroll", updateViewportMetrics);
      window.removeEventListener("resize", updateViewportMetrics);
    };
  }, []);

  useEffect(() => {
    if (user) {
      loadConversation(user.id);
    }
  }, [user, conversationId]);

  useEffect(() => {
    if (conversation && user) {
      void loadMessages(conversation.id);
      void refreshVillageStatus(user.id, conversation.user1_id === user.id ? conversation.user2_id : conversation.user1_id);
    } else {
      setVillageStatus(null);
    }
  }, [conversation, user]);

  useEffect(() => {
    if (!conversation?.id || !user?.id) return;

    const channel = supabase
      .channel(`conversation-messages-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        () => {
          void loadMessages(conversation.id);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        () => {
          void loadMessages(conversation.id);
        },
      )
      .on(
        "broadcast",
        { event: "typing" },
        ({ payload }: any) => {
          const senderId = payload?.sender_id;
          if (!senderId || senderId === user.id) return;

          const isTyping = Boolean(payload?.is_typing);
          if (isTyping) {
            setIsOtherUserTyping(true);
            if (typingIndicatorHideTimeoutRef.current) {
              clearTimeout(typingIndicatorHideTimeoutRef.current);
            }
            typingIndicatorHideTimeoutRef.current = setTimeout(() => {
              setIsOtherUserTyping(false);
            }, 7000);
            return;
          }

          setIsOtherUserTyping(false);
          if (typingIndicatorHideTimeoutRef.current) {
            clearTimeout(typingIndicatorHideTimeoutRef.current);
            typingIndicatorHideTimeoutRef.current = null;
          }
        },
      )
      .subscribe();

    typingChannelRef.current = channel;
    setIsOtherUserTyping(false);

    return () => {
      typingChannelRef.current = null;
      if (typingStopTimeoutRef.current) {
        clearTimeout(typingStopTimeoutRef.current);
        typingStopTimeoutRef.current = null;
      }
      if (typingIndicatorHideTimeoutRef.current) {
        clearTimeout(typingIndicatorHideTimeoutRef.current);
        typingIndicatorHideTimeoutRef.current = null;
      }
      typingSentActiveRef.current = false;
      setIsOtherUserTyping(false);
      void supabase.removeChannel(channel);
    };
  }, [conversation?.id, user?.id]);

  useEffect(() => {
    if (!conversation?.id || !user?.id) return;

    const intervalId = window.setInterval(() => {
      void loadMessages(conversation.id);
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [conversation?.id, user?.id]);

  async function refreshVillageStatus(currentUserId: string, otherUserId: string) {
    const { data: relationshipRows } = await supabase
      .from('village_invitations')
      .select('from_user_id,to_user_id,status')
      .or(`and(from_user_id.eq.${currentUserId},to_user_id.eq.${otherUserId}),and(from_user_id.eq.${otherUserId},to_user_id.eq.${currentUserId})`);

    const rows = relationshipRows || [];
    const inVillage = rows.some((row: any) => row.status === 'accepted');
    if (inVillage) {
      setVillageStatus({ status: 'in-village' });
      return;
    }

    const invitedByMe = rows.some(
      (row: any) =>
        row.from_user_id === currentUserId &&
        row.to_user_id === otherUserId &&
        (row.status === 'pending' || row.status === 'resent'),
    );
    if (invitedByMe) {
      setVillageStatus({ status: 'invited-by-me' });
      return;
    }

    const invitedMe = rows.some(
      (row: any) =>
        row.from_user_id === otherUserId &&
        row.to_user_id === currentUserId &&
        (row.status === 'pending' || row.status === 'resent'),
    );
    if (invitedMe) {
      setVillageStatus({ status: 'invited-me' });
      return;
    }

    setVillageStatus({ status: 'none' });
  }

  async function handleSendVillageInvitation() {
    if (!user || !conversation) {
      return { ok: false, message: 'Please sign in to invite moms.' };
    }
    const otherUserId = conversation.user1_id === user.id ? conversation.user2_id : conversation.user1_id;
    setInviteLoading(true);
    try {
      const { error: deleteStaleError } = await supabase
        .from('village_invitations')
        .delete()
        .eq('from_user_id', user.id)
        .eq('to_user_id', otherUserId);

      if (deleteStaleError) throw deleteStaleError;

      const { error } = await supabase
        .from('village_invitations')
        .insert({ from_user_id: user.id, to_user_id: otherUserId, status: 'pending' });

      if (error) throw error;
      await refreshVillageStatus(user.id, otherUserId);
      return { ok: true, message: 'Invitation sent!' };
    } catch (e) {
      const errMsg = e && typeof e === 'object' && 'message' in e ? (e as Error).message : 'Failed to send invitation.';
      return { ok: false, message: errMsg };
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleUninvite() {
    if (!user || !conversation) {
      return { ok: false, message: 'Please sign in to manage invitations.' };
    }
    const otherUserId = conversation.user1_id === user.id ? conversation.user2_id : conversation.user1_id;

    setInviteLoading(true);
    try {
      const { error } = await supabase
        .from('village_invitations')
        .delete()
        .eq('from_user_id', user.id)
        .eq('to_user_id', otherUserId);

      if (error) throw error;
      await refreshVillageStatus(user.id, otherUserId);
      return { ok: true, message: 'Invitation removed.' };
    } catch (e) {
      const errMsg = e && typeof e === 'object' && 'message' in e ? (e as Error).message : 'Failed to remove invitation.';
      return { ok: false, message: errMsg };
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleAcceptInvitation() {
    if (!user || !conversation) {
      return { ok: false, message: 'Please sign in to accept invitations.' };
    }
    const otherUserId = conversation.user1_id === user.id ? conversation.user2_id : conversation.user1_id;

    setInviteLoading(true);
    try {
      const { error } = await supabase
        .from('village_invitations')
        .update({ status: 'accepted' })
        .eq('from_user_id', otherUserId)
        .eq('to_user_id', user.id)
        .in('status', ['pending', 'resent']);

      if (error) throw error;
      await refreshVillageStatus(user.id, otherUserId);
      return { ok: true, message: "Invitation accepted! You're now in each other's village." };
    } catch (e) {
      const errMsg = e && typeof e === 'object' && 'message' in e ? (e as Error).message : 'Failed to accept invitation.';
      return { ok: false, message: errMsg };
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleDeclineInvitation() {
    if (!user || !conversation) {
      return { ok: false, message: 'Please sign in to manage invitations.' };
    }
    const otherUserId = conversation.user1_id === user.id ? conversation.user2_id : conversation.user1_id;

    setInviteLoading(true);
    try {
      const { error } = await supabase
        .from('village_invitations')
        .delete()
        .eq('from_user_id', otherUserId)
        .eq('to_user_id', user.id);

      if (error) throw error;
      await refreshVillageStatus(user.id, otherUserId);
      return { ok: true, message: 'Invitation declined.' };
    } catch (e) {
      const errMsg = e && typeof e === 'object' && 'message' in e ? (e as Error).message : 'Failed to decline invitation.';
      return { ok: false, message: errMsg };
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleRemoveFromVillage() {
    if (!user || !conversation) {
      return { ok: false, message: 'Please sign in to manage your village.' };
    }
    const otherUserId = conversation.user1_id === user.id ? conversation.user2_id : conversation.user1_id;

    setInviteLoading(true);
    try {
      const { error } = await supabase
        .from('village_invitations')
        .delete()
        .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${otherUserId}),and(from_user_id.eq.${otherUserId},to_user_id.eq.${user.id})`);

      if (error) throw error;
      await refreshVillageStatus(user.id, otherUserId);
      return { ok: true, message: 'Removed from your village.' };
    } catch (e) {
      const errMsg = e && typeof e === 'object' && 'message' in e ? (e as Error).message : 'Failed to remove from village.';
      return { ok: false, message: errMsg };
    } finally {
      setInviteLoading(false);
    }
  }

  function updateAutoScrollState() {
    const container = messagesContainerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom <= 120;
  }

  useEffect(() => {
    const hasNewMessage = messages.length > previousMessagesCountRef.current;
    if (hasNewMessage && shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    previousMessagesCountRef.current = messages.length;
  }, [messages]);

  useEffect(() => {
    if (!isOtherUserTyping) return;
    updateAutoScrollState();
    if (!shouldAutoScrollRef.current) return;

    const frameId = window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isOtherUserTyping]);

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
      if (user?.id) {
        await markConversationMessagesAsRead(conversationId);
      }

      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setMessages((data || []) as ChatMessage[]);
    } catch (error) {
      showNotification("Failed to load messages");
    }
  }

  async function markConversationMessagesAsRead(currentConversationId: string) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      await fetch("/api/messages/mark-read", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ conversationId: currentConversationId }),
      });
    } catch {
      // Silent fail to avoid interrupting chat UX.
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
      if (typingSentActiveRef.current && typingChannelRef.current) {
        await typingChannelRef.current.send({
          type: "broadcast",
          event: "typing",
          payload: {
            conversation_id: conversation.id,
            sender_id: user.id,
            is_typing: false,
          },
        });
        typingSentActiveRef.current = false;
      }
      if (typingStopTimeoutRef.current) {
        clearTimeout(typingStopTimeoutRef.current);
        typingStopTimeoutRef.current = null;
      }
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
  const otherUserModalData = {
    id: otherUserId,
    full_name: otherUser.name || 'Mom',
    profile_photo_url: otherUser.photo || '',
  };
  const lastOutgoingMessageId = [...messages].reverse().find((message) => message.sender_id === user?.id)?.id;

  async function emitTypingState(isTyping: boolean) {
    if (!typingChannelRef.current || !conversation?.id || !user?.id) return;
    await typingChannelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: {
        conversation_id: conversation.id,
        sender_id: user.id,
        is_typing: isTyping,
      },
    });
  }

  async function handleMessageInputChange(nextValue: string) {
    setMessageText(nextValue);

    const hasText = nextValue.trim().length > 0;

    if (!hasText) {
      if (typingStopTimeoutRef.current) {
        clearTimeout(typingStopTimeoutRef.current);
        typingStopTimeoutRef.current = null;
      }
      if (typingSentActiveRef.current) {
        await emitTypingState(false);
        typingSentActiveRef.current = false;
      }
      return;
    }

    if (!typingSentActiveRef.current) {
      await emitTypingState(true);
      typingSentActiveRef.current = true;
      lastTypingTrueSentAtRef.current = Date.now();
    } else {
      const now = Date.now();
      if (now - lastTypingTrueSentAtRef.current >= 1200) {
        await emitTypingState(true);
        lastTypingTrueSentAtRef.current = now;
      }
    }

    if (typingStopTimeoutRef.current) {
      clearTimeout(typingStopTimeoutRef.current);
    }
    typingStopTimeoutRef.current = setTimeout(() => {
      void emitTypingState(false);
      typingSentActiveRef.current = false;
      typingStopTimeoutRef.current = null;
    }, 1800);
  }

  return (
    <div
      className="fixed inset-x-0 overflow-hidden overscroll-none bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900"
      style={{
        height: viewportHeightPx ? `${viewportHeightPx}px` : "100dvh",
        top: `${viewportOffsetTopPx}px`,
      }}
    >
      <div className="max-w-2xl mx-auto h-full flex flex-col overflow-hidden">
        <div className="sticky top-0 z-20 bg-white dark:bg-zinc-900">
          <header className="shrink-0 flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
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
          <div className="shrink-0 flex items-center gap-4 p-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
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
                <button
                  onClick={
                    villageStatus.status === 'in-village'
                      ? () => setShowVillageMemberModal(true)
                      : villageStatus.status === 'invited-by-me'
                      ? () => setShowInvitedActionsModal(true)
                      : villageStatus.status === 'invited-me'
                      ? () => setShowInvitationDecisionModal(true)
                      : async () => {
                          const result = await handleSendVillageInvitation();
                          showNotification(result.message, result.ok ? 'success' : 'error');
                        }
                  }
                  disabled={inviteLoading}
                  className={`shrink-0 px-3 py-1.5 border rounded-full text-xs font-semibold transition-colors ${
                    villageStatus.status === 'in-village'
                      ? 'bg-green-100 text-green-700 border-green-500 dark:bg-green-900/30 dark:text-green-200 dark:border-green-700'
                      : villageStatus.status === 'invited-by-me'
                      ? 'bg-zinc-200 text-zinc-700 border-zinc-400 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:border-zinc-500 dark:hover:bg-zinc-600'
                      : villageStatus.status === 'invited-me'
                      ? 'bg-pink-700 !text-white border-transparent hover:bg-pink-800 shadow-sm dark:bg-pink-700 dark:!text-white dark:border-transparent dark:hover:bg-pink-800'
                      : 'bg-pink-100 hover:bg-pink-200 text-pink-700 border-pink-500 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700 dark:hover:bg-pink-900/45'
                  } ${inviteLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                  style={villageStatus.status === 'invited-me' ? { color: '#ffffff' } : undefined}
                  type="button"
                >
                  {villageStatus.status === 'in-village'
                    ? 'In Your Village'
                    : villageStatus.status === 'invited-by-me'
                    ? inviteLoading
                      ? 'Updating...'
                      : 'Invited'
                    : villageStatus.status === 'invited-me'
                    ? inviteLoading
                      ? 'Updating...'
                      : 'View Invitation'
                    : inviteLoading
                    ? 'Sending...'
                    : 'Invite'}
                </button>
              </div>
            )}
          </div>
        </div>
        {showInvitationDecisionModal && (
          <ChatInvitationDecisionModal
            mom={otherUserModalData}
            statusLoading={inviteLoading}
            onClose={() => setShowInvitationDecisionModal(false)}
            onAccept={async () => {
              const result = await handleAcceptInvitation();
              showNotification(result.message, result.ok ? 'success' : 'error');
              setShowInvitationDecisionModal(false);
            }}
            onDecline={async () => {
              const result = await handleDeclineInvitation();
              showNotification(result.message, result.ok ? 'success' : 'error');
              setShowInvitationDecisionModal(false);
            }}
          />
        )}
        {showInvitedActionsModal && (
          <ChatInvitedActionsModal
            mom={otherUserModalData}
            statusLoading={inviteLoading}
            onCancel={() => setShowInvitedActionsModal(false)}
            onUninvite={async () => {
              const result = await handleUninvite();
              showNotification(result.message, result.ok ? 'success' : 'error');
              setShowInvitedActionsModal(false);
            }}
            onResend={async () => {
              const result = await handleSendVillageInvitation();
              showNotification(result.message, result.ok ? 'success' : 'error');
              setShowInvitedActionsModal(false);
            }}
          />
        )}
        {showVillageMemberModal && (
          <ChatVillageMemberModal
            mom={otherUserModalData}
            statusLoading={inviteLoading}
            onClose={() => setShowVillageMemberModal(false)}
            onMessage={() => setShowVillageMemberModal(false)}
            onRemove={async () => {
              const result = await handleRemoveFromVillage();
              showNotification(result.message, result.ok ? 'success' : 'error');
              if (result.ok) {
                setShowVillageMemberModal(false);
              }
            }}
          />
        )}
        <div
          ref={messagesContainerRef}
          onScroll={updateAutoScrollState}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 sm:p-2 bg-white dark:bg-black space-y-2 sm:space-y-4"
          style={{
            WebkitOverflowScrolling: "touch",
            paddingBottom: isOtherUserTyping ? "0.75rem" : undefined,
          }}
        >
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
              {messages.map((msg) => {
                const isOutgoing = msg.sender_id === user?.id;
                const isRead = Boolean(
                  msg.read_at || msg.metadata?.read_by_receiver_at || msg.metadata?.read_at,
                );
                const statusText = isRead ? 'Read' : 'Delivered';
                const showOutgoingStatus = isOutgoing && msg.id === lastOutgoingMessageId;
                return (
                  <div
                    key={msg.id}
                    className={`flex w-full flex-col ${isOutgoing ? 'items-end' : 'items-start'}`}
                    style={{ marginBottom: 1 }}
                  >
                    <div
                      className={`px-2 py-1 rounded-2xl sm:px-3 sm:py-2 ${
                        isOutgoing
                          ? 'bg-pink-100 text-pink-900 rounded-br-none ml-3 sm:ml-32 max-w-[92vw] sm:max-w-xs'
                          : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 rounded-bl-none mr-3 sm:mr-32 max-w-[92vw] sm:max-w-xs'
                      }`}
                      style={{ wordBreak: 'break-word', width: 'fit-content', minWidth: 0 }}
                    >
                      <p className="break-words text-base leading-snug">{msg.message_text}</p>
                      <p className={`text-xs mt-1 ${
                        isOutgoing
                          ? 'text-pink-400'
                          : 'text-zinc-500 dark:text-zinc-400'
                      }`}>
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                    {showOutgoingStatus && (
                      <p className="mt-1 px-2 sm:px-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                        {statusText}
                        {isRead && <span className="text-pink-500 text-[10px] leading-none">✓</span>}
                      </p>
                    )}
                  </div>
                );
              })}
              {isOtherUserTyping && (
                <div className="flex w-full flex-col items-start" style={{ marginBottom: 1 }}>
                  <div className="px-2 py-2 rounded-2xl sm:px-3 sm:py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 rounded-bl-none mr-3 sm:mr-32 max-w-[92vw] sm:max-w-xs">
                    <div className="flex items-center gap-1 px-1">
                      <span className="inline-block h-2 w-2 rounded-full bg-zinc-500 dark:bg-zinc-300 animate-bounce" />
                      <span className="inline-block h-2 w-2 rounded-full bg-zinc-500 dark:bg-zinc-300 animate-bounce" style={{ animationDelay: "0.15s" }} />
                      <span className="inline-block h-2 w-2 rounded-full bg-zinc-500 dark:bg-zinc-300 animate-bounce" style={{ animationDelay: "0.3s" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
        <div
          className="shrink-0 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1 sm:p-2"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.25rem)" }}
        >
          <div className="flex gap-1 sm:gap-3">
            <input
              type="text"
              id="messageText"
              name="messageText"
              value={messageText}
              onChange={(e) => {
                void handleMessageInputChange(e.target.value);
              }}
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

interface ChatInviteModalMom {
  id: string;
  full_name?: string | null;
  profile_photo_url?: string | null;
}

interface ChatInvitationDecisionModalProps {
  mom: ChatInviteModalMom;
  statusLoading: boolean;
  onClose: () => void;
  onAccept: () => void;
  onDecline: () => void;
}

function ChatInvitationDecisionModal({ mom, statusLoading, onClose, onAccept, onDecline }: ChatInvitationDecisionModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white px-5 pb-5 pt-3 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full p-2 shadow hover:bg-pink-50 dark:hover:bg-pink-800 transition focus:outline-none focus:ring-2 focus:ring-pink-400"
            aria-label="Close invitation popup"
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-pink-600">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-3">
            {mom.profile_photo_url ? (
              <div
                className="h-24 w-24 rounded-full border-4 border-pink-300 bg-cover bg-center"
                aria-label={mom.full_name || "Mom"}
                role="img"
                style={{ backgroundImage: `url(${mom.profile_photo_url})` }}
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-purple-400 text-3xl font-semibold text-white">
                {(mom.full_name || "Mom").charAt(0).toUpperCase() || "?"}
              </div>
            )}
          </div>

          <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {mom.full_name || "Mom"}
          </h3>

          <p className="text-sm font-medium text-pink-700 dark:text-pink-300">
            has invited you to join her village!
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onDecline}
            disabled={statusLoading}
            className={`rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 ${statusLoading ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            {statusLoading ? "Updating..." : "Decline"}
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={statusLoading}
            className={`rounded-full border border-pink-800 bg-pink-700 px-4 py-2 text-sm font-semibold !text-white transition hover:bg-pink-800 dark:border-pink-900 dark:bg-pink-700 dark:!text-white dark:hover:bg-pink-800 ${statusLoading ? "opacity-60 cursor-not-allowed" : ""}`}
            style={{ color: "#ffffff" }}
          >
            {statusLoading ? "Updating..." : "Accept"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ChatInvitedActionsModalProps {
  mom: ChatInviteModalMom;
  statusLoading: boolean;
  onCancel: () => void;
  onUninvite: () => void | Promise<void>;
  onResend: () => void | Promise<void>;
}

function ChatInvitedActionsModal({ mom, statusLoading, onCancel, onUninvite, onResend }: ChatInvitedActionsModalProps) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white px-5 pb-5 pt-3 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full p-2 shadow hover:bg-pink-50 dark:hover:bg-pink-800 transition focus:outline-none focus:ring-2 focus:ring-pink-400"
            aria-label="Close invited popup"
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-pink-600">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="mb-4 flex flex-col items-center text-center">
          <div className="mb-3">
            {mom.profile_photo_url ? (
              <div
                className="h-24 w-24 rounded-full border-4 border-pink-300 bg-cover bg-center"
                aria-label={mom.full_name || "Mom"}
                role="img"
                style={{ backgroundImage: `url(${mom.profile_photo_url})` }}
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-purple-400 text-3xl font-semibold text-white">
                {(mom.full_name || "Mom").charAt(0).toUpperCase() || "?"}
              </div>
            )}
          </div>

          <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {mom.full_name || "Mom"}
          </h3>

          <p className="text-sm font-medium text-pink-700 dark:text-pink-300">
            you&apos;ve already invited this mom to your village.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void onUninvite()}
            disabled={statusLoading}
            className={`rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 ${statusLoading ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            {statusLoading ? "Updating..." : "Uninvite"}
          </button>
          <button
            type="button"
            onClick={() => void onResend()}
            disabled={statusLoading}
            className={`rounded-full border border-pink-800 bg-pink-700 px-4 py-2 text-sm font-semibold !text-white transition hover:bg-pink-800 dark:border-pink-900 dark:bg-pink-700 dark:!text-white dark:hover:bg-pink-800 ${statusLoading ? "opacity-60 cursor-not-allowed" : ""}`}
            style={{ color: "#ffffff" }}
          >
            {statusLoading ? "Updating..." : "Resend Invitation"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ChatVillageMemberModalProps {
  mom: ChatInviteModalMom;
  statusLoading: boolean;
  onClose: () => void;
  onMessage: () => void;
  onRemove: () => void | Promise<void>;
}

function ChatVillageMemberModal({ mom, statusLoading, onClose, onMessage, onRemove }: ChatVillageMemberModalProps) {
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false);
  const profilePhotoUrl = (mom.profile_photo_url || '').trim();
  const hasValidPhotoUrl =
    Boolean(profilePhotoUrl) &&
    profilePhotoUrl.toLowerCase() !== 'null' &&
    profilePhotoUrl.toLowerCase() !== 'undefined';

  useEffect(() => {
    setPhotoLoadFailed(false);
  }, [mom.id, profilePhotoUrl]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white px-5 pb-5 pt-3 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full p-2 shadow hover:bg-pink-50 dark:hover:bg-pink-800 transition focus:outline-none focus:ring-2 focus:ring-pink-400"
            aria-label="Close village member popup"
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-pink-600">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-3">
            {hasValidPhotoUrl && !photoLoadFailed ? (
              <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-pink-300 bg-pink-100">
                <img
                  src={profilePhotoUrl}
                  alt={mom.full_name || 'Mom'}
                  className="h-full w-full object-cover"
                  onError={() => setPhotoLoadFailed(true)}
                />
              </div>
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-purple-400 text-3xl font-semibold text-white">
                {(mom.full_name || 'Mom').charAt(0).toUpperCase() || '?'}
              </div>
            )}
          </div>

          <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {mom.full_name || 'Mom'}
          </h3>

          <p className="text-sm font-medium text-pink-700 dark:text-pink-300">
            is a part of your village!
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onMessage}
            disabled={statusLoading}
            className={`rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 ${statusLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            Message
          </button>
          <button
            type="button"
            onClick={() => void onRemove()}
            disabled={statusLoading}
            className={`rounded-full border border-pink-800 bg-pink-700 px-4 py-2 text-sm font-semibold !text-white transition hover:bg-pink-800 dark:border-pink-900 dark:bg-pink-700 dark:!text-white dark:hover:bg-pink-800 ${statusLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
            style={{ color: '#ffffff' }}
          >
            {statusLoading ? 'Updating...' : 'Remove from Village'}
          </button>
        </div>
      </div>
    </div>
  );
}
