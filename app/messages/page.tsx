
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

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
}



function MessagesPageInner() {
  const [user, setUser] = useState<any>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const router = useRouter();

  function getProfileHref(otherUserId?: string | null) {
    if (!otherUserId) return null;
    return otherUserId === user?.id ? "/profile" : `/profile/${otherUserId}`;
  }

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadConversations(user.id);
    }
  }, [user]);

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

  async function loadConversations(userId: string) {
    try {
      const convosRes = await supabase
        .from("conversations")
        .select("*")
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order("updated_at", { ascending: false });
      if (convosRes.error) throw convosRes.error;
      setConversations(convosRes.data || []);
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
        </header>
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
                const otherUserId = getOtherUserId(conv);
                const profileHref = getProfileHref(otherUserId);
                return (
                  <div
                    key={conv.id}
                    className="w-full text-left py-2 px-4 bg-white dark:bg-zinc-900 rounded-lg shadow-sm flex items-center gap-3 border border-pink-100 dark:border-pink-900 hover:bg-pink-50 dark:hover:bg-pink-950 transition"
                    style={{ borderBottom: '2px solid #fce4ec' }}
                    onClick={() => router.push(`/messages/${conv.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        router.push(`/messages/${conv.id}`);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    {profileHref ? (
                      <button
                        type="button"
                        className="flex items-center gap-3 min-w-0"
                        onClick={(event) => {
                          event.stopPropagation();
                          router.push(profileHref);
                        }}
                      >
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
                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="font-semibold text-zinc-900 dark:text-zinc-50 text-base min-h-[28px] truncate w-full text-left hover:underline">{otherUser.name}</div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate w-full text-left">{conv.last_message}</div>
                        </div>
                      </button>
                    ) : (
                      <div className="flex items-center gap-3 min-w-0 flex-1">
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
                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="font-semibold text-zinc-900 dark:text-zinc-50 text-base min-h-[28px] truncate w-full text-left">{otherUser.name}</div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate w-full text-left">{conv.last_message}</div>
                        </div>
                      </div>
                    )}
                    {profileHref && <div className="flex-1" />}
                    <div className="flex items-center ml-2">
                      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-pink-400">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                );
              })}
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
