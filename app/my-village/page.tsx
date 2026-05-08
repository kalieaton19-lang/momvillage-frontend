"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function MyVillagePage() {
  const [user, setUser] = useState<any>(null);
  const [villageMembers, setVillageMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVillage = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
      if (!currentUser) return;
      const { data, error } = await supabase
        .from("village_invitations")
        .select("* , to_user:to_user_id(*), from_user:from_user_id(*)")
        .or(`from_user_id.eq.${currentUser.id},to_user_id.eq.${currentUser.id}`);
      if (data) {
        // Only show accepted invitations as village members
        setVillageMembers(data.filter((inv: any) => inv.status === "accepted"));
      }
      setLoading(false);
    };
    fetchVillage();
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">My Village</h1>
      {loading ? (
        <div>Loading...</div>
      ) : villageMembers.length === 0 ? (
        <div className="text-zinc-500">You have no village members yet.</div>
      ) : (
        <div className="space-y-4">
          {villageMembers.map((inv) => {
            const otherUser = inv.from_user_id === user?.id ? inv.to_user : inv.from_user;
            return (
              <div key={inv.id} className="p-4 rounded-xl border flex items-center gap-4 bg-white">
                <div className="flex-1">
                  <div className="font-semibold">{otherUser?.full_name || "Unknown"}</div>
                  <div className="text-xs text-zinc-500">{otherUser?.city}{otherUser?.city && otherUser?.state ? ', ' : ''}{otherUser?.state}</div>
                </div>
                <div>
                  <span className="px-3 py-1 rounded-lg bg-green-100 text-green-700 text-xs">Accepted</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
