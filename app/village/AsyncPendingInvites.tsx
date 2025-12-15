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
        // Always fetch latest user info from Supabase Auth for recipient
        if (enriched.to_user_id) {
          try {
            const { data: { user: supaUser }, error } = await supabase.auth.admin.getUserById(enriched.to_user_id);
            if (!error && supaUser?.user_metadata) {
              // Overwrite with latest info from Auth
              enriched.to_user_name = supaUser.user_metadata.full_name || enriched.to_user_name;
              enriched.to_user_city = supaUser.user_metadata.city || enriched.to_user_city;
              enriched.to_user_state = supaUser.user_metadata.state || enriched.to_user_state;
              enriched.to_user_photo = supaUser.user_metadata.profile_photo_url || enriched.to_user_photo;
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
        // Try all possible sources for name, ignoring placeholder values
        function isMissingName(val?: string) {
          return !val || val.trim() === '' || val === 'Unknown Mom';
        }
        let displayName = !isMissingName(inv.to_user_name) ? inv.to_user_name
          : inv.to_user_email || (!isMissingName(inv.from_user_name) ? inv.from_user_name : undefined) || inv.to_user_id || inv.from_user_id;
        if (isMissingName(displayName)) displayName = 'Unknown Mom';
        const photo = inv.to_user_photo || inv.from_user_photo || "/placeholder.png";
        // Try all possible sources for city/state, ignoring placeholder values
        function isMissingLocation(val?: string) {
          return !val || val.trim() === '' || val === 'Unknown City' || val === 'Unknown State';
        }
        let city = !isMissingLocation(inv.to_user_city) ? inv.to_user_city : '';
        let state = !isMissingLocation(inv.to_user_state) ? inv.to_user_state : '';
        let location = '';
        if (city || state) {
          location = `${city}${city && state ? ', ' : ''}${state}`;
        } else {
          location = 'Location not set';
        }
        return (
          <li key={inv.id} className="flex items-center gap-3 text-sm text-yellow-900 dark:text-yellow-100">
            <img
              src={photo}
              alt={displayName}
              className="h-8 w-8 rounded-full object-cover border border-yellow-300 dark:border-yellow-700"
            />
            <span className="font-medium">{displayName}</span>
            <span className="ml-2 text-xs text-yellow-700 dark:text-yellow-300">{location}</span>
          </li>
        );
      })}
    </>
  );
}