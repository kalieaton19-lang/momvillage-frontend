"use client";

"use client";
"use client";
import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function MyVillagePage() {
  const [user, setUser] = useState<any>(null);
  const [villageMembers, setVillageMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMom, setSelectedMom] = useState<any>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    const fetchUserAndVillage = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
      if (!currentUser) return;
      const { data, error } = await supabase
        .from("village_invitations")
        .select("* , to_user:to_user_id(*), from_user:from_user_id(*)")
        .or(`from_user_id.eq.${currentUser.id},to_user_id.eq.${currentUser.id}`);
      if (data) {
        setVillageMembers(data.filter((inv: any) => inv.status === "accepted"));
      }
      setLoading(false);
    };
    fetchUserAndVillage();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">My Village</h1>
        {loading ? (
          <div>Loading...</div>
        ) : villageMembers.length === 0 ? (
          <div className="text-zinc-500">You have no village members yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {villageMembers.map((inv) => {
              const otherUser = inv.from_user_id === user?.id ? inv.to_user : inv.from_user;
              return (
                <button
                  key={inv.id}
                  className="flex items-center gap-3 p-6 rounded-2xl border-2 border-pink-300 dark:border-pink-600 bg-pink-50 dark:bg-pink-900/20 w-full hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-pink-500"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedMom(otherUser);
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
                </button>
              );
            })}
          </div>
        )}

        {/* Profile Modal */}
        {showProfileModal && selectedMom && (
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
                {selectedMom.profile_photo_url ? (
                  <img src={selectedMom.profile_photo_url} alt={selectedMom.full_name} className="w-24 h-24 rounded-full object-cover mx-auto mb-4" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-semibold text-4xl mx-auto mb-4">
                    {selectedMom.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="text-center">
                  <div className="font-bold text-2xl mb-1 text-zinc-900 dark:text-zinc-50">{selectedMom.full_name}</div>
                  <div className="text-zinc-500 dark:text-zinc-400 mb-2">{selectedMom.city}{selectedMom.city && selectedMom.state ? ', ' : ''}{selectedMom.state}</div>
                  <div className="mt-4">
                    <span className="px-4 py-2 rounded-lg bg-green-100 text-green-700">Village Member</span>
                  </div>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
