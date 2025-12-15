import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface VillageInvitationWithRecipient {
  id: string;
  from_user_id: string;
  from_user_name: string;
  from_user_photo?: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  message?: string;
  to_user_id?: string;
  to_user_name?: string;
  to_user_email?: string;
  to_user_city?: string;
  to_user_state?: string;
  to_user_photo?: string;
}

interface Props {
  invites: VillageInvitationWithRecipient[];
}

export function AsyncPendingInvites({ invites }: Props) {
  const [enriched, setEnriched] = useState<VillageInvitationWithRecipient[]>([]);
  useEffect(() => {
    let cancelled = false;
    async function enrich() {
      const enrichedInvites = await Promise.all(invites.map(async (inv) => {
        let enriched = { ...inv };
        // Try to fill missing city/state from Supabase
        if ((!enriched.to_user_city || !enriched.to_user_state) && enriched.to_user_id) {
          try {
            const { data: { user: supaUser }, error } = await supabase.auth.admin.getUserById(enriched.to_user_id);
            if (!error && supaUser?.user_metadata) {
              if (!enriched.to_user_city && supaUser.user_metadata.city) enriched.to_user_city = supaUser.user_metadata.city;
              if (!enriched.to_user_state && supaUser.user_metadata.state) enriched.to_user_state = supaUser.user_metadata.state;
              if (!enriched.to_user_photo && supaUser.user_metadata.profile_photo_url) enriched.to_user_photo = supaUser.user_metadata.profile_photo_url;
            }
          } catch (e) { /* ignore */ }
        }
        return enriched;
      }));
      if (!cancelled) setEnriched(enrichedInvites);
    }
    enrich();
    return () => { cancelled = true; };
  }, [JSON.stringify(invites)]);

  return (
    <>
      {enriched.map((inv) => {
        let displayName = inv.to_user_name || inv.to_user_email;
        if (!displayName && inv.to_user_id) displayName = inv.to_user_id;
        const photo = inv.to_user_photo || inv.from_user_photo || "/placeholder.png";
        return (
          <li key={inv.id} className="flex items-center gap-3 text-sm text-yellow-900 dark:text-yellow-100">
            <img
              src={photo}
              alt={displayName || 'Mom'}
              className="h-8 w-8 rounded-full object-cover border border-yellow-300 dark:border-yellow-700"
            />
            <span className="font-medium">{displayName || 'Unknown Mom'}</span>
            <span className="ml-2 text-xs text-yellow-700 dark:text-yellow-300">
              {(inv.to_user_city || inv.to_user_state)
                ? `${inv.to_user_city || ''}${inv.to_user_city && inv.to_user_state ? ', ' : ''}${inv.to_user_state || ''}`
                : 'Location not set'}
            </span>
          </li>
        );
      })}
    </>
  );
}