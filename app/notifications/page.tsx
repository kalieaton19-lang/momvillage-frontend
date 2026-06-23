"use client";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import InvitationsTab from "./InvitationsTab";
import { supabase } from "../../lib/supabase";

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'invitations'>('all');
  const [user, setUser] = useState<any>(null);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [supportOffers, setSupportOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const invitationsRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  async function ensureConversationWithOfferer(
    offererUserId: string,
    offererName: string,
    offererPhoto?: string | null,
  ) {
    if (!user?.id) throw new Error("You must be signed in.");

    const { data: existingConvos, error: convoError } = await supabase
      .from("conversations")
      .select("id")
      .or(
        `and(user1_id.eq.${user.id},user2_id.eq.${offererUserId}),and(user1_id.eq.${offererUserId},user2_id.eq.${user.id})`
      )
      .order("updated_at", { ascending: false })
      .order("last_message_time", { ascending: false })
      .limit(1);

    if (convoError) throw convoError;
    if (existingConvos && existingConvos.length > 0) return existingConvos[0].id;

    const { data: newConvo, error: createError } = await supabase
      .from("conversations")
      .insert({
        user1_id: user.id,
        user2_id: offererUserId,
        user1_name: user.user_metadata?.full_name || "Mom",
        user2_name: offererName || "Mom",
        user1_photo: user.user_metadata?.profile_photo_url || "",
        user2_photo: offererPhoto || "",
      })
      .select("id")
      .single();

    if (createError || !newConvo) throw new Error("Failed to open message thread.");
    return newConvo.id;
  }

  async function handleOpenSupportConversation(offer: any) {
    try {
      const offererName = offer?.offered_by_profile?.full_name || "Mom";
      const offererPhoto = offer?.offered_by_profile?.profile_photo_url || "";
      const conversationId = await ensureConversationWithOfferer(
        offer.offered_by_user_id,
        offererName,
        offererPhoto,
      );

      const postId = String(offer?.post_id || "").trim();
      const postTitle = String(offer?.posts?.title || "Support Post").trim();
      const postUrl = typeof window !== "undefined"
        ? `${window.location.origin}/home?post=${encodeURIComponent(postId)}`
        : `/home?post=${encodeURIComponent(postId)}`;

      if (postId) {
        const { data: existingSupportMsg } = await supabase
          .from("messages")
          .select("id")
          .eq("conversation_id", conversationId)
          .or(`message_text.ilike.%post=${postId}%,message_text.ilike.%${postTitle}%`)
          .order("created_at", { ascending: false })
          .limit(1);

        if (!existingSupportMsg || existingSupportMsg.length === 0) {
          const coordinationText = `${offererName} offered support with ${postTitle}! Message now to coordinate: ${postUrl}`;
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            sender_id: user.id,
            receiver_id: offer.offered_by_user_id,
            message_text: coordinationText,
          });

          await supabase
            .from("conversations")
            .update({
              last_message: coordinationText,
              last_message_time: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", conversationId);
        }
      }

      const supportPostId = String(offer?.post_id || "").trim();
      if (supportPostId) {
        router.push(`/messages/${conversationId}?supportOfferForPost=${encodeURIComponent(supportPostId)}`);
      } else {
        router.push(`/messages/${conversationId}`);
      }
    } catch (error: any) {
      alert(error?.message || "Could not open messages.");
    }
  }

  async function fetchUserAndInvitations(options?: { preserveLoading?: boolean; userOverride?: any }) {
    const preserveLoading = options?.preserveLoading ?? false;
    if (!preserveLoading) {
      setLoading(true);
    }

    const currentUser = options?.userOverride ?? (await supabase.auth.getUser()).data.user;
    console.log('[DEBUG][notifications] currentUser:', currentUser);
    setUser(currentUser);
    if (!currentUser) {
      setInvitations([]);
      setLoading(false);
      return;
    }

    const { data: invites, error: invitesError } = await supabase
      .from("village_invitations")
      .select("*")
      .or(`from_user_id.eq.${currentUser.id},to_user_id.eq.${currentUser.id}`);
    if (invitesError) {
      console.log('[DEBUG][notifications] invitations fetch error:', invitesError);
      setLoading(false);
      return;
    }

    const userIds = Array.from(new Set([
      ...(invites || []).map((invitation: any) => invitation.from_user_id),
      ...(invites || []).map((invitation: any) => invitation.to_user_id),
    ]));

    let profiles: any[] = [];
    if (userIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from("user_public_profiles")
        .select("id, full_name, profile_photo_url, city, state")
        .in("id", userIds);
      if (profilesError) {
        console.log('[DEBUG][notifications] profiles fetch error:', profilesError);
      } else {
        profiles = profilesData || [];
      }
    }

    const profilesById = Object.fromEntries(profiles.map((profile: any) => [profile.id, profile]));
    const mergedInvites = (invites || []).map((invitation: any) => ({
      ...invitation,
      from_user_profile: profilesById[invitation.from_user_id] || null,
      to_user_profile: profilesById[invitation.to_user_id] || null,
    }));
    console.log('[DEBUG][notifications] merged invitations:', mergedInvites);
    setInvitations(mergedInvites);

    const { data: supportRows, error: supportError } = await supabase
      .from("post_support_offers")
      .select("id,post_id,offered_by_user_id,created_at,posts!inner(id,title,author_user_id)")
      .eq("posts.author_user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (supportError) {
      console.log('[DEBUG][notifications] support offers fetch error:', supportError);
      setSupportOffers([]);
      setLoading(false);
      return;
    }

    const supportOfferUserIds = Array.from(
      new Set((supportRows || []).map((entry: any) => entry.offered_by_user_id).filter(Boolean))
    );

    let supportProfilesById: Record<string, any> = {};
    if (supportOfferUserIds.length > 0) {
      const { data: supportProfiles } = await supabase
        .from("user_public_profiles")
        .select("id, full_name, profile_photo_url")
        .in("id", supportOfferUserIds);

      supportProfilesById = Object.fromEntries((supportProfiles || []).map((entry: any) => [entry.id, entry]));
    }

    const mergedSupportOffers = (supportRows || []).map((entry: any) => ({
      ...entry,
      offered_by_profile: supportProfilesById[entry.offered_by_user_id] || null,
    }));
    setSupportOffers(mergedSupportOffers);
    setLoading(false);
  }

  useEffect(() => {
    void fetchUserAndInvitations();
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const scheduleInvitationRefresh = () => {
      if (invitationsRefreshTimeoutRef.current) {
        clearTimeout(invitationsRefreshTimeoutRef.current);
      }
      invitationsRefreshTimeoutRef.current = setTimeout(() => {
        void fetchUserAndInvitations({ preserveLoading: true, userOverride: user });
      }, 250);
    };

    const channel = supabase
      .channel(`notifications-invitations-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "village_invitations", filter: `to_user_id=eq.${user.id}` },
        scheduleInvitationRefresh,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "village_invitations", filter: `to_user_id=eq.${user.id}` },
        scheduleInvitationRefresh,
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "village_invitations", filter: `to_user_id=eq.${user.id}` },
        scheduleInvitationRefresh,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "village_invitations", filter: `from_user_id=eq.${user.id}` },
        scheduleInvitationRefresh,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "village_invitations", filter: `from_user_id=eq.${user.id}` },
        scheduleInvitationRefresh,
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "village_invitations", filter: `from_user_id=eq.${user.id}` },
        scheduleInvitationRefresh,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "post_support_offers" },
        scheduleInvitationRefresh,
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "post_support_offers" },
        scheduleInvitationRefresh,
      )
      .subscribe();

    return () => {
      if (invitationsRefreshTimeoutRef.current) {
        clearTimeout(invitationsRefreshTimeoutRef.current);
        invitationsRefreshTimeoutRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const invitationsIntervalId = window.setInterval(() => {
      void fetchUserAndInvitations({ preserveLoading: true, userOverride: user });
    }, 8000);

    return () => {
      window.clearInterval(invitationsIntervalId);
    };
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-pink-50 dark:bg-zinc-900 w-full">
      {/* Back Button - top left */}
      <div className="w-full max-w-2xl mx-auto flex items-center pt-4 pb-2 px-2 sm:px-0">
        <button
          onClick={() => router.back()}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full p-2 shadow hover:bg-pink-50 dark:hover:bg-pink-800 transition focus:outline-none focus:ring-2 focus:ring-pink-400"
          aria-label="Back"
        >
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-pink-600">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>
      {/* White title banner */}
      <div className="w-full py-6 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 text-center rounded-none">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Notifications</h1>
      </div>
      {/* Tabs */}
      <div className="flex gap-0 w-full pt-6 pb-0 bg-transparent border-b border-zinc-200 dark:border-zinc-800 max-w-2xl mx-auto">
        <button
          className={`flex-1 py-2 px-4 font-medium text-base border-t border-l border-r rounded-t-2xl transition-all ${
            activeTab === 'all'
              ? 'bg-white dark:bg-zinc-900 text-pink-600 border-pink-500 z-10'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-200 border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-700'
          }`}
          style={{ marginBottom: activeTab === 'all' ? '-1px' : '0' }}
          onClick={() => setActiveTab('all')}
        >
          All
        </button>
        <button
          className={`flex-1 py-2 px-4 font-medium text-base border-t border-l border-r rounded-t-2xl transition-all ${
            activeTab === 'invitations'
              ? 'bg-white dark:bg-zinc-900 text-pink-600 border-pink-500 z-10'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-200 border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-700'
          }`}
          style={{ marginBottom: activeTab === 'invitations' ? '-1px' : '0' }}
          onClick={() => setActiveTab('invitations')}
        >
          Invitations
        </button>
      </div>
      <div className="flex flex-col items-center justify-start pt-12">
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow p-6 w-full max-w-2xl min-h-[300px]">
          {loading ? (
            <div className="text-zinc-500 dark:text-zinc-300 text-center">Loading...</div>
          ) : activeTab === 'all' ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-3">Support Offers</h2>
                {supportOffers.length === 0 ? (
                  <div className="text-sm text-zinc-500 dark:text-zinc-300">No support offers yet.</div>
                ) : (
                  <div className="space-y-3">
                    {supportOffers.map((offer: any) => {
                      const displayName = offer.offered_by_profile?.full_name || "A mom";
                      const postTitle = offer.posts?.title || "your support post";
                      return (
                        <button
                          key={offer.id}
                          type="button"
                          onClick={() => void handleOpenSupportConversation(offer)}
                          className="w-full text-left rounded-xl border border-pink-200 dark:border-pink-800 bg-pink-50 dark:bg-pink-900/20 p-3 hover:bg-pink-100 dark:hover:bg-pink-900/35 transition"
                        >
                          <div className="text-sm text-zinc-800 dark:text-zinc-100">
                            <span className="font-semibold">{displayName}</span> offered support on <span className="font-semibold">{postTitle}</span>. Message here to coordinate support.
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            {new Date(offer.created_at).toLocaleString()}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-3">Invitations</h2>
                <InvitationsTab
                  invitations={invitations.filter(inv => inv.to_user_id === user?.id)}
                  user={user}
                />
              </div>
            </div>
          ) : (
            <InvitationsTab
              invitations={invitations.filter(inv =>
                (inv.from_user_id === user?.id && (inv.status === 'pending' || inv.status === 'resent')) ||
                inv.status === 'accepted'
              )}
              user={user}
            />
          )}
        </div>
      </div>
    </div>
  );
}
