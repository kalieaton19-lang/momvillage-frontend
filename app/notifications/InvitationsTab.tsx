"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";


export default function InvitationsTab({ invitations, user }: { invitations: any[], user: any }) {
  const [selectedInvitation, setSelectedInvitation] = useState<any>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const router = useRouter();

  function getProfileHref(profileId?: string | null) {
    if (!profileId) return null;
    return profileId === user?.id ? "/profile" : `/profile/${profileId}`;
  }

  if (!invitations || invitations.length === 0) {
    return <div className="text-zinc-500">No invitations found.</div>;
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
        {invitations.map((inv) => {
          // Use merged profiles
          const otherUser = inv.from_user_id === user?.id ? inv.to_user_profile : inv.from_user_profile;
          const profileHref = getProfileHref(otherUser?.id);
          return (
            <div
              key={inv.id}
              className={`flex items-center gap-2 p-3 rounded-xl border ${inv.status === "pending" ? "border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20" : inv.status === "accepted" ? "border-green-300 bg-green-50 dark:bg-green-900/20" : inv.status === "declined" ? "border-zinc-300 bg-zinc-50 dark:bg-zinc-900/20" : "border-pink-300 bg-pink-50 dark:bg-pink-900/20"} w-full max-w-md mx-auto hover:shadow transition-all focus:outline-none focus:ring-1 focus:ring-pink-400`}
              style={{ cursor: 'pointer', minHeight: '48px' }}
              onClick={() => {
                setSelectedInvitation(inv);
                setShowProfileModal(true);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedInvitation(inv);
                  setShowProfileModal(true);
                }
              }}
              role="button"
              tabIndex={0}
            >
              {profileHref ? (
                <button
                  type="button"
                  className="flex items-center gap-2 flex-1 text-left"
                  onClick={(event) => {
                    event.stopPropagation();
                    router.push(profileHref);
                  }}
                >
                  {otherUser?.profile_photo_url ? (
                    <img src={otherUser.profile_photo_url} alt={otherUser.full_name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-semibold text-base">
                      {otherUser?.full_name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-base text-zinc-900 dark:text-zinc-50 leading-tight hover:underline">{otherUser?.full_name}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 leading-tight">{otherUser?.city}{otherUser?.city && otherUser?.state ? ', ' : ''}{otherUser?.state}</div>
                  </div>
                </button>
              ) : (
                <>
                  {otherUser?.profile_photo_url ? (
                    <img src={otherUser.profile_photo_url} alt={otherUser.full_name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-semibold text-base">
                      {otherUser?.full_name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-base text-zinc-900 dark:text-zinc-50 leading-tight">{otherUser?.full_name}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 leading-tight">{otherUser?.city}{otherUser?.city && otherUser?.state ? ', ' : ''}{otherUser?.state}</div>
                  </div>
                </>
              )}
              <span className={`px-2 py-0.5 rounded text-xs ${inv.status === "pending" ? "bg-yellow-100 text-yellow-800" : inv.status === "accepted" ? "bg-green-100 text-green-700" : inv.status === "declined" ? "bg-zinc-200 text-zinc-700" : "bg-zinc-100 text-zinc-700"}`}>{inv.status}</span>
            </div>
          );
        })}
      </div>

      {/* Profile Modal */}
      {showProfileModal && selectedInvitation && (
        modalLoading ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 max-w-sm w-full shadow-xl text-center text-lg">Loading...</div>
          </div>
        ) : (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 max-w-sm w-full shadow-xl relative">
              {(() => {
                const otherUser = selectedInvitation.from_user_id === user?.id ? selectedInvitation.to_user_profile : selectedInvitation.from_user_profile;
                const profileHref = getProfileHref(otherUser?.id);
                return (
                  <>
              <button className="absolute top-2 right-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 text-2xl" onClick={() => {
                setShowProfileModal(false);
              }}>&times;</button>
              <div className="text-center">
                {profileHref ? (
                  <button
                    type="button"
                    className="mx-auto flex flex-col items-center"
                    onClick={() => {
                      setShowProfileModal(false);
                      router.push(profileHref);
                    }}
                  >
                    {otherUser?.profile_photo_url ? (
                      <img src={otherUser.profile_photo_url} alt={otherUser.full_name} className="w-24 h-24 rounded-full object-cover mx-auto mb-4" />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-semibold text-4xl mx-auto mb-4">
                        {otherUser?.full_name?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div className="font-bold text-2xl mb-1 text-zinc-900 dark:text-zinc-50 hover:underline">{otherUser?.full_name}</div>
                  </button>
                ) : otherUser?.profile_photo_url ? (
                  <img src={otherUser.profile_photo_url} alt={otherUser.full_name} className="w-24 h-24 rounded-full object-cover mx-auto mb-4" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-semibold text-4xl mx-auto mb-4">
                    {otherUser?.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                {!profileHref && (
                  <div className="font-bold text-2xl mb-1 text-zinc-900 dark:text-zinc-50">{otherUser?.full_name}</div>
                )}
                <div className="text-zinc-500 dark:text-zinc-400 mb-4">{`${otherUser?.city || ''}${otherUser?.city && otherUser?.state ? ', ' : ''}${otherUser?.state || ''}`}</div>
                {profileHref && (
                  <button
                    type="button"
                    className="px-4 py-2 bg-pink-100 hover:bg-pink-200 text-pink-700 border border-pink-500 rounded-lg font-semibold text-sm transition-colors dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700 dark:hover:bg-pink-900/45"
                    onClick={() => {
                      setShowProfileModal(false);
                      router.push(profileHref);
                    }}
                  >
                    Go to Profile
                  </button>
                )}
              </div>
                  </>
                );
              })()}
            </div>
          </div>
        )
      )}
    </div>
  );
}
