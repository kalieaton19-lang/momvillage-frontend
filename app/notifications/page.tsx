"use client";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import InvitationsTab from "./InvitationsTab";
import { supabase } from "../../lib/supabase";

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'invitations'>('all');
  const [user, setUser] = useState<any>(null);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const invitationsRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

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
      .subscribe();

    return () => {
      if (invitationsRefreshTimeoutRef.current) {
        clearTimeout(invitationsRefreshTimeoutRef.current);
        invitationsRefreshTimeoutRef.current = null;
      }
      void supabase.removeChannel(channel);
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
            <InvitationsTab
              invitations={invitations.filter(inv => inv.to_user_id === user?.id)}
              user={user}
            />
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
