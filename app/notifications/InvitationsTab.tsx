import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function InvitationsTab() {
  const [user, setUser] = useState<any>(null);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvitation, setSelectedInvitation] = useState<any>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    const fetchUserAndInvitations = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
      if (!currentUser) return;
      const { data, error } = await supabase
        .from("village_invitations")
        .select("* , to_user:to_user_id(*), from_user:from_user_id(*)")
        .or(`from_user_id.eq.${currentUser.id},to_user_id.eq.${currentUser.id}`);
      if (data) {
        setInvitations(data);
      }
      setLoading(false);
    };
    fetchUserAndInvitations();
  }, []);

  return (
    <div>
      {loading ? (
        <div>Loading...</div>
      ) : invitations.length === 0 ? (
        <div className="text-zinc-500">No invitations found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {invitations.map((inv) => {
            const otherUser = inv.from_user_id === user?.id ? inv.to_user : inv.from_user;
            return (
              <button
                key={inv.id}
                className={`flex items-center gap-3 p-6 rounded-2xl border-2 ${inv.status === "pending" ? "border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20" : inv.status === "accepted" ? "border-green-300 bg-green-50 dark:bg-green-900/20" : inv.status === "declined" ? "border-zinc-300 bg-zinc-50 dark:bg-zinc-900/20" : "border-pink-300 bg-pink-50 dark:bg-pink-900/20"} w-full hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-pink-500`}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setSelectedInvitation(inv);
                  setShowProfileModal(true);
                }}
              >
                {otherUser?.profile_photo_url ? (
                  <img src={otherUser.profile_photo_url} alt={otherUser.full_name} className="w-16 h-16 rounded-full object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-semibold text-2xl">
                    {otherUser?.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="flex-1 text-left">
                  <div className="font-semibold text-lg text-zinc-900 dark:text-zinc-50">{otherUser?.full_name}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">{otherUser?.city}{otherUser?.city && otherUser?.state ? ', ' : ''}{otherUser?.state}</div>
                </div>
                <span className={`px-3 py-1 rounded-lg text-xs ${inv.status === "pending" ? "bg-yellow-100 text-yellow-800" : inv.status === "accepted" ? "bg-green-100 text-green-700" : inv.status === "declined" ? "bg-zinc-200 text-zinc-700" : "bg-zinc-100 text-zinc-700"}`}>{inv.status}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && selectedInvitation && (
        modalLoading ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 max-w-sm w-full shadow-xl text-center text-lg">Loading...</div>
          </div>
        ) : (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 max-w-sm w-full shadow-xl relative">
              <button className="absolute top-2 right-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 text-2xl" onClick={() => {
                setShowProfileModal(false);
              }}>&times;</button>
              {(() => {
                const otherUser = selectedInvitation.from_user_id === user?.id ? selectedInvitation.to_user : selectedInvitation.from_user;
                return otherUser?.profile_photo_url ? (
                  <img src={otherUser.profile_photo_url} alt={otherUser.full_name} className="w-24 h-24 rounded-full object-cover mx-auto mb-4" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-semibold text-4xl mx-auto mb-4">
                    {otherUser?.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                );
              })()}
              <div className="text-center">
                <div className="font-bold text-2xl mb-1 text-zinc-900 dark:text-zinc-50">{(() => {
                  const otherUser = selectedInvitation.from_user_id === user?.id ? selectedInvitation.to_user : selectedInvitation.from_user;
                  return otherUser?.full_name;
                })()}</div>
                <div className="text-zinc-500 dark:text-zinc-400 mb-2">{(() => {
                  const otherUser = selectedInvitation.from_user_id === user?.id ? selectedInvitation.to_user : selectedInvitation.from_user;
                  return `${otherUser?.city || ''}${otherUser?.city && otherUser?.state ? ', ' : ''}${otherUser?.state || ''}`;
                })()}</div>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
