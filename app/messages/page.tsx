
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { useNotification } from "../components/useNotification";

// Force redeploy after Vercel plan upgrade
// Trigger redeploy: trivial comment

import { Suspense } from "react";

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
  last_message: string;
  last_message_time: string;
  updated_at?: string;
}

interface LatestMessageInfo {
  senderId: string;
  createdAt: string;
  messageText?: string;
}



function MessagesPageInner() {
  const [user, setUser] = useState<any>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [latestMessageByConversation, setLatestMessageByConversation] = useState<Record<string, LatestMessageInfo>>({});
  const [seenConversationAt, setSeenConversationAt] = useState<Record<string, string>>({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedConversationIds, setSelectedConversationIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const router = useRouter();
  const { showNotification, NotificationComponent } = useNotification();

  const seenStorageKey = user?.id ? `messages_seen_at:${user.id}` : null;

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadConversations(user.id);
    }
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`messages-activity-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload: any) => {
          const senderId = payload?.new?.sender_id;
          const receiverId = payload?.new?.receiver_id;
          if (senderId === user.id || receiverId === user.id) {
            void loadConversations(user.id);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload: any) => {
          const senderId = payload?.new?.sender_id;
          const receiverId = payload?.new?.receiver_id;
          if (senderId === user.id || receiverId === user.id) {
            void loadConversations(user.id);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const conversationsIntervalId = window.setInterval(() => {
      void loadConversations(user.id);
    }, 7000);

    return () => {
      window.clearInterval(conversationsIntervalId);
    };
  }, [user?.id]);

  function getConversationActivityTimestamp(
    conversation: Conversation,
    latestByConversation?: Record<string, LatestMessageInfo>,
  ): number {
    const latestMessageTime = latestByConversation?.[conversation.id]?.createdAt;
    if (latestMessageTime) return new Date(latestMessageTime).getTime();

    if (conversation.last_message_time) return new Date(conversation.last_message_time).getTime();
    if (conversation.updated_at) return new Date(conversation.updated_at).getTime();
    return 0;
  }

  function sortConversationsByActivity(
    conversationList: Conversation[],
    latestByConversation?: Record<string, LatestMessageInfo>,
  ): Conversation[] {
    return [...conversationList].sort(
      (left, right) =>
        getConversationActivityTimestamp(right, latestByConversation) -
        getConversationActivityTimestamp(left, latestByConversation),
    );
  }

  useEffect(() => {
    if (!seenStorageKey) {
      setSeenConversationAt({});
      return;
    }

    try {
      const raw = localStorage.getItem(seenStorageKey);
      if (!raw) {
        setSeenConversationAt({});
        return;
      }
      const parsed = JSON.parse(raw);
      setSeenConversationAt(parsed && typeof parsed === "object" ? parsed : {});
    } catch {
      setSeenConversationAt({});
    }
  }, [seenStorageKey]);

  function persistSeenConversationAt(nextValue: Record<string, string>) {
    if (!seenStorageKey) return;
    setSeenConversationAt(nextValue);
    try {
      localStorage.setItem(seenStorageKey, JSON.stringify(nextValue));
    } catch {
      // Ignore localStorage errors
    }
  }

  function markConversationSeen(conversationId: string, seenAt: string) {
    const nextValue = {
      ...seenConversationAt,
      [conversationId]: seenAt,
    };
    persistSeenConversationAt(nextValue);
  }

  function openConversation(conversationId: string) {
    const nowIso = new Date().toISOString();
    markConversationSeen(conversationId, nowIso);
    router.push(`/messages/${conversationId}`);
  }

  function toggleConversationSelection(conversationId: string) {
    setSelectedConversationIds((prev) =>
      prev.includes(conversationId)
        ? prev.filter((id) => id !== conversationId)
        : [...prev, conversationId],
    );
  }

  function handleToggleEditMode() {
    setIsEditMode((prev) => {
      if (prev) {
        setSelectedConversationIds([]);
      }
      return !prev;
    });
  }

  function handleSelectAllToggle() {
    if (selectedConversationIds.length === conversations.length) {
      setSelectedConversationIds([]);
      return;
    }
    setSelectedConversationIds(conversations.map((conversation) => conversation.id));
  }

  function handleMarkSelectedAsRead() {
    if (selectedConversationIds.length === 0) return;

    const nowIso = new Date().toISOString();
    const nextSeenMap = { ...seenConversationAt };

    selectedConversationIds.forEach((conversationId) => {
      const latest = latestMessageByConversation[conversationId]?.createdAt;
      nextSeenMap[conversationId] = latest || nowIso;
    });

    persistSeenConversationAt(nextSeenMap);
    showNotification("Marked selected conversations as read.", "success");
  }

  async function handleDeleteSelectedConversations() {
    if (!user?.id || selectedConversationIds.length === 0) return;

    setBulkActionLoading(true);
    try {
      const { error: deleteMessagesError } = await supabase
        .from("messages")
        .delete()
        .in("conversation_id", selectedConversationIds);

      if (deleteMessagesError) throw deleteMessagesError;

      const { error: deleteConversationsError } = await supabase
        .from("conversations")
        .delete()
        .in("id", selectedConversationIds)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (deleteConversationsError) throw deleteConversationsError;

      setConversations((prev) => prev.filter((conversation) => !selectedConversationIds.includes(conversation.id)));
      setLatestMessageByConversation((prev) => {
        const next = { ...prev };
        selectedConversationIds.forEach((conversationId) => {
          delete next[conversationId];
        });
        return next;
      });
      setSeenConversationAt((prev) => {
        const next = { ...prev };
        selectedConversationIds.forEach((conversationId) => {
          delete next[conversationId];
        });
        if (seenStorageKey) {
          try {
            localStorage.setItem(seenStorageKey, JSON.stringify(next));
          } catch {
            // Ignore localStorage errors
          }
        }
        return next;
      });

      setSelectedConversationIds([]);
      setIsEditMode(false);
      showNotification("Selected conversations deleted.", "success");
    } catch (error: any) {
      showNotification(error?.message || "Failed to delete selected conversations.", "error");
    } finally {
      setBulkActionLoading(false);
    }
  }

  async function checkUser() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        return;
      }

      const { data: refreshedData } = await supabase.auth.refreshSession();
      if (!refreshedData?.session?.user) {
        router.push("/login");
        return;
      }
      setUser(refreshedData.session.user);
    } catch (error) {
      router.push("/login");
    }
  }

  async function loadConversations(userId: string) {
    try {
      const convosRes = await supabase
        .from("conversations")
        .select("*")
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order("updated_at", { ascending: false });
      if (convosRes.error) throw convosRes.error;

      const loadedConversations = (convosRes.data || []) as Conversation[];
      setConversations(sortConversationsByActivity(loadedConversations));

      const conversationIds = loadedConversations.map((conversation) => conversation.id);
      if (conversationIds.length === 0) {
        setLatestMessageByConversation({});
        return;
      }

      const { data: messageRows } = await supabase
        .from("messages")
        .select("conversation_id,sender_id,created_at,message_text")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false });

      const latestByConversation: Record<string, LatestMessageInfo> = {};
      (messageRows || []).forEach((row: any) => {
        if (!row?.conversation_id || !row?.sender_id || !row?.created_at) return;
        if (latestByConversation[row.conversation_id]) return;
        latestByConversation[row.conversation_id] = {
          senderId: row.sender_id,
          createdAt: row.created_at,
          messageText: row.message_text || "",
        };
      });

      setLatestMessageByConversation(latestByConversation);
      setConversations((prev) => sortConversationsByActivity(prev, latestByConversation));
    } catch (error) {
      // Optionally show notification
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

  function getOtherUserId(conv: Conversation) {
    if (!user) return null;
    return conv.user1_id === user.id ? conv.user2_id : conv.user1_id;
  }

  return (
    <div className="min-h-screen bg-pink-50 dark:bg-pink-950 p-0">
      {/* Back Button - above banner, left side */}
      <div className="w-full max-w-2xl mx-auto flex items-center pt-4 pb-2 px-2 sm:px-0">
        <button
          onClick={() => router.push("/home")}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full p-2 shadow hover:bg-pink-50 dark:hover:bg-pink-800 transition focus:outline-none focus:ring-2 focus:ring-pink-400"
          aria-label="Back to Home"
        >
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-pink-600">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>
      <div className="max-w-2xl mx-auto h-screen flex flex-col">
        <header className="relative flex items-center justify-center px-4 sm:px-10 pt-3 pb-2 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 text-center w-full tracking-tight">Messages</h1>
          <button
            type="button"
            aria-label={isEditMode ? "Exit edit mode" : "Edit conversations"}
            onClick={handleToggleEditMode}
            className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-900/30 transition"
          >
            {isEditMode ? (
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L12 14l-4 1 1-4 7.5-7.5z" />
              </svg>
            )}
          </button>
        </header>
        {isEditMode && conversations.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 sm:px-6 py-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAllToggle}
              className="px-3 py-1.5 rounded-full border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              {selectedConversationIds.length === conversations.length ? "Unselect All" : "Select All"}
            </button>
            <button
              type="button"
              onClick={handleMarkSelectedAsRead}
              disabled={selectedConversationIds.length === 0 || bulkActionLoading}
              className="px-3 py-1.5 rounded-full border border-pink-500 bg-pink-100 text-pink-700 text-xs font-semibold hover:bg-pink-200 disabled:opacity-60 disabled:cursor-not-allowed dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700 dark:hover:bg-pink-900/45"
            >
              Mark as Read
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteSelectedConversations()}
              disabled={selectedConversationIds.length === 0 || bulkActionLoading}
              className="px-3 py-1.5 rounded-full border border-pink-800 bg-pink-700 text-white text-xs font-semibold hover:bg-pink-800 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {bulkActionLoading ? "Deleting..." : "Delete"}
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto bg-pink-50 dark:bg-pink-950 py-2">
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
            <div className="flex flex-col gap-3">
              {conversations.map(conv => {
                const otherUser = getOtherUserInfo(conv);
                const latestInfo = latestMessageByConversation[conv.id];
                const seenAt = seenConversationAt[conv.id] || "";
                const previewText = latestInfo?.messageText || conv.last_message || "Start chatting";
                const hasUnreadIncoming =
                  Boolean(user?.id) &&
                  Boolean(latestInfo?.senderId) &&
                  latestInfo.senderId !== user.id &&
                  Boolean(latestInfo?.createdAt) &&
                  (!seenAt || new Date(latestInfo.createdAt).getTime() > new Date(seenAt).getTime());
                return (
                  <div
                    key={conv.id}
                    className="w-full text-left py-2 px-4 bg-white dark:bg-zinc-900 rounded-lg shadow-sm flex items-center gap-3 border border-pink-100 dark:border-pink-900 hover:bg-pink-50 dark:hover:bg-pink-950 transition"
                    style={{ borderBottom: '2px solid #fce4ec' }}
                    onClick={() => {
                      if (isEditMode) {
                        toggleConversationSelection(conv.id);
                        return;
                      }
                      openConversation(conv.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        if (isEditMode) {
                          toggleConversationSelection(conv.id);
                          return;
                        }
                        openConversation(conv.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    {isEditMode && (
                      <input
                        type="checkbox"
                        checked={selectedConversationIds.includes(conv.id)}
                        onChange={() => toggleConversationSelection(conv.id)}
                        onClick={(event) => event.stopPropagation()}
                        className="h-4 w-4 accent-pink-600"
                        aria-label={`Select conversation with ${otherUser.name || "mom"}`}
                      />
                    )}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {otherUser.photo ? (
                        <div className="relative">
                          <img
                            src={otherUser.photo}
                            alt={otherUser.name}
                            className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                          />
                          {hasUnreadIncoming && (
                            <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-pink-600 ring-2 ring-white dark:ring-zinc-900" />
                          )}
                        </div>
                      ) : (
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-semibold flex-shrink-0">
                            {otherUser.name?.[0]?.toUpperCase() || '?'}
                          </div>
                          {hasUnreadIncoming && (
                            <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-pink-600 ring-2 ring-white dark:ring-zinc-900" />
                          )}
                        </div>
                      )}
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-50 text-base min-h-[28px] truncate w-full text-left">{otherUser.name}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate w-full text-left">{previewText}</div>
                      </div>
                    </div>
                    {!isEditMode && (
                      <div className="flex items-center ml-2">
                        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-pink-400">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {NotificationComponent}
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
