"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { Post } from "../../types/post";

type Villager = {
  id: string;
  full_name: string | null;
  profile_photo_url: string | null;
};

type CurrentUser = {
  id: string;
  user_metadata?: {
    full_name?: string;
    profile_photo_url?: string;
  };
};

interface PostShareSheetProps {
  isOpen: boolean;
  post: Post | null;
  currentUser: CurrentUser | null;
  onClose: () => void;
  onShareTracked: (post: Post) => Promise<void>;
}

export default function PostShareSheet({
  isOpen,
  post,
  currentUser,
  onClose,
  onShareTracked,
}: PostShareSheetProps) {
  const [loadingVillagers, setLoadingVillagers] = useState(false);
  const [villagers, setVillagers] = useState<Villager[]>([]);
  const [sendingToVillagerId, setSendingToVillagerId] = useState<string | null>(
    null
  );
  const [hasTrackedShare, setHasTrackedShare] = useState(false);
  const [villagerSearch, setVillagerSearch] = useState("");
  const [selectedVillagerId, setSelectedVillagerId] = useState<string | null>(null);

  const shareUrl = useMemo(() => {
    if (!post || typeof window === "undefined") return "";
    return `${window.location.origin}/home?post=${encodeURIComponent(post.id)}`;
  }, [post]);

  const filteredVillagers = useMemo(() => {
    const query = villagerSearch.trim().toLowerCase();
    if (!query) return villagers;
    return villagers.filter((villager) =>
      (villager.full_name || "Mom").toLowerCase().includes(query)
    );
  }, [villagers, villagerSearch]);

  const selectedVillager = useMemo(
    () => villagers.find((villager) => villager.id === selectedVillagerId) || null,
    [villagers, selectedVillagerId]
  );

  useEffect(() => {
    if (!isOpen) {
      setHasTrackedShare(false);
      setSendingToVillagerId(null);
      setLoadingVillagers(false);
      setVillagerSearch("");
      setSelectedVillagerId(null);
      return;
    }
    if (!currentUser?.id) return;
    const userId = currentUser.id;

    let cancelled = false;
    async function loadVillagers() {
      setLoadingVillagers(true);
      try {
        const { data: invites, error: inviteError } = await supabase
          .from("village_invitations")
          .select("from_user_id,to_user_id,status")
          .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
          .eq("status", "accepted");
        if (inviteError) throw inviteError;

        const villagerIds = [
          ...new Set(
            (invites || [])
              .map((invite: any) =>
                invite.from_user_id === userId
                  ? invite.to_user_id
                  : invite.from_user_id
              )
              .filter((id: string) => !!id && id !== userId)
          ),
        ];

        if (villagerIds.length === 0) {
          if (!cancelled) setVillagers([]);
          return;
        }

        const { data: profiles, error: profileError } = await supabase
          .from("user_public_profiles")
          .select("id,full_name,profile_photo_url")
          .in("id", villagerIds);

        if (profileError) throw profileError;
        if (!cancelled) {
          setVillagers(
            (profiles || []).map((profile: any) => ({
              id: profile.id,
              full_name: profile.full_name || "Mom",
              profile_photo_url: profile.profile_photo_url || null,
            }))
          );
        }
      } catch {
        if (!cancelled) setVillagers([]);
      } finally {
        if (!cancelled) setLoadingVillagers(false);
      }
    }

    void loadVillagers();
    return () => {
      cancelled = true;
    };
  }, [isOpen, currentUser?.id]);

  async function trackShareIfNeeded() {
    if (!post || hasTrackedShare) return;
    await onShareTracked(post);
    setHasTrackedShare(true);
  }

  async function handleCopyLink() {
    if (!shareUrl) return;
    await trackShareIfNeeded();
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
      alert("Post link copied to clipboard.");
      return;
    }
    alert("Could not access clipboard on this device.");
  }

  async function handleTextMessage() {
    if (!post || !shareUrl) return;
    await trackShareIfNeeded();
    const smsText = `Check out this post on Mom Village: ${post.title}\n${shareUrl}`;
    if (typeof window !== "undefined") {
      window.location.href = `sms:?&body=${encodeURIComponent(smsText)}`;
    }
  }

  async function handleOtherShare() {
    if (!post || !shareUrl) return;
    await trackShareIfNeeded();
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      await (navigator as any).share({
        title: post.title,
        text: post.content,
        url: shareUrl,
      });
      return;
    }
    await handleCopyLink();
  }

  async function ensureConversation(villager: Villager) {
    if (!currentUser?.id) throw new Error("You must be signed in.");

    const { data: existingConvos, error: convoError } = await supabase
      .from("conversations")
      .select("id")
      .or(
        `and(user1_id.eq.${currentUser.id},user2_id.eq.${villager.id}),and(user1_id.eq.${villager.id},user2_id.eq.${currentUser.id})`
      )
      .limit(1);

    if (convoError) throw convoError;
    if (existingConvos && existingConvos.length > 0) return existingConvos[0].id;

    const { data: newConvo, error: createError } = await supabase
      .from("conversations")
      .insert({
        user1_id: currentUser.id,
        user2_id: villager.id,
        user1_name: currentUser.user_metadata?.full_name || "Mom",
        user2_name: villager.full_name || "Mom",
        user1_photo: currentUser.user_metadata?.profile_photo_url || "",
        user2_photo: villager.profile_photo_url || "",
      })
      .select("id")
      .single();

    if (createError || !newConvo) {
      throw new Error("Failed to create conversation.");
    }
    return newConvo.id;
  }

  async function handleShareToVillager(villager: Villager) {
    if (!post || !currentUser?.id || !shareUrl) return;
    setSendingToVillagerId(villager.id);
    try {
      const conversationId = await ensureConversation(villager);
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: currentUser.id,
        receiver_id: villager.id,
        message_text: `Check out this post: ${shareUrl}`,
      });
      await supabase
        .from("conversations")
        .update({
          last_message: "Shared a post",
          last_message_time: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId);

      await trackShareIfNeeded();
      alert(`Shared with ${villager.full_name || "your villager"}.`);
      onClose();
    } catch (error: any) {
      alert(error?.message || "Failed to share with villager.");
    } finally {
      setSendingToVillagerId(null);
    }
  }

  async function handleSendToSelectedVillager() {
    if (!selectedVillager) return;
    await handleShareToVillager(selectedVillager);
  }

  if (!isOpen || !post) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 p-3 sm:p-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
        <div className="relative px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 text-pink-600 hover:text-pink-700 dark:text-pink-300 dark:hover:text-pink-200 text-2xl font-bold"
            aria-label="Close share popup"
          >
            ×
          </button>
          <div className="text-lg font-bold text-zinc-900 dark:text-zinc-50 pr-8">Share Post</div>
          <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 truncate pr-8">{post.title}</div>
        </div>

        <div className="p-4 space-y-3">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2 flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
              stroke="currentColor"
              className="w-4 h-4 text-zinc-500"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-4.35-4.35m0 0A7.5 7.5 0 1 0 6.3 6.3a7.5 7.5 0 0 0 10.6 10.6Z"
              />
            </svg>
            <input
              value={villagerSearch}
              onChange={(event) => setVillagerSearch(event.target.value)}
              placeholder="Search villagers"
              className="w-full bg-transparent outline-none text-sm text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400"
            />
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <div className="max-h-56 overflow-y-auto">
              {loadingVillagers ? (
                <div className="px-3 py-3 text-sm text-zinc-500">Loading villagers...</div>
              ) : filteredVillagers.length === 0 ? (
                <div className="px-3 py-3 text-sm text-zinc-500">No village members available yet.</div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-3">
                  {filteredVillagers.map((villager) => (
                    <button
                      key={villager.id}
                      type="button"
                      onClick={() => setSelectedVillagerId(villager.id)}
                      className="flex flex-col items-center gap-1 text-center"
                    >
                      {villager.profile_photo_url ? (
                        <img
                          src={villager.profile_photo_url}
                          alt={villager.full_name || "Mom"}
                          className={`w-14 h-14 rounded-full object-cover border-2 transition ${
                            selectedVillagerId === villager.id
                              ? "border-pink-500 ring-2 ring-pink-300"
                              : "border-zinc-200 dark:border-zinc-700"
                          }`}
                        />
                      ) : (
                        <div
                          className={`w-14 h-14 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 text-white flex items-center justify-center font-semibold border-2 transition ${
                            selectedVillagerId === villager.id
                              ? "border-pink-500 ring-2 ring-pink-300"
                              : "border-pink-300"
                          }`}
                        >
                          {(villager.full_name || "M").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 leading-tight px-1 w-full max-w-[72px] truncate">
                        {villager.full_name || "Mom"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selectedVillager && (
            <button
              type="button"
              onClick={() => void handleSendToSelectedVillager()}
              disabled={sendingToVillagerId === selectedVillager.id}
              className="w-full rounded-xl border border-pink-500 bg-pink-100 text-pink-700 hover:bg-pink-200 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700 dark:hover:bg-pink-900/45 px-4 py-3 text-sm font-bold disabled:opacity-60"
            >
              {sendingToVillagerId === selectedVillager.id
                ? "Sending..."
                : `Send to ${selectedVillager.full_name || "Villager"}`}
            </button>
          )}
        </div>

        <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => void handleTextMessage()}
              className="flex flex-col items-center gap-1 rounded-xl border border-pink-300 bg-pink-50 text-pink-700 hover:bg-pink-100 dark:bg-pink-900/20 dark:border-pink-700 dark:text-pink-200 px-2 py-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75h6.75m-6.75 3h4.5M3.75 19.5h16.5a.75.75 0 0 0 .75-.75V5.25a.75.75 0 0 0-.75-.75H3.75a.75.75 0 0 0-.75.75v13.5a.75.75 0 0 0 .75.75Z" />
              </svg>
              <span className="text-xs font-semibold">Text</span>
            </button>

            <button
              type="button"
              onClick={() => void handleCopyLink()}
              className="flex flex-col items-center gap-1 rounded-xl border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 px-2 py-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H17a4 4 0 0 1 0 8h-3m-4 0H7a4 4 0 0 1 0-8h3m-1.5 8h7" />
              </svg>
              <span className="text-xs font-semibold">Copy Link</span>
            </button>

            <button
              type="button"
              onClick={() => void handleOtherShare()}
              className="flex flex-col items-center gap-1 rounded-xl border border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/20 dark:border-purple-700 dark:text-purple-200 px-2 py-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 1 0 0 0.001M12 12a.75.75 0 1 0 0 0.001M17.25 12a.75.75 0 1 0 0 0.001" />
              </svg>
              <span className="text-xs font-semibold">Other</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
