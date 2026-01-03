// Force redeploy after Vercel plan upgrade
// Trigger redeploy: trivial comment
"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useNotification } from "../components/useNotification";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { sendMessageToMatch } from "./sendMessageToMatch";

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
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showNotification, NotificationComponent } = useNotification();
    const [user, setUser] = useState<any>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [messageText, setMessageText] = useState("");
    const [sendingMessage, setSendingMessage] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // On mount, check for conversation param and set selectedConversation
    useEffect(() => {
      checkUser();
    }, []);

    // When user loads, load conversations and select from param if present
    useEffect(() => {
      if (user) {
        console.log('DEBUG: Calling loadConversations with user.id:', user.id);
        loadConversations(user.id);
        const conversationParam = searchParams.get("conversation");
        if (conversationParam) {
          setSelectedConversation(conversationParam);
        }
      }
    }, [user, searchParams]);

    useEffect(() => {
      if (selectedConversation) {
        loadMessages(selectedConversation);
      }
    }, [selectedConversation]);

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
        if (!selectedConversation && convosRes.data && convosRes.data.length > 0) {
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
          .eq("match_uuid", conversationId)
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
        await loadMessages(selectedConversation);
      } catch (error: any) {
        showNotification(error?.message || "Failed to send message");
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
            {/* Sidebar */}
            <div className="w-full md:w-80 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-y-auto">
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
                        onClick={() => setSelectedConversation(conv.id)}
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
