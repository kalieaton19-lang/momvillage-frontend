

"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { AsyncPendingInvites } from "./AsyncPendingInvites";

type VillageTabType = 'members' | 'invite' | 'invitations';

interface VillageMember {
  id: string;
  name: string;
  photo?: string;
  email?: string;
  city?: string;
  state?: string;
	joined_date: string;
}

interface VillageInvitation {
  id: string;
  from_user_id: string;
  to_user_id: string;
  from_user_name: string;
  from_user_photo?: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
      // ...existing hooks and state...
      const pendingInvitations = villageInvitations.filter(i => i.to_user_id === currentUserId && i.status === 'pending');
    // ...existing hooks and state...

    // ...existing code...

    // Derived invitation arrays for UI (if not already present)
    const pendingInvitations = villageInvitations.filter(i => i.to_user_id === currentUserId && i.status === 'pending');

    return (
      <>
        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
          <button
            onClick={() => setActiveTab('members')}
            className={`px-4 py-2 font-medium text-sm transition-colors whitespace-nowrap ${
              (activeTab as VillageTabType) === 'members'
                ? 'text-pink-600 dark:text-pink-400 border-b-2 border-pink-600 dark:border-pink-400'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50'
            }`}
          >
            Members ({villageMembers.length})
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`px-4 py-2 font-medium text-sm transition-colors relative whitespace-nowrap ${
              (activeTab as VillageTabType) === 'invitations'
                ? 'text-pink-600 dark:text-pink-400 border-b-2 border-pink-600 dark:border-pink-400'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50'
            }`}
          >
            Invitations
            {pendingInvitations.length > 0 && (
              <span className="absolute top-1 right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {pendingInvitations.length}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab('invite');
              setShowInviteForm(false);
              setSelectedMomId("");
            }}
            className={`px-4 py-2 font-medium text-sm transition-colors whitespace-nowrap ${
              (activeTab as VillageTabType) === 'invite'
                ? 'text-pink-600 dark:text-pink-400 border-b-2 border-pink-600 dark:border-pink-400'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50'
            }`}
          >
            Invite a Mom
          </button>
        </div>

        {/* Members Tab */}
        {(activeTab as VillageTabType) === 'members' && (
          <div>
            {villageMembers.length > 0 ? (
              <div>
  const [inviteMode, setInviteMode] = useState<'search' | 'conversations'>('search');
  const [villageSearchQuery, setVillageSearchQuery] = useState("");

  useEffect(() => {
    checkUser();
  }, []);

  // Always update currentUserId from Supabase before rendering invitations UI
  async function ensureCurrentUserId() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.id !== currentUserId) {
      setCurrentUserId(user.id);
    }
  }
  useEffect(() => {
    ensureCurrentUserId();
  }, [activeTab, showInviteForm]);

  async function checkUser() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);
      setCurrentUserId(session.user.id);
      
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser?.user_metadata) {
        setCurrentProfile(currentUser.user_metadata);
      }
      
      await loadVillageData(session.user.id);
      await loadAvailableMoms();

      // (localStorage migration removed, now using Supabase only)
    } catch (error) {
      console.error('Error checking user:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  async function loadVillageData(userId: string) {
    try {
      // Load village members from Supabase
      const { data: members, error: membersError } = await supabase
        .from('village_members')
        .select('*')
        .eq('user_id', userId);
      if (!membersError && members) {
        setVillageMembers(members);
      }
      // Load invitations from Supabase (both sent and received)
      const { data: invitations, error: invError } = await supabase
        .from('village_invitations')
        .select('*')
        .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
        .order('created_at', { ascending: false });
      console.log('[Village Debug] Supabase invitations fetch:', { userId, invitations, invError });
      if (invError) {
        console.error('[Village Debug] Error fetching invitations:', invError);
      }
      if (invitations) {
        setVillageInvitations(invitations);
      }
      // Load conversations from Supabase
      const { data: convs, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order('updated_at', { ascending: false });
      if (!convError && convs) {
        // Fetch all user profiles for city/state lookup
        const { data: profiles, error: profilesError } = await supabase
          .from('user_public_profiles')
          .select('id, city, state');
        const profileMap = (profiles || []).reduce((acc: Record<string, any>, p: any) => {
          acc[p.id] = p;
          return acc;
        }, {});
        // Enrich each conversation with other_user_id, other_user_name, other_user_photo, other_user_city, other_user_state
        const enrichedConvs = convs.map((conv: any) => {
          let other_user_id = null;
          let other_user_name = null;
          let other_user_photo = null;
          let other_user_city = null;
          let other_user_state = null;
          if (conv.user1_id === userId) {
            other_user_id = conv.user2_id;
            other_user_name = conv.user2_name || '';
            other_user_photo = conv.user2_photo || '';
          } else if (conv.user2_id === userId) {
            other_user_id = conv.user1_id;
            other_user_name = conv.user1_name || '';
            other_user_photo = conv.user1_photo || '';
          }
          // Lookup city/state from user_public_profiles
          if (other_user_id && profileMap[other_user_id]) {
            other_user_city = profileMap[other_user_id].city || '';
            other_user_state = profileMap[other_user_id].state || '';
          }
          return {
            ...conv,
            other_user_id,
            other_user_name,
            other_user_photo,
            other_user_city,
            other_user_state,
          };
        });
        setConversations(enrichedConvs);
      }
      console.log('[Village Debug] Loaded conversations from Supabase:', convs);
    } catch (e) {
      console.error('[Village Debug] Error loading village data:', e);
    }
  }

  async function loadAvailableMoms() {
    try {
      // Fetch all public profiles from Supabase (excluding current user)
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setAvailableMoms([]);
        return;
      }
      const { data, error } = await supabase
        .from('user_public_profiles')
        .select('*');
      if (error) {
        console.error('Error fetching user_public_profiles:', error);
        setAvailableMoms([]);
        return;
      }
      // Exclude current user and map to MomProfile
      const moms = (data || [])
        .filter((profile: any) => profile.id !== authUser.id)
        .map((profile: any) => ({
          id: profile.id,
          email: profile.email ?? undefined,
          user_metadata: {
            full_name: profile.full_name,
            profile_photo_url: profile.profile_photo_url,
            city: profile.city,
            state: profile.state,
            // add other fields as needed
          },
        }));
      setAvailableMoms(moms);
    } catch (error) {
      console.error('Error loading available moms:', error);
      setAvailableMoms([]);
    }
  }

  async function handleSearchMoms(query: string) {
    if (!query.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    try {
      // Search for all users and filter by name matching
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      // In a real production app, you'd use Supabase's full-text search
      // For now, we'll use the Supabase admin API to get users
      // This requires proper RLS policies in a real app
      
      // Fetch all users and filter client-side (not ideal for production)
      const { data, error } = await supabase.auth.admin.listUsers();
      
      if (error) {
        console.error('Error searching users:', error);
        setSearchResults([]);
      } else if (data?.users) {
        // Filter users by name matching (case-insensitive)
        const lowerQuery = query.toLowerCase();
        type UserRow = { id: string; email?: string | null; user_metadata?: Record<string, any> };
        const users: UserRow[] = (data.users || []) as unknown as UserRow[];
        const filtered = users
          .filter((u: UserRow) => {
            const fullName = u.user_metadata?.full_name || '';
            return fullName.toLowerCase().includes(lowerQuery) && u.id !== currentUserId;
          })
          .map((u: UserRow): MomProfile => ({
            id: u.id,
            email: u.email ?? undefined,
            user_metadata: u.user_metadata as any,
          })) as MomProfile[];
        
        setSearchResults(filtered);
      }
    } catch (error) {
      console.error('Error searching moms:', error);
      // Fallback: show message about search limitations
      setMessage("Search requires proper permissions. Try inviting by email instead.");
    } finally {
      setSearching(false);
    }
  }

  async function handleSendVillageInvitation() {

    // Confirm session and user ID before insert, with diagnostics
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    console.log('[invitation] session error:', sessionErr);
    console.log('[invitation] session exists:', !!sessionData?.session);
    console.log('[invitation] user:', sessionData?.session?.user?.id);
    console.log('[invitation] access_token exists:', !!sessionData?.session?.access_token);
    console.log('[invitation] token (first 10 chars):', sessionData?.session?.access_token?.slice(0, 10));
    if (!sessionData?.session?.access_token) {
      setMessage('No active Supabase session: user not authenticated for insert.');
      setTimeout(() => setMessage(""), 3000);
      return;
    }
    const user = sessionData.session.user;
    if (!user) {
      setMessage("You must be logged in to send an invitation.");
      setTimeout(() => setMessage(""), 3000);
      return;
    }
    console.log('handleSendVillageInvitation called', { selectedMomId, selectedMom });
    if (!selectedMomId) {
      setMessage("Please select a mom to invite");
      setTimeout(() => setMessage(""), 3000);
      return;
    }

    try {
      if (!selectedMom?.user_metadata) {
        setMessage("Could not load invitation details");
        setTimeout(() => setMessage(""), 3000);
        return;
      }

      // Only send columns that exist in the table
      // --- INSERT INVITATION ---
      const { data: insertData, error: insertError } = await supabase
        .from('village_invitations')
        .insert([{ from_user_id: currentUserId, to_user_id: selectedMomId }]);
      console.log('[Village Debug] Supabase insert result:', { insertData, insertError });
            {/* Invitations Tab */}
            {(activeTab as VillageTabType) === 'invitations' && (() => {
              // Move debug logs outside JSX
              console.log('currentUserId', currentUserId);
              console.log('villageInvitations', villageInvitations);
              console.log(
                "filteredSentInvitations",
                villageInvitations.filter(i => i.from_user_id === currentUserId)
              );
              return currentUserId && (
                <div className="space-y-6">
                  {/* TEMP: Render all invitations for debugging */}
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                      All Invitations (debug)
                    </h3>
                    <div className="space-y-2">
                      {villageInvitations.map(inv => (
                        <div key={inv.id} className="p-2 border rounded">
                          <div>From: {inv.from_user_id}</div>
                          <div>To: {inv.to_user_id}</div>
                          <div>Status: {inv.status}</div>
                        </div>
                      ))}
                    </div>
                    <h4 className="mt-4 font-semibold">All Invitations (detailed)</h4>
                    <table style={{ fontSize: '12px', width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {villageInvitations && villageInvitations.length > 0 && Object.keys(villageInvitations[0]).map((key) => (
                            <th key={key} style={{ border: '1px solid #ccc', padding: '2px' }}>{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {villageInvitations && villageInvitations.map((inv, idx) => (
                          <tr key={idx}>
                            {Object.values(inv).map((val, i) => (
                              <td key={i} style={{ border: '1px solid #ccc', padding: '2px' }}>{String(val)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
      // After sending, refetch all invitations to keep UI in sync
      if (user?.id) {
        await loadVillageData(user.id);
      }
      setMessage(`Village invitation sent to ${selectedMom.user_metadata?.full_name}!`);
      setSelectedMomId("");
      setSelectedMom(null);
      setInviteMessage("");
      setShowInviteForm(false);
      setTimeout(() => setMessage(""), 4000);
    } catch (error) {
      setMessage("Failed to send invitation");
      setTimeout(() => setMessage(""), 3000);
    }
  }

  async function handleRespondToVillageInvitation(invitationId: string, accept: boolean) {
    try {
      const invitation = villageInvitations.find(i => i.id === invitationId);
      if (!invitation) return;

      const updatedInvitations = villageInvitations.map(inv =>
        inv.id === invitationId
          ? { ...inv, status: (accept ? 'accepted' : 'declined') as ('pending' | 'accepted' | 'declined') }
          : inv
      );

      setVillageInvitations(updatedInvitations);

      // If accepted, add to village members
      if (accept) {
        // Fetch the user's info from Supabase
        const { data: { user: inviterUser }, error } = await supabase.auth.admin.getUserById(invitation.from_user_id);
        if (!error && inviterUser?.user_metadata) {
          const newMember: VillageMember = {
            id: invitation.from_user_id,
            name: inviterUser.user_metadata.full_name || invitation.from_user_name || 'Mom',
            photo: inviterUser.user_metadata.profile_photo_url || invitation.from_user_photo,
            email: inviterUser.email,
            city: inviterUser.user_metadata.city || '',
            state: inviterUser.user_metadata.state || '',
            joined_date: new Date().toISOString(),
          };
          setVillageMembers((prev) => {
            if (!prev.find((m) => m.id === newMember.id)) {
              return [newMember, ...prev];
            }
            return prev;
          });
          // Optionally, insert into Supabase village_members table
          await supabase.from('village_members').insert([newMember]);
        }
      }

      setMessage(`Village invitation ${accept ? 'accepted' : 'declined'}!`);
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error('Error responding to invitation:', error);
      setMessage("Failed to respond to invitation");
      setTimeout(() => setMessage(""), 3000);
    }
  }

  async function handleStartConversation(memberId: string) {
    try {
      // Check if conversation already exists
      const existingConv = conversations.find(c => c.other_user_id === memberId);
      if (existingConv) {
        // Go to existing conversation
        router.push(`/messages?conversation=${existingConv.id}`);
        return;
      }

      // Create new conversation and persist to Supabase
      const conversationId = [currentUserId, memberId].sort().join('_');
      const member = villageMembers.find(m => m.id === memberId);
      if (!member) throw new Error('Member not found');

      // 1. Insert into matches table first (to satisfy FK constraint for messages)
      const newMatch = {
        id: conversationId,
        requestor_id: currentUserId,
        provider_id: memberId,
        created_at: new Date().toISOString(),
        // status, service_id, service_offered are nullable and omitted
      };
      const { data: matchData, error: matchError } = await supabase.from('matches').insert([newMatch]);
      console.log('[Village Debug] Attempted to insert into matches:', newMatch);
      console.log('[Village Debug] Supabase matches insert result:', matchData);
      if (matchError) {
        console.error('[Village Debug] Error inserting new match into Supabase:', matchError);
        // If already exists, ignore error  (unique violation)
        if (matchError.code !== '23505') { // 23505 = unique_violation
          setMessage('Failed to create match for conversation');
          setTimeout(() => setMessage(''), 3000);
          return;
        }
      }

      // 2. Prepare conversation object for Supabase
      const newConv = {
        id: conversationId,
        user1_id: currentUserId < memberId ? currentUserId : memberId,
        user2_id: currentUserId < memberId ? memberId : currentUserId,
        user1_name: currentUserId < memberId ? (currentProfile?.full_name || 'A Mom') : member.name,
        user2_name: currentUserId < memberId ? member.name : (currentProfile?.full_name || 'A Mom'),
        user1_photo: currentUserId < memberId ? (currentProfile?.profile_photo_url || '') : member.photo,
        user2_photo: currentUserId < memberId ? member.photo : (currentProfile?.profile_photo_url || ''),
        last_message: 'Conversation started',
        last_message_time: new Date().toISOString(),
        // Add any other required fields for your schema
      };

      // 3. Insert into conversations table
      const { data, error } = await supabase.from('conversations').insert([newConv]);
      if (error) {
        console.error('Error inserting new conversation into Supabase:', error);
        setMessage('Failed to create conversation');
        setTimeout(() => setMessage(''), 3000);
        return;
      }

      // 4. Update local state
      setConversations((prev) => {
        if (!prev.find((c) => c.id === conversationId)) {
          return [newConv, ...prev];
        }
        return prev;
      });
      router.push(`/messages?conversation=${conversationId}`);
    } catch (error) {
      console.error('Error starting conversation:', error);
      setMessage('Failed to start conversation');
      setTimeout(() => setMessage(''), 3000);
    }
  }

  async function handleRemoveFromVillage(memberId: string) {
    if (!confirm('Remove this mom from your village?')) return;

    try {
      const updatedMembers = villageMembers.filter(m => m.id !== memberId);
      const villageKey = `village_${currentUserId}`;
      localStorage.setItem(villageKey, JSON.stringify(updatedMembers));
      setVillageMembers(updatedMembers);

      // Also remove current user from their village
      const memberVillageKey = `village_${memberId}`;
      const memberVillage = JSON.parse(localStorage.getItem(memberVillageKey) || '[]');
      const filtered = memberVillage.filter((m: VillageMember) => m.id !== currentUserId);
      localStorage.setItem(memberVillageKey, JSON.stringify(filtered));

      setMessage("Removed from your village");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error('Error removing member:', error);
      setMessage("Failed to remove member");
      setTimeout(() => setMessage(""), 3000);
    }
  }

  // Helper: enrich pending invites with info from conversations/availableMoms
  async function enrichPendingInvites(invites: VillageInvitationWithRecipient[]) {
    const enrichedInvites = await Promise.all(invites.map(async (inv) => {
      let enriched = { ...inv };
      // Try to fill missing name/email from conversations
      if ((!enriched.to_user_name || !enriched.to_user_email) && Array.isArray(conversations)) {
        const conv = conversations.find(c => c.other_user_id === inv.to_user_id || c.other_user_email === inv.to_user_email);
        if (conv) {
          if (!enriched.to_user_name && conv.other_user_name) enriched.to_user_name = conv.other_user_name;
          if (!enriched.to_user_email && conv.other_user_email) enriched.to_user_email = conv.other_user_email;
        }
      }
      // Try to fill missing name/email/city/state from availableMoms
      if ((!enriched.to_user_name || !enriched.to_user_email || !enriched.to_user_city || !enriched.to_user_state) && Array.isArray(availableMoms)) {
        const mom = availableMoms.find(m => m.id === inv.to_user_id || m.email === inv.to_user_email);
        if (mom) {
          if (!enriched.to_user_name && mom.user_metadata?.full_name) enriched.to_user_name = mom.user_metadata.full_name;
          if (!enriched.to_user_email && mom.email) enriched.to_user_email = mom.email;
          if (!enriched.to_user_city && mom.user_metadata?.city) enriched.to_user_city = mom.user_metadata.city;
          if (!enriched.to_user_state && mom.user_metadata?.state) enriched.to_user_state = mom.user_metadata.state;
        }
      }
      // If still missing city/state, fetch from Supabase
      if ((!enriched.to_user_city || !enriched.to_user_state) && enriched.to_user_id) {
        try {
          const { data: { user: supaUser }, error } = await supabase.auth.admin.getUserById(enriched.to_user_id);
          if (!error && supaUser?.user_metadata) {
            if (!enriched.to_user_city && supaUser.user_metadata.city) enriched.to_user_city = supaUser.user_metadata.city;
            if (!enriched.to_user_state && supaUser.user_metadata.state) enriched.to_user_state = supaUser.user_metadata.state;
          }
        } catch (e) { /* ignore */ }
      }
      return enriched;
    }));
    console.log('[Village Debug] enrichPendingInvites input:', invites);
    console.log('[Village Debug] enrichPendingInvites output:', enrichedInvites);
    return enrichedInvites;
  }

// ...existing code above...

        {message && (
          <div className={`mb-6 p-4 rounded-lg text-sm font-medium ${
            message.includes('Failed') || message.includes('error')
              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
              : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
          }`}>
            {message}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
          <button
            onClick={() => setActiveTab('members')}
            className={`px-4 py-2 font-medium text-sm transition-colors whitespace-nowrap ${
              (activeTab as VillageTabType) === 'members'
                ? 'text-pink-600 dark:text-pink-400 border-b-2 border-pink-600 dark:border-pink-400'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50'
            }`}
          >
            Members ({villageMembers.length})
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`px-4 py-2 font-medium text-sm transition-colors relative whitespace-nowrap ${
              (activeTab as VillageTabType) === 'invitations'
                ? 'text-pink-600 dark:text-pink-400 border-b-2 border-pink-600 dark:border-pink-400'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50'
            }`}
          >
            Invitations
            {pendingInvitations.length > 0 && (
              <span className="absolute top-1 right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {pendingInvitations.length}
              </span>

            )}
        </div>

      {/* Members Tab */}
      {(activeTab as VillageTabType) === 'members' && (
        <div>
          {villageMembers.length > 0 ? (
            <div>
          </button>
          <button
            onClick={() => {
              setActiveTab('invite');
              setShowInviteForm(false);
              setSelectedMomId("");
            }}
            className={`px-4 py-2 font-medium text-sm transition-colors whitespace-nowrap ${
              (activeTab as VillageTabType) === 'invite'
                ? 'text-pink-600 dark:text-pink-400 border-b-2 border-pink-600 dark:border-pink-400'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50'
            }`}
          >
            Invite a Mom
          </button>
        </div>

      {/* Members Tab */}
      {(activeTab as VillageTabType) === 'members' && (
        <div>
          {villageMembers.length > 0 ? (
            <div>
                <div className="mb-6 space-y-3">
                  <div className="relative">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <div className="absolute left-3 top-3 text-zinc-400">🔍</div>
                        <input 
                          type="text" 
                          placeholder="Search by name, city, or state..." 
                          value={villageSearchQuery} 
                          onChange={(e) => setVillageSearchQuery(e.target.value)} 
                          className="w-full pl-10 pr-10 py-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all" 
                        />
                        {villageSearchQuery && (
                          <button
                            onClick={() => setVillageSearchQuery("")}
                            className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-lg"
                            aria-label="Clear search"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                    {villageSearchQuery && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                        Found {villageMembers.filter((m) => 
                          m.name.toLowerCase().includes(villageSearchQuery.toLowerCase()) ||
                          m.city?.toLowerCase().includes(villageSearchQuery.toLowerCase()) ||
                          m.state?.toLowerCase().includes(villageSearchQuery.toLowerCase())
                        ).length} of {villageMembers.length} members
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {villageMembers.filter((m) => 
                    villageSearchQuery === "" ||
                    m.name.toLowerCase().includes(villageSearchQuery.toLowerCase()) ||
                    m.city?.toLowerCase().includes(villageSearchQuery.toLowerCase()) ||
                    m.state?.toLowerCase().includes(villageSearchQuery.toLowerCase())
                  ).map((m) => (<div key={m.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 hover:shadow-lg transition-all"><div className="flex items-start gap-4 mb-4">{m.photo ? (<img src={m.photo} alt={m.name} className="w-14 h-14 rounded-full object-cover border-2 border-pink-300" />) : (<div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-semibold">{m.name[0]?.toUpperCase() || '?'}</div>)}<div className="flex-1 min-w-0"><h3 className="font-semibold text-zinc-900 dark:text-zinc-50 truncate">{m.name}</h3><p className="text-xs text-zinc-500 dark:text-zinc-400">{m.city}, {m.state}</p></div></div><div className="text-xs text-zinc-600 dark:text-zinc-400 mb-4">Joined {new Date(m.joined_date).toLocaleDateString()}</div><div className="flex flex-col gap-2"><button onClick={() => setSelectedMemberProfile(m)} className="w-full px-3 py-2 text-xs text-center bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors font-medium">👤 View Profile</button><button onClick={() => handleStartConversation(m.id)} className="w-full px-3 py-2 text-xs text-center bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-lg hover:bg-pink-200 dark:hover:bg-pink-900/50 transition-colors font-medium">💬 Message</button><button onClick={() => handleRemoveFromVillage(m.id)} className="w-full px-3 py-2 text-xs text-center bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors font-medium">✕ Remove</button></div></div>))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl"><div className="text-4xl mb-3">🏘️</div><p className="text-zinc-600 dark:text-zinc-400 mb-4">Your village is empty</p><Link href="/find-moms" className="inline-block px-6 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors font-medium">Find Moms to Add</Link></div>
            )}
          </div>
        )}

        {/* Invitations Tab */}
        {(activeTab as VillageTabType) === 'invitations' && (
          <div className="space-y-6">
            {/* Pending Invitations */}
            {pendingInvitations.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                  📬 Pending Invitations ({pendingInvitations.length})
                </h3>
                <div className="space-y-4">
                  {pendingInvitations.map(invitation => (
                    <div
                      key={invitation.id}
                      className="p-6 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl"
                    >
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                          <h4 className="font-semibold text-purple-900 dark:text-purple-50 mb-1">
                            {invitation.from_user_name}
                          </h4>
                          <p className="text-sm text-purple-700 dark:text-purple-300">
                            Wants you to join their village
                          </p>
                          {invitation.message && (
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                              "{invitation.message}"
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleRespondToVillageInvitation(invitation.id, true)}
                          className="flex-1 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white font-medium transition-colors"
                        >
                          ✓ Accept
                        </button>
                        <button
                          onClick={() => handleRespondToVillageInvitation(invitation.id, false)}
                          className="flex-1 px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium transition-colors"
                        >
                          ✕ Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Accepted Invitations */}
            {acceptedInvitations.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                  ✓ Accepted ({acceptedInvitations.length})
                </h3>
                <div className="space-y-4">
                  {acceptedInvitations.map(invitation => (
                    <div
                      key={invitation.id}
                      className="p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl"
                    >
                      <div className="flex items-start gap-4">
                        <span className="text-2xl">🤝</span>
                        <div>
                          <h4 className="font-semibold text-green-900 dark:text-green-50">
                            {invitation.from_user_name}
                          </h4>
                          <p className="text-sm text-green-700 dark:text-green-300">
                            You're now part of their village!
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {villageInvitations.length === 0 && (
              <div className="text-center py-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-zinc-600 dark:text-zinc-400">
                  No village invitations yet
                </p>
              </div>
            )}
          </div>
        )}

        {/* Invite Tab */}
        {(activeTab as VillageTabType) === 'invite' && (
          <div className="max-w-2xl">
            {/* Invite Box */}
            {!showInviteForm ? (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-6">
                  Invite a Mom to Your Village 🤝
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                  Build your support circle by inviting moms you've connected with. You can invite moms from your conversations or search for specific moms.
                </p>
                <button
                  onClick={() => setShowInviteForm(true)}
                  className="w-full px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-medium rounded-lg hover:shadow-lg transition-all"
                >
                  Start Inviting
                </button>
              </div>
            ) : (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-6">
                  Send Village Invitation 👋
                </h2>

                {/* Invite Mode Tabs */}
                <div className="flex gap-2 mb-6 border-b border-zinc-200 dark:border-zinc-700">
                  <button
                    onClick={() => {
                      setInviteMode('conversations');
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                    className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                      inviteMode === 'conversations'
                        ? 'border-pink-500 text-pink-500'
                        : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    💬 From Conversations
                  </button>
                  <button
                    onClick={() => {
                      setInviteMode('search');
                      setSelectedMomId("");
                      setSelectedMom(null);
                    }}
                    className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                      inviteMode === 'search'
                        ? 'border-pink-500 text-pink-500'
                        : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    🔍 Search by Name
                  </button>
                </div>

                {/* Conversations Mode */}
                {inviteMode === 'conversations' && (
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                      Select a Mom from Your Conversations
                    </label>
                    {conversations.length === 0 ? (
                      <p className="text-zinc-600 dark:text-zinc-400 py-4 text-center">
                        You don't have any conversations yet. Start a conversation with a mom to invite them to your village!
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {searchResults.map((mom) => {
                          const sentInvite = villageInvitations.find(
                            (inv) => inv.from_user_id === currentUserId && inv.to_user_id === mom.id && inv.status === 'pending'
                          );
                          const inviteStatus = sentInvite?.status;
                          const alreadyInvited = !!sentInvite;
                          return (
                            <div
                              key={mom.id}
                              onClick={alreadyInvited ? undefined : () => {
                                setSelectedMomId(mom.id);
                                setSelectedMom(mom);
                                setSearchQuery("");
                                setSearchResults([]);
                              }}
                              className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${alreadyInvited ? 'border-gray-300 bg-gray-50 dark:bg-zinc-800/40 text-gray-400 dark:text-zinc-500 cursor-not-allowed' : 'border-pink-300 hover:border-pink-500 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50'}`}
                            >
                              <div className="flex items-center gap-3">
                                <img
                                  src={mom.user_metadata?.profile_photo_url || '/default-profile.png'}
                                  alt={mom.user_metadata?.full_name || 'Mom'}
                                  className="w-10 h-10 rounded-full object-cover border"
                                />
                                <div className="flex-1">
                                  <div className="font-semibold">{mom.user_metadata?.full_name || 'Mom'}</div>
                                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {mom.user_metadata?.city || mom.user_metadata?.state
                                      ? `${mom.user_metadata?.city || ''}${mom.user_metadata?.city && mom.user_metadata?.state ? ', ' : ''}${mom.user_metadata?.state || ''}`
                                      : "Location not set"}
                                  </p>
                                  {sentInvite && (
                                    <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-semibold rounded bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200`}>
                                      Invitation pending
                                    </span>
                                  )}
                                </div>
                                {!alreadyInvited && <div className="text-pink-500 font-semibold">Select</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                      </div>
                    )}
                    {selectedMomId && (
                      <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <p className="text-sm text-green-800 dark:text-green-200">
                          ✓ Mom selected. Add a personal message below to complete the invitation.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Search Mode */}
                {inviteMode === 'search' && (
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                      Search for a Mom by Name
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search by first or last name..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          if (e.target.value.trim()) {
                            handleSearchMoms(e.target.value);
                          } else {
                            setSearchResults([]);
                          }
                        }}
                        className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 placeholder-zinc-500 dark:placeholder-zinc-400"
                      />
                      {searching && (
                        <div className="absolute right-3 top-2.5">
                          <div className="animate-spin h-5 w-5 border-2 border-pink-500 border-t-transparent rounded-full"></div>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                      Find moms you've met and add them to your village
                    </p>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {searchResults.map((mom) => {
                          const sentInvite = villageInvitations.find(
                            (inv) => inv.from_user_id === currentUserId && inv.to_user_id === mom.id
                          );
                          const inviteStatus = sentInvite?.status;
                          // Block all duplicate invites, regardless of status
                          const alreadyInvited = !!sentInvite;
                          return (
                            <div
                              key={mom.id}
                              onClick={alreadyInvited ? undefined : () => {
                                setSelectedMomId(mom.id);
                                setSelectedMom(mom);
                                setSearchQuery("");
                                setSearchResults([]);
                              }}
                              className={`flex items-center gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 ${alreadyInvited ? 'opacity-60 cursor-not-allowed' : 'hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer'} transition-colors`}
                            >
                              {/* Profile Photo */}
                              <img
                                src={mom.user_metadata?.profile_photo_url || "/placeholder.png"}
                                alt={mom.user_metadata?.full_name || "Mom"}
                                className="h-10 w-10 rounded-full object-cover"
                              />
                              <div className="flex-1">
                                <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                                  {mom.user_metadata?.full_name || "Unknown"}
                                </p>
                                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                  {(mom.user_metadata?.city || mom.user_metadata?.state)
                                    ? `${mom.user_metadata?.city || ''}${mom.user_metadata?.city && mom.user_metadata?.state ? ', ' : ''}${mom.user_metadata?.state || ''}`
                                    : "Location not set"}
                                </p>
                                {sentInvite && (
                                  <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-semibold rounded ${
                                    inviteStatus === 'pending'
                                      ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200'
                                      : inviteStatus === 'accepted'
                                      ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200'
                                      : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200'
                                  }`}>
                                    Invitation {inviteStatus}
                                  </span>
                                )}
                              </div>
                              {!alreadyInvited && <div className="text-pink-500 font-semibold">Select</div>}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {searchQuery && searchResults.length === 0 && !searching && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-3">
                        No moms found matching "{searchQuery}"
                      </p>
                    )}

                    {selectedMomId && (
                      <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <p className="text-sm text-green-800 dark:text-green-200">
                          ✓ Mom selected. Add a personal message below to complete the invitation.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Message */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                    Personal Message (optional)
                  </label>
                  <textarea
                    id="inviteMessage"
                    name="inviteMessage"
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                    placeholder="Tell her why you'd like her in your village..."
                    rows={4}
                    className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 placeholder-zinc-500 dark:placeholder-zinc-400"
                  />
                </div>

                {/* Debug: Show why Send Invitation is not enabled */}
                {(!selectedMomId || !selectedMom?.user_metadata) && (
                  <div className="mb-2 p-2 bg-yellow-100 text-yellow-800 rounded text-xs">
                    Debug: { !selectedMomId ? 'No mom selected.' : 'Selected mom is missing user_metadata.' }
                  </div>
                )}
                {/* Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowInviteForm(false);
                      setInviteMessage("");
                      setSelectedMomId("");
                      setSelectedMom(null);
                      setSearchQuery("");
                      setSearchResults([]);
                      setInviteMode('search');
                    }}
                    className="flex-1 px-6 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors font-medium"
                  >
                    Back
                  </button>
                  {/* Prevent duplicate invites: check if a pending invite exists for this mom */}
                  {(() => {
                    const alreadyInvited = villageInvitations.some(
                      inv => inv.from_user_id === currentUserId && inv.to_user_id === selectedMomId && inv.status === 'pending'
                    );
                    if (alreadyInvited) {
                      return (
                        <button
                          disabled
                          className="flex-1 px-6 py-2 rounded-lg bg-gray-300 text-gray-600 font-medium cursor-not-allowed"
                          title="Invitation already sent"
                        >
                          Invitation sent
                        </button>
                      );
                    }
                    return (
                      <button
                        onClick={handleSendVillageInvitation}
                        disabled={!selectedMomId || !selectedMom?.user_metadata}
                        className={`flex-1 px-6 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-medium hover:shadow-lg transition-all ${(!selectedMomId || !selectedMom?.user_metadata) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={!selectedMomId ? 'Select a mom first' : (!selectedMom?.user_metadata ? 'Profile data missing' : '')}
                      >
                        Send Invitation
                      </button>
                    );
                  })()}
                </div>
              </div>
            )}
            {/* Invitations Tab */}
            {(activeTab as VillageTabType) === 'invitations' && (
              <div className="space-y-6">
                {/* Sent Invitations */}
                {villageInvitations.filter(i => i.from_user_id === currentUserId).length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                      📤 Sent Invitations ({villageInvitations.filter(i => i.from_user_id === currentUserId).length})
                    </h3>
                    <div className="space-y-4">
                      {villageInvitations.filter(i => i.from_user_id === currentUserId).map(invitation => {
                        // Cast to VillageInvitationWithRecipient for UI fields
                        const inv = invitation as VillageInvitationWithRecipient;
                        return (
                          <div
                            key={inv.id}
                            className="p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl"
                          >
                            <div className="flex items-start gap-4 mb-2">
                              <div>
                                <h4 className="font-semibold text-blue-900 dark:text-blue-50 mb-1">
                                  To: {inv.to_user_name || inv.to_user_id}
                                </h4>
                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                  Status: {inv.status}
                                </p>
                                {inv.message && (
                                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                                    "{inv.message}"
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Received Invitations */}
                {pendingInvitations.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                      📬 Pending Invitations ({pendingInvitations.length})
                    </h3>
                    <div className="space-y-4">
                      {pendingInvitations.map(invitation => (
                        <div
                          key={invitation.id}
                          className="p-6 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl"
                        >
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                              <h4 className="font-semibold text-purple-900 dark:text-purple-50 mb-1">
                                {invitation.from_user_name}
                              </h4>
                              <p className="text-sm text-purple-700 dark:text-purple-300">
                                Wants you to join their village
                              </p>
                              {/* Invitations Tab */}
                              {(activeTab as VillageTabType) === 'invitations' && (
                                <div className="space-y-6">
                                  {/* Sent Invitations */}
                                  {villageInvitations.filter(i => i.from_user_id === currentUserId).length > 0 && (
                                    <div>
                                      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                                        Sent Invitations
                                      </h3>
                                      <div className="space-y-2">
                                        {villageInvitations.filter(i => i.from_user_id === currentUserId).map(inv => (
                                          <div key={inv.id} className="p-2 border rounded">
                                            <div>To: {inv.to_user_id}</div>
                                            <div>Status: <span className={`font-semibold ${inv.status === 'pending' ? 'text-yellow-600' : inv.status === 'accepted' ? 'text-green-600' : 'text-red-600'}`}>{inv.status}</span></div>
                                            {inv.message && <div>Message: "{inv.message}"</div>}
                                            <div className="text-xs text-zinc-400">Sent: {new Date(inv.created_at).toLocaleString()}</div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {/* Received Invitations */}
                                  {villageInvitations.filter(i => i.to_user_id === currentUserId).length > 0 && (
                                    <div>
                                      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                                        Received Invitations
                                      </h3>
                                      <div className="space-y-2">
                                        {villageInvitations.filter(i => i.to_user_id === currentUserId).map(inv => (
                                          <div key={inv.id} className="p-2 border rounded">
                                            <div>From: {inv.from_user_id}</div>
                                            <div>Status: <span className={`font-semibold ${inv.status === 'pending' ? 'text-yellow-600' : inv.status === 'accepted' ? 'text-green-600' : 'text-red-600'}`}>{inv.status}</span></div>
                                            {inv.message && <div>Message: "{inv.message}"</div>}
                                            <div className="text-xs text-zinc-400">Received: {new Date(inv.created_at).toLocaleString()}</div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                              <p className="text-sm text-green-700 dark:text-green-300">
                                You're now part of their village!
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {villageInvitations.length === 0 && (
                  <div className="text-center py-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                    <div className="text-4xl mb-3">📭</div>
                    <p className="text-zinc-600 dark:text-zinc-400">
                      No village invitations yet
                    </p>
                  </div>
                )}
              </div>
            )}