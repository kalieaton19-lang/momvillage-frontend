// Force redeploy after Vercel plan upgrade
// Trigger redeploy: trivial comment
"use client";

import { useState, useEffect, useRef } from "react";
import { useNotification } from "../components/useNotification";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

interface Conversation {
  id: string;
  match_id: string;
  other_user_id?: string;
  other_user_name?: string;
  other_user_photo?: string;
  other_user_email?: string;
  other_user_city?: string;
  other_user_state?: string;
  last_message?: string;
  last_message_time?: string;
  created_at?: string;
}
interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  message_text: string;
  created_at: string;
}

export default function MessagesPage() {
  const { showNotification, NotificationComponent } = useNotification();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkUser();
  }, []);

  // Track last message count for notification
  const lastMessageCountRef = useRef<number>(0);
  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation);
      const interval = setInterval(async () => {
        const prevCount = lastMessageCountRef.current;
        const msgs = await fetchMessages(selectedConversation);
        if (msgs.length > prevCount && msgs[msgs.length-1]?.sender_id !== user?.id) {
          showNotification('New message from your village!');
        }
        lastMessageCountRef.current = msgs.length;
        setMessages(msgs);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [selectedConversation, user]);

  // Helper to fetch messages for notification polling
  async function fetchMessages(conversationId: string) {
    const { data, error } = await supabase
      .from('messages')
      .select('id, match_id, sender_id, receiver_id, message_text, created_at')
      .eq('match_id', conversationId)
      .order('created_at', { ascending: true });
    return data || [];
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function checkUser() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      
      setUser(session.user);
      
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser?.user_metadata) {
        setCurrentUserProfile(currentUser.user_metadata);
      }
      
      await loadConversations(session.user.id);
    } catch (error) {
      console.error('Error checking user:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  async function loadConversations(userId: string) {
      console.log('[Village Debug] loadConversations called for user:', userId);
    try {
      // Load conversations from conversations table
      const { data: convRows, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order('created_at', { ascending: false });
      if (convError) {
        console.error('Error loading conversations:', convError);
        setConversations([]);
        return;
      }
      // For each conversation, get the other user's info and profile
      const convs: Conversation[] = [];
      for (const conv of convRows || []) {
        let other_user_id = conv.user1_id === userId ? conv.user2_id : conv.user1_id;
        let other_user_name = conv.user1_id === userId ? conv.user2_name : conv.user1_name;
        let other_user_photo = conv.user1_id === userId ? conv.user2_photo : conv.user1_photo;

        // Try to fetch other user's profile from Supabase admin API (will fail on client)
        let other_user_email = '';
        let other_user_city = '';
        let other_user_state = '';
        try {
          const { data: userProfile, error: userError } = await supabase.auth.admin.getUserById(other_user_id);
          if (!userError && userProfile && userProfile.user_metadata) {
            other_user_email = userProfile.email || '';
            other_user_city = userProfile.user_metadata.city || '';
            other_user_state = userProfile.user_metadata.state || '';
          }
        } catch (e) {
          // Fallback: leave as empty strings, but still save the conversation
        }

        // Fetch the latest message for this conversation
        let last_message = '';
        let last_message_time = '';
        try {
          const { data: lastMsgRows, error: lastMsgError } = await supabase
            .from('messages')
            .select('message_text, created_at')
            .eq('match_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1);
          if (!lastMsgError && lastMsgRows && lastMsgRows.length > 0) {
            last_message = lastMsgRows[0].message_text || '';
            last_message_time = lastMsgRows[0].created_at ? new Date(lastMsgRows[0].created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
          }
        } catch (e) {
          // Fallback: leave as empty strings
        }

        convs.push({
          id: conv.id,
          match_id: conv.id,
          other_user_id,
          other_user_name,
          other_user_photo,
          other_user_email,
          other_user_city,
          other_user_state,
          last_message,
          last_message_time,
          created_at: conv.created_at,
        });
      }
      setConversations(convs);
      // Sync conversations to localStorage for Village page
      try {
        const convKey = `conversations_${userId}`;
        localStorage.setItem(convKey, JSON.stringify(convs));
        if (convs.length === 0) {
          console.warn('[Village Debug] No conversations to sync to localStorage:', convKey, convs);
        } else {
          console.log('[Village Debug] Synced conversations to localStorage:', convKey, convs);
        }
      } catch (e) {
        console.error('Error syncing conversations to localStorage:', e);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      setConversations([]);
    }
  }

  async function loadMessages(conversationId: string) {
    try {
      const hasDb = typeof (supabase as any).from === 'function';
      if (hasDb) {
        const { data, error } = await (supabase as any)
          .from('messages')
          .select('id, match_id, sender_id, receiver_id, message_text, created_at')
          .eq('match_id', conversationId)
          .order('created_at', { ascending: true });
        if (error) {
          console.warn('Messages table not available; using local storage fallback.');
        } else {
          setMessages(data || []);
          return;
        }
      }
      // Fallback to local storage
      try {
        const raw = (typeof window !== 'undefined') ? window.localStorage.getItem('mv_messages') : null;
        const all = raw ? JSON.parse(raw) : [];
        const filtered = Array.isArray(all) ? all.filter((m: any) => m.match_id === conversationId) : [];
        filtered.sort((a: any, b: any) => (a.created_at || '').localeCompare(b.created_at || ''));
        setMessages(filtered);
      } catch {
        setMessages([]);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    }
  }

  async function sendMessage() {
    if (!messageText.trim() || !selectedConversation || !user) return;

    setSendingMessage(true);
    try {
      const hasDb = typeof (supabase as any).from === 'function';
      // Find the other user's ID from conversations
      let otherUserId = null;
      const { data: conv } = await supabase
        .from('conversations')
        .select('user1_id, user2_id')
        .eq('id', selectedConversation)
        .single();
      if (conv) {
        otherUserId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id;
      }
      if (hasDb) {
        const { error } = await (supabase as any)
          .from('messages')
          .insert([
            {
              match_id: selectedConversation,
              sender_id: user.id,
              receiver_id: otherUserId,
              message_text: messageText,
              created_at: new Date().toISOString(),
            }
          ]);
        if (error) {
          console.warn('Error sending via DB; using local storage fallback.');
        } else {
          setMessageText("");
          await loadMessages(selectedConversation);
          return;
        }
      }
      // Fallback to local storage
      try {
        const raw = (typeof window !== 'undefined') ? window.localStorage.getItem('mv_messages') : null;
        const all = raw ? JSON.parse(raw) : [];
        const newMsg = {
          id: `local_${Date.now()}`,
          match_id: selectedConversation,
          sender_id: user.id,
          receiver_id: null,
          message_text: messageText,
          created_at: new Date().toISOString(),
        };
        const next = Array.isArray(all) ? [ ...all, newMsg ] : [ newMsg ];
        if (typeof window !== 'undefined') window.localStorage.setItem('mv_messages', JSON.stringify(next));
        setMessageText("");
        await loadMessages(selectedConversation);
      } catch (e) {
        console.error('Error sending message (local fallback):', e);
        alert('Failed to send message. Please try again.');
      }

      setMessageText("");
      await loadMessages(selectedConversation);
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  }

  async function startNewConversation(otherUserId: string, otherUserName: string, otherUserPhoto?: string) {
    try {
      // Generate a match_id based on sorted user IDs
      const matchId = [user.id, otherUserId].sort().join('_');
      
      // Check if conversation already exists
      let exists = false;
      const hasDb = typeof (supabase as any).from === 'function';
      if (hasDb) {
        const { data: existingConv } = await (supabase as any)
          .from('messages')
          .select('match_id')
          .eq('match_id', matchId)
          .limit(1);
        exists = !!(existingConv && existingConv.length > 0);
      } else {
        try {
          const raw = (typeof window !== 'undefined') ? window.localStorage.getItem('mv_messages') : null;
          const all = raw ? JSON.parse(raw) : [];
          exists = Array.isArray(all) && all.some((m: any) => m.match_id === matchId);
        } catch {
          exists = false;
        }
      }

      if (exists) {
        setSelectedConversation(matchId);
        return;
      }

      // Create first message to start the conversation
      if (hasDb) {
        const { error } = await (supabase as any)
          .from('messages')
          .insert([
            {
              match_id: matchId,
              sender_id: user.id,
              receiver_id: otherUserId,
              message_text: 'Conversation started',
              created_at: new Date().toISOString(),
            }
          ]);
        if (error) {
          console.warn('Error creating conversation via DB; using local storage fallback.');
        } else {
          setSelectedConversation(matchId);
          await loadConversations(user.id);
          return;
        }
      }
      // Local storage fallback
      try {
        const raw = (typeof window !== 'undefined') ? window.localStorage.getItem('mv_messages') : null;
        const all = raw ? JSON.parse(raw) : [];
        const seed = {
          id: `local_${Date.now()}`,
          match_id: matchId,
          sender_id: user.id,
          receiver_id: otherUserId,
          message_text: 'Conversation started',
          created_at: new Date().toISOString(),
        };
        const next = Array.isArray(all) ? [ ...all, seed ] : [ seed ];
        if (typeof window !== 'undefined') window.localStorage.setItem('mv_messages', JSON.stringify(next));
        setSelectedConversation(matchId);
        await loadConversations(user.id);
      } catch (e) {
        console.error('Error starting conversation (local fallback):', e);
      }

      setSelectedConversation(matchId);
      await loadConversations(user.id);
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function formatTime(dateString: string) {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  function getOtherUserInfo(conv: Conversation) {
    return {
      name: conv.other_user_name || 'Mom',
      photo: conv.other_user_photo,
    };
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <NotificationComponent />
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      <div className="max-w-7xl mx-auto h-screen flex flex-col">
        <header className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Messages 💬</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Connect with your village
            </p>
          </div>
          <Link href="/home" className="text-sm text-pink-600 dark:text-pink-400 hover:underline">
            Back to Home
          </Link>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-full md:w-80 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-6 text-center">
                <div className="text-4xl mb-3">💌</div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                  No conversations yet. Start connecting with other moms!
                </p>
                <Link
                  href="/find-moms"
                  className="inline-block px-4 py-2 bg-pink-600 text-white rounded-full text-sm font-medium hover:bg-pink-700 transition-colors"
                >
                  Find Moms
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {conversations.map(conv => {
                  const otherUser = getOtherUserInfo(conv);
                  return (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv.id)}
                      className={`w-full text-left p-4 transition-colors ${
                        selectedConversation === conv.id
                          ? 'bg-pink-50 dark:bg-pink-900/20 border-l-2 border-pink-600'
                          : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {otherUser.photo ? (
                          <img
                            src={otherUser.photo}
                            alt={otherUser.name}
                            className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-semibold flex-shrink-0">
                            {otherUser.name?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 truncate">
                              {otherUser.name}
                            </h3>
                            {conv.last_message_time && (
                              <span className="text-xs text-zinc-500 dark:text-zinc-400 flex-shrink-0">
                                {conv.last_message_time}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate">
                            {conv.last_message || 'No messages yet'}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedConversation ? (
            <div className="flex-1 flex flex-col">
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
                    {messages.map(msg => (
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
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              <div className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
                <div className="flex gap-3">
                  <input
                    type="text"
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
          ) : null

        </div>
      </div>
    </div>
    </>
  );
}
