
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useNotification } from "../components/useNotification";

interface MomProfile {
  id: string;
  user_metadata?: {
    full_name?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    number_of_kids?: number;
    kids_age_groups?: string[];
    preferred_language?: string;
    parenting_style?: string;
    profile_photo_url?: string;
    services_offered?: string[];
    services_needed?: string[];
  };
}

type MomRelationshipStatus = "none" | "invited" | "in_village";

function getSafeDisplayName(fullName?: string | null): string {
  const normalized = (fullName || "").trim();
  if (!normalized) return "Mom";
  const emailLocalPart = normalized.includes("@")
    ? normalized.split("@")[0]
    : normalized;

  const cleaned = emailLocalPart
    .replace(/[._-]+/g, " ")
    .replace(/[0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "Mom";

  const withWordBreaks = cleaned.replace(/([a-z])([A-Z])/g, "$1 $2");
  const words = withWordBreaks.split(" ").filter(Boolean);

  const pretty = words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
    .trim();

  return pretty || "Mom";
}

export default function FindMomsPage() {
  const router = useRouter();
  const [moms, setMoms] = useState<MomProfile[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [user, setUser] = useState<any>(null);
  const [searchMode, setSearchMode] = useState<"name" | "messages">("name");
  const [searchQuery, setSearchQuery] = useState("");
  const [messagedUserIds, setMessagedUserIds] = useState<Set<string>>(new Set());
  const [relationshipStatusByMomId, setRelationshipStatusByMomId] = useState<Record<string, MomRelationshipStatus>>({});
  const [statusLoadingByMomId, setStatusLoadingByMomId] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function fetchMoms() {
      setLoading(true);
      try {
        // Get current user from Supabase auth (always latest metadata)
        const { data: { user: authUser } } = await supabase.auth.getUser();
        setUser(authUser);
        // Fetch all public profiles (with photos) for the moms list
        let res, json;
        try {
          res = await supabase
            .from('user_public_profiles')
            .select('id,full_name,city,state,zip_code,number_of_kids,kids_age_groups,preferred_language,parenting_style,profile_photo_url,services_offered,services_needed');
          json = { users: res.data };
        } catch (fetchErr) {
          if (typeof window !== 'undefined') {
            console.error('Error fetching user_public_profiles:', fetchErr);
          }
          setMoms([]);
          setLoadError('Failed to fetch users');
          setLoading(false);
          return;
        }
        if (!json?.users) {
          setMoms([]);
          setLoadError('Failed to load users');
          setLoading(false);
          return;
        }
        const users = (json?.users || []) as Array<any>;
        // Exclude current user from moms list
        const otherMoms: MomProfile[] = (users || [])
          .filter((u: any) => u.id !== authUser?.id)
          .map((u: any) => ({
            id: u.id,
            user_metadata: {
              full_name: getSafeDisplayName(u.full_name),
              city: u.city,
              state: u.state,
              zip_code: u.zip_code,
              number_of_kids: u.number_of_kids,
              kids_age_groups: u.kids_age_groups,
              preferred_language: u.preferred_language,
              parenting_style: u.parenting_style,
              profile_photo_url: u.profile_photo_url || '',
              services_offered: u.services_offered,
              services_needed: u.services_needed,
            },
          })) || [];
        setMoms(otherMoms);
        setLoadError(null);
      } catch (err: any) {
        setMoms([]);
        setLoadError(err?.message || 'Unknown error');
      }
      setLoading(false);
    }
    fetchMoms();
  }, []);

  useEffect(() => {
    async function loadMessagedUsers() {
      if (!user?.id) {
        setMessagedUserIds(new Set());
        return;
      }
      const { data, error } = await supabase
        .from("conversations")
        .select("user1_id,user2_id")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);
      if (error) {
        setMessagedUserIds(new Set());
        return;
      }
      const ids = new Set<string>();
      (data || []).forEach((row: any) => {
        if (row.user1_id === user.id && row.user2_id) ids.add(row.user2_id);
        if (row.user2_id === user.id && row.user1_id) ids.add(row.user1_id);
      });
      setMessagedUserIds(ids);
    }
    loadMessagedUsers();
  }, [user?.id]);

  useEffect(() => {
    async function loadRelationshipStatuses() {
      if (!user?.id || moms.length === 0) {
        setRelationshipStatusByMomId({});
        return;
      }

      const momIdSet = new Set(moms.map((mom) => mom.id));
      const defaultStatuses: Record<string, MomRelationshipStatus> = {};
      moms.forEach((mom) => {
        defaultStatuses[mom.id] = "none";
      });

      const { data, error } = await supabase
        .from("village_invitations")
        .select("from_user_id,to_user_id,status")
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`);

      if (error) {
        setRelationshipStatusByMomId(defaultStatuses);
        return;
      }

      (data || []).forEach((invite: any) => {
        const otherUserId = invite.from_user_id === user.id ? invite.to_user_id : invite.from_user_id;
        if (!otherUserId || !momIdSet.has(otherUserId)) return;

        if (invite.status === "accepted") {
          defaultStatuses[otherUserId] = "in_village";
          return;
        }

        if (
          invite.status === "pending" &&
          invite.from_user_id === user.id &&
          defaultStatuses[otherUserId] !== "in_village"
        ) {
          defaultStatuses[otherUserId] = "invited";
        }
      });

      setRelationshipStatusByMomId(defaultStatuses);
    }

    void loadRelationshipStatuses();
  }, [user?.id, moms]);

  async function handleInviteToVillage(momId: string) {
    if (!user?.id) {
      return { ok: false, message: "Please sign in to invite moms." };
    }

    setStatusLoadingByMomId((prev) => ({ ...prev, [momId]: true }));
    try {
      const { error } = await supabase
        .from("village_invitations")
        .insert({ from_user_id: user.id, to_user_id: momId, status: "pending" });

      if (error) throw error;

      setRelationshipStatusByMomId((prev) => ({ ...prev, [momId]: "invited" }));
      return { ok: true, message: "Invitation sent!" };
    } catch (error) {
      const errMsg =
        error && typeof error === "object" && "message" in error
          ? (error as Error).message
          : "Failed to send invitation.";
      return { ok: false, message: errMsg };
    } finally {
      setStatusLoadingByMomId((prev) => ({ ...prev, [momId]: false }));
    }
  }

  async function handleUninvite(momId: string) {
    if (!user?.id) {
      return { ok: false, message: "Please sign in to manage invitations." };
    }

    setStatusLoadingByMomId((prev) => ({ ...prev, [momId]: true }));
    try {
      const { error } = await supabase
        .from("village_invitations")
        .delete()
        .eq("from_user_id", user.id)
        .eq("to_user_id", momId)
        .eq("status", "pending");

      if (error) throw error;

      setRelationshipStatusByMomId((prev) => ({ ...prev, [momId]: "none" }));
      return { ok: true, message: "Invitation removed." };
    } catch (error) {
      const errMsg =
        error && typeof error === "object" && "message" in error
          ? (error as Error).message
          : "Failed to remove invitation.";
      return { ok: false, message: errMsg };
    } finally {
      setStatusLoadingByMomId((prev) => ({ ...prev, [momId]: false }));
    }
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const nameSuggestions =
    searchMode === "name" && normalizedQuery
      ? moms.filter((mom) =>
          getSafeDisplayName(mom.user_metadata?.full_name)
            .toLowerCase()
            .includes(normalizedQuery),
        )
      : [];

  const messagesVisibleMoms = moms
    .filter((mom) => messagedUserIds.has(mom.id))
    .filter((mom) => {
      if (!normalizedQuery) return true;
      return getSafeDisplayName(mom.user_metadata?.full_name)
        .toLowerCase()
        .includes(normalizedQuery);
    });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pink-50 dark:bg-pink-950 p-0 sm:p-4">
      <div className="w-full max-w-5xl mx-auto flex items-center pt-4 pb-2 px-2 sm:px-0">
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

      <div className="w-full mb-5 bg-white dark:bg-zinc-900 border-y border-zinc-200 dark:border-zinc-800 px-4 py-3">
        <h1 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-zinc-50 text-center">
          Find Moms
        </h1>
      </div>

      <div className="max-w-5xl mx-auto px-2 sm:px-0">

        <div className="space-y-5">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6">
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setSearchMode("name")}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${searchMode === "name" ? "bg-pink-100 text-pink-700 border-pink-500 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700" : "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700"}`}
              >
                Search by Name
              </button>
              <button
                onClick={() => setSearchMode("messages")}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${searchMode === "messages" ? "bg-pink-100 text-pink-700 border-pink-500 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700" : "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700"}`}
              >
                Search by Messages
              </button>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={searchMode === "name" ? "Search moms by name..." : "Search moms you've messaged..."}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
          </div>

          {loadError ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 text-red-700 dark:text-red-300">
              {loadError}
            </div>
          ) : searchMode === "name" ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4">
              {!normalizedQuery ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Start typing a name to see matching moms.
                </p>
              ) : nameSuggestions.length === 0 ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  No matching names found.
                </p>
              ) : (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
                  {nameSuggestions.map((mom) => (
                    <NameSuggestionRow
                      key={mom.id}
                      mom={mom}
                      relationshipStatus={relationshipStatusByMomId[mom.id] || "none"}
                      statusLoading={!!statusLoadingByMomId[mom.id]}
                      onInvite={handleInviteToVillage}
                      onUninvite={handleUninvite}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : messagesVisibleMoms.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 text-center">
              <h3 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                No moms found
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                No moms from your messages matched this search.
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {messagesVisibleMoms.map((mom) => (
                <MomCard
                  key={mom.id}
                  mom={mom}
                  relationshipStatus={relationshipStatusByMomId[mom.id] || "none"}
                  statusLoading={!!statusLoadingByMomId[mom.id]}
                  onInvite={handleInviteToVillage}
                  onUninvite={handleUninvite}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface MomCardProps {
  mom: MomProfile;
  relationshipStatus: MomRelationshipStatus;
  statusLoading: boolean;
  onInvite: (momId: string) => Promise<{ ok: boolean; message: string }>;
  onUninvite: (momId: string) => Promise<{ ok: boolean; message: string }>;
}

interface NameSuggestionRowProps {
  mom: MomProfile;
  relationshipStatus: MomRelationshipStatus;
  statusLoading: boolean;
  onInvite: (momId: string) => Promise<{ ok: boolean; message: string }>;
  onUninvite: (momId: string) => Promise<{ ok: boolean; message: string }>;
}

function NameSuggestionRow({ mom, relationshipStatus, statusLoading, onInvite, onUninvite }: NameSuggestionRowProps) {
  const { showNotification, NotificationComponent } = useNotification();

  async function handleInviteClick() {
    const result = await onInvite(mom.id);
    showNotification(result.message);
  }

  async function handleInvitedClick() {
    const shouldUninvite = window.confirm(
      `Uninvite ${getSafeDisplayName(mom.user_metadata?.full_name)}?`
    );
    if (!shouldUninvite) {
      return;
    }

    const result = await onUninvite(mom.id);
    showNotification(result.message);
  }

  return (
    <div className="px-4 py-3 flex items-center justify-between gap-3 bg-white dark:bg-zinc-900">
      <div className="flex items-center gap-3 min-w-0">
        {mom.user_metadata?.profile_photo_url ? (
          <img
            src={mom.user_metadata.profile_photo_url}
            alt={getSafeDisplayName(mom.user_metadata?.full_name)}
            className="w-11 h-11 rounded-full object-cover border-2 border-pink-300 flex-shrink-0"
          />
        ) : (
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-semibold flex-shrink-0">
            {getSafeDisplayName(mom.user_metadata?.full_name).charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-bold text-zinc-900 dark:text-zinc-50 truncate">
            {getSafeDisplayName(mom.user_metadata?.full_name)}
          </div>
          {(mom.user_metadata?.city || mom.user_metadata?.state) && (
            <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
              {[mom.user_metadata?.city, mom.user_metadata?.state].filter(Boolean).join(", ")}
            </div>
          )}
        </div>
      </div>
      <button
        onClick={
          relationshipStatus === "invited"
            ? () => void handleInvitedClick()
            : () => void handleInviteClick()
        }
        disabled={statusLoading || relationshipStatus === "in_village"}
        className={`shrink-0 px-3 py-1.5 border rounded-full text-xs font-semibold transition-colors ${
          relationshipStatus === "in_village"
            ? "bg-green-100 text-green-700 border-green-500 dark:bg-green-900/30 dark:text-green-200 dark:border-green-700"
            : relationshipStatus === "invited"
            ? "bg-zinc-200 text-zinc-700 border-zinc-400 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:border-zinc-500 dark:hover:bg-zinc-600"
            : "bg-pink-100 hover:bg-pink-200 text-pink-700 border-pink-500 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700 dark:hover:bg-pink-900/45"
        } ${statusLoading ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        {relationshipStatus === "in_village"
          ? "In Your Village"
          : relationshipStatus === "invited"
          ? statusLoading
            ? "Updating..."
            : "Invited"
          : statusLoading
          ? "Sending..."
          : "Invite"}
      </button>
      {NotificationComponent}
    </div>
  );
}



function MomCard({ mom, relationshipStatus, statusLoading, onInvite, onUninvite }: MomCardProps) {
  const router = useRouter();
  const metadata = mom.user_metadata;
  const { showNotification, NotificationComponent } = useNotification();

  async function handleInviteClick() {
    const result = await onInvite(mom.id);
    showNotification(result.message);
  }

  async function handleInvitedClick() {
    const shouldUninvite = window.confirm(
      `Uninvite ${getSafeDisplayName(metadata?.full_name)}?`
    );
    if (!shouldUninvite) {
      return;
    }

    const result = await onUninvite(mom.id);
    showNotification(result.message);
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start gap-4">
        {metadata?.profile_photo_url ? (
          <img
            src={metadata.profile_photo_url}
            alt={getSafeDisplayName(metadata?.full_name)}
            className="w-16 h-16 rounded-full object-cover border-2 border-pink-300"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white text-xl font-semibold">
            {getSafeDisplayName(metadata?.full_name).charAt(0).toUpperCase() || '?'}
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {getSafeDisplayName(metadata?.full_name)}
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {metadata?.city}, {metadata?.state}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {metadata?.number_of_kids && (
              <span className="text-xs px-2 py-1 bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-full">
                {metadata.number_of_kids} kid{metadata.number_of_kids !== 1 ? 's' : ''}
              </span>
            )}
            {Array.isArray(metadata?.kids_age_groups) && metadata.kids_age_groups.map(age => (
              <span key={age} className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
                {age}
              </span>
            ))}
            {metadata?.parenting_style && (
              <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                {metadata.parenting_style}
              </span>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={
                relationshipStatus === "invited"
                  ? () => void handleInvitedClick()
                  : () => void handleInviteClick()
              }
              disabled={statusLoading || relationshipStatus === "in_village"}
              className={`flex-1 px-4 py-2 border rounded-full text-sm font-medium transition-colors ${
                relationshipStatus === "in_village"
                  ? "bg-green-100 text-green-700 border-green-500 dark:bg-green-900/30 dark:text-green-200 dark:border-green-700"
                  : relationshipStatus === "invited"
                  ? "bg-zinc-200 text-zinc-700 border-zinc-400 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:border-zinc-500 dark:hover:bg-zinc-600"
                  : "bg-pink-100 hover:bg-pink-200 text-pink-700 border-pink-500 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700 dark:hover:bg-pink-900/45"
              } ${statusLoading ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              {relationshipStatus === "in_village"
                ? "In Your Village"
                : relationshipStatus === "invited"
                ? statusLoading
                  ? "Updating..."
                  : "Invited"
                : statusLoading
                ? "Sending..."
                : "Invite to Village"}
            </button>
            <button
              onClick={() => router.push(`/messages`)}
              className="flex-1 px-4 py-2 bg-pink-100 hover:bg-pink-200 text-pink-700 border border-pink-500 rounded-full text-sm font-medium transition-colors dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700 dark:hover:bg-pink-900/45"
            >
              Go to Messages
            </button>
          </div>
          {NotificationComponent}
        </div>
      </div>
    </div>
  );
}
