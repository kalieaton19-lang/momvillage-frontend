// Force redeploy after Vercel plan upgrade
// Trigger redeploy: trivial comment
"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useNotification } from "../components/useNotification";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { sendMessageToMatch } from "./sendMessageToMatch";

// Helper: fetch village members and invitations for the current user
async function fetchVillageStatus(userId: string, otherUserId: string) {
  // Fetch village members
  const { data: members } = await supabase
    .from('village_members')
    .select('id')
    .eq('user_id', userId);
  const isInVillage = Array.isArray(members) && members.some(m => m.id === otherUserId);
  // Fetch pending invitations sent by user
  const { data: invites } = await supabase
    .from('village_invitations')
    .select('to_user_id,status')
    .eq('from_user_id', userId)
    .eq('to_user_id', otherUserId)
    .order('created_at', { ascending: false });
  const hasPendingInvite = Array.isArray(invites) && invites.some(i => i.status === 'pending');
  return { isInVillage, hasPendingInvite };
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
  // Add any other fields your table returns
}


function MessagesPageInner() {
  const [showSidebar, setShowSidebar] = useState(true);
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showNotification, NotificationComponent } = useNotification();
    const [user, setUser] = useState<any>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
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

    // On mount, check for conversation param and set selectedConversation
    useEffect(() => {
      checkUser();
    }, []);

    // When user loads, load conversations and select from param if present

    // Track if we've set the conversation from the param
    const [conversationParamApplied, setConversationParamApplied] = useState(false);

    useEffect(() => {
      if (user) {
        console.log('DEBUG: Calling loadConversations with user.id:', user.id);
        loadConversations(user.id);
      }
    }, [user]);

    // After conversations load, apply conversation param if present
    useEffect(() => {
      const conversationParam = searchParams.get("conversation");
      if (conversationParam && conversations.length > 0 && !conversationParamApplied) {
        // Only set if the conversation exists
        const exists = conversations.some(c => c.id === conversationParam);
        if (exists) {
          setSelectedConversation(conversationParam);
          setConversationParamApplied(true);
        }
      }
    }, [conversations, searchParams, conversationParamApplied]);

    // Reset flag if param changes
    useEffect(() => {
      setConversationParamApplied(false);
    }, [searchParams.get("conversation")]);

    useEffect(() => {
      if (selectedConversation) {
        loadMessages(selectedConversation);
        // Enhanced: Check all invitation statuses
        const conv = conversations.find(c => c.id === selectedConversation);
        if (conv && user) {
          const otherUserId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id;
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
      }
    }, [selectedConversation, conversations, user]);
    // Handler to send a village invitation
    async function handleSendVillageInvitation() {
      if (!user || !selectedConversation) return;
      const conv = conversations.find(c => c.id === selectedConversation);
      if (!conv) return;
      const otherUserId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id;
      setInviteLoading(true);
      setInviteBanner("");
      try {
        // Insert invitation into village_invitations
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
        setTimeout(() => setInviteBanner(""), 4000);
      } catch (e) {
        setInviteBanner('Failed to send invitation.');
        setTimeout(() => setInviteBanner(""), 4000);
      } finally {
        setInviteLoading(false);
      }
    }

    useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    async function checkUser() {
      try {
          // Debug: log session before sending message
          console.log('session', (await supabase.auth.getSession()).data.session);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push("/login");
          return;
        }
        console.log('DEBUG: Authenticated user.id:', session.user.id);
        setUser(session.user);
      } catch (error) {
        router.push("/login");
      }
    }

    async function loadConversations(userId: string) {
      try {
        console.log('DEBUG: loadConversations received userId:', userId);
        // Only query conversations table
        const convosRes = await supabase
          .from("conversations")
          .select("*")
          .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
          .order("updated_at", { ascending: false });
        console.log('DEBUG: Supabase conversations response:', convosRes);
        if (convosRes.error) throw convosRes.error;
        setConversations(convosRes.data || []);
        // Auto-select first conversation if none selected
        // Only auto-select if no conversation param is present
        const conversationParam = searchParams.get("conversation");
        if (!selectedConversation && !conversationParam && convosRes.data && convosRes.data.length > 0) {
          setSelectedConversation(convosRes.data[0].id);
        }
      } catch (error) {
        showNotification("Failed to load conversations");
        console.error('DEBUG: loadConversations error:', error);
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
      // Assuming conversation has user1 and user2 info
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
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    async function sendMessage() {
      if (!messageText.trim() || !selectedConversation || !user) {
        showNotification("Cannot send: missing message, conversation, or user.");
        return;
      }
      setSendingMessage(true);
      try {
        console.log('DEBUG: sendMessage called');
        if (!selectedConversation) throw new Error('No conversation selected');
        // Debug: log selectedConversation and conversations
        console.log('DEBUG selectedConversation:', selectedConversation);
        console.log('DEBUG conversations:', conversations);
        // Find the selected conversation object
        const conv = conversations.find(c => c.id === selectedConversation);
        if (!conv) {
          const errMsg = `Conversation not found for selectedConversation: ${selectedConversation}`;
          showNotification(errMsg);
          console.error('DEBUG:', errMsg);
          throw new Error('Conversation not found');
        }
        const matchId = conv.id; // Assuming id is the match_id (text)
        // Determine the receiverId as the other participant in the conversation
        const receiverId =
          conv && user && user.id
            ? (conv.user1_id === user.id
                ? conv.user2_id
                : (conv.user2_id === user.id ? conv.user1_id : null))
            : null;
        // Validate receiverId and senderId
        // Strict UUID validation
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!receiverId || typeof receiverId !== 'string' || !uuidRegex.test(receiverId)) {
          showNotification('Cannot send: missing or invalid receiverId (must be a valid UUID).');
          console.error('DEBUG: Invalid receiverId:', receiverId);
          setSendingMessage(false);
          return;
        }
        if (!user.id || typeof user.id !== 'string' || !uuidRegex.test(user.id)) {
          showNotification('Cannot send: missing or invalid senderId (must be a valid UUID).');
          console.error('DEBUG: Invalid senderId:', user.id);
          setSendingMessage(false);
          return;
        }
        console.log('DEBUG: About to send message with:', {
          selectedConversation,
          matchId,
          senderId: user.id,
          receiverId,
          messageText: messageText.trim(),
        });
        const { data } = await sendMessageToMatch({
          supabase,
          selectedConversation,
          userId: user.id,
          messageText: messageText.trim(),
          matchId,
          receiverId,
        });
        setMessageText("");
        // Optimistically add the new message to the chat UI
        if (data) {
          setMessages((prev) => [...prev, data]);
        }
      } catch (error) {
        const errMsg = (error && typeof error === 'object' && 'message' in error) ? (error as any).message : 'Failed to send message';
        showNotification(errMsg);
        console.error('Send message error:', error);
      } finally {
        setSendingMessage(false);
      }
    }

    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
        <div className="max-w-7xl mx-auto h-screen flex flex-col">
          <header className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <h1 className="text-lg font-semibold">Connect with your village</h1>
            </div>
            <Link href="/home" className="text-sm text-pink-600 dark:text-pink-400 hover:underline">
              Back to Home
            </Link>
          </header>
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar (Conversations List) */}
            {/* On mobile, hide sidebar if a conversation is open */}
            <div
              className={`w-full md:w-80 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-y-auto ${selectedConversation && !showSidebar ? 'hidden md:block' : ''}`}
            >
              {conversations.length === 0 ? (
                <div className="p-6 text-center">
                  <div className="text-4xl mb-3">💌</div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                    No conversations yet. Start connecting with other moms!
                  </p>
                  <Link
                    href="/find-moms"
                    className="inline-block px-4 py-2 bg-pink-600 text-white rounded-full font-medium hover:bg-pink-700 transition-colors"
                  >
                    Find Moms
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {conversations.map(conv => {
                    // Determine the other user's name
                    let otherUserName = "";
                    if (user && conv.user1_id && conv.user2_id) {
                      if (conv.user1_id === user.id) {
                        otherUserName = conv.user2_name || "";
                      } else if (conv.user2_id === user.id) {
                        otherUserName = conv.user1_name || "";
                      }
                    }
                    const otherUser = getOtherUserInfo(conv);
                    return (
                      <Link
                        key={conv.id}
                        href={`?conversation=${conv.id}`}
                        scroll={false}
                        className={`block w-full text-left p-4 transition-colors no-underline ${
                          selectedConversation === conv.id
                            ? 'bg-pink-50 dark:bg-pink-900/20 border-l-2 border-pink-600'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                        }`}
                        onClick={() => {
                          setSelectedConversation(conv.id);
                          if (window.innerWidth < 768) setShowSidebar(false);
                        }}
                      >
                        <div className="flex items-start gap-3">
                          {otherUser.photo ? (
                            <img
                              src={otherUser.photo}
                              alt={otherUserName}
                              className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-semibold flex-shrink-0">
                              {otherUserName?.[0]?.toUpperCase() || '?'}
                            </div>
                          )}
                          <div className="flex flex-col justify-center">
                            <div className="font-semibold text-zinc-900 dark:text-zinc-50">{otherUserName}</div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[140px]">{conv.last_message}</div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
            {/* Main message area */}
            {selectedConversation && (
              <div className="flex-1 flex flex-col">
                {/* Back to Conversations button for mobile */}
                <div className="md:hidden p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                  <button
                    className="text-pink-600 dark:text-pink-400 font-semibold flex items-center gap-2"
                    onClick={() => setShowSidebar(true)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                    Back to Conversations
                  </button>
                </div>
                {/* Profile header above messages, with invite button/indicator */}
                {(() => {
                  const conv = conversations.find(c => c.id === selectedConversation);
                  if (!conv) return null;
                  const otherUser = getOtherUserInfo(conv);
                  const otherUserId = conv.user1_id === user?.id ? conv.user2_id : conv.user1_id;
                  return (
                    <div className="flex items-center gap-4 p-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                      <Link href={`/mom-profile?id=${otherUserId}`} className="flex items-center gap-4 no-underline hover:opacity-80">
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
                      </Link>
                      {/* Profile indicator and invite button */}
                      {villageStatus && (
                        <div className="ml-auto flex items-center gap-2">
                          {villageStatus.status === 'in-village' && (
                            <span className="px-6 py-2 text-base rounded-full bg-green-100 text-green-800 font-semibold flex items-center justify-center min-w-[180px] text-center">In Your Village</span>
                          )}
                          {villageStatus.status === 'invited-by-me' && (
                            <span className="px-6 py-2 text-base rounded-full bg-yellow-100 text-yellow-800 font-semibold flex items-center justify-center min-w-[180px] text-center">Invitation Pending</span>
                          )}
                          {villageStatus.status === 'invited-me' && (
                            <span className="px-6 py-2 text-base rounded-full bg-blue-100 text-blue-800 font-semibold flex items-center justify-center min-w-[180px] text-center">Invited You</span>
                          )}
                          {villageStatus.status === 'none' && (
                            <button
                              onClick={handleSendVillageInvitation}
                              disabled={inviteLoading}
                              className="px-4 py-2 bg-pink-600 text-white rounded-full font-medium hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {inviteLoading ? 'Sending...' : 'Send Village Invitation'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
                {/* Feedback banner for invitation sent */}
                {inviteBanner && (
                  <div className="mx-6 mt-2 mb-[-8px] p-3 rounded bg-green-100 text-green-800 text-center font-medium">
                    {inviteBanner}
                  </div>
                )}
                <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-black space-y-4">
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
                        // Determine sender name
                        let senderName = "You";
                        if (msg.sender_id !== user?.id) {
                          // Find the conversation object
                          const conv = conversations.find(c => c.id === selectedConversation);
                          if (conv) {
                            if (msg.sender_id === conv.user1_id) {
                              senderName = conv.user1_name || "";
                            } else if (msg.sender_id === conv.user2_id) {
                              senderName = conv.user2_name || "";
                            } else {
                              senderName = "Other";
                            }
                          } else {
                            senderName = "Other";
                          }
                        }
                        return (
                          <div
                            key={msg.id}
                            className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-xs px-4 py-2 rounded-2xl ${
                                msg.sender_id === user?.id
                                  ? 'bg-pink-600 text-white rounded-br-none'
                                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 rounded-bl-none'
                              }`}
                            >
                              {/* Show sender name above message if not you */}
                              {msg.sender_id !== user?.id && (
                                <div className="text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-200">{senderName}</div>
                              )}
                              <p className="break-words">{msg.message_text}</p>
                              <p className={`text-xs mt-1 ${
                                msg.sender_id === user?.id
                                  ? 'text-pink-100'
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
                <div className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
                  <div className="flex gap-3">
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
                      className="flex-1 px-4 py-3 border border-zinc-200 dark:border-zinc-700 rounded-full bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-pink-500"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={sendingMessage || !messageText.trim()}
                      className="px-6 py-3 bg-pink-600 text-white rounded-full font-medium hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
}


export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <MessagesPageInner />
    </Suspense>
  );
}
