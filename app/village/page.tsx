"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { AsyncPendingInvites } from "./AsyncPendingInvites";

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
  from_user_name: string;
  from_user_photo?: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  message?: string;
}

// For UI/state, allow recipient fields
type VillageInvitationWithRecipient = VillageInvitation & {
  to_user_id?: string;
  to_user_name?: string;
  to_user_email?: string;
  to_user_city?: string;
  to_user_state?: string;
};

interface MomProfile {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    profile_photo_url?: string;
    city?: string;
    state?: string;
  };
}

export default function VillagePage() {
    // Track pending sent invitations for the current user
    const [pendingSentInvitations, setPendingSentInvitations] = useState<VillageInvitationWithRecipient[]>([]);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [villageMembers, setVillageMembers] = useState<VillageMember[]>([]);
  const [villageInvitations, setVillageInvitations] = useState<VillageInvitation[]>([]);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<'members' | 'invitations' | 'invite'>('members');
  const [selectedMomId, setSelectedMomId] = useState("");
  const [selectedMom, setSelectedMom] = useState<MomProfile | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");
  const [availableMoms, setAvailableMoms] = useState<MomProfile[]>([]);
  const [selectedMemberProfile, setSelectedMemberProfile] = useState<VillageMember | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MomProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviteMode, setInviteMode] = useState<'search' | 'conversations'>('search');
  const [villageSearchQuery, setVillageSearchQuery] = useState("");

  useEffect(() => {
    checkUser();
  }, []);

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

      // Load and migrate pending sent invitations
      try {
        const sentKey = `village_invitations_sent_${session.user.id}`;
        let sentInvs = JSON.parse(localStorage.getItem(sentKey) || '[]');
        // Migrate: if any invite is missing to_user_id, try to infer from conversations
        sentInvs = sentInvs.map((inv: any) => {
          if (!inv.to_user_id) {
            // Try to match by email to a conversation
            if (Array.isArray(conversations) && inv.to_user_email) {
              const matchConv = conversations.find(c => c.other_user_email === inv.to_user_email);
              if (matchConv) {
                return { ...inv, to_user_id: matchConv.other_user_id };
              }
            }
          }
          return inv;
        });
        // Save migrated invites back to localStorage
        localStorage.setItem(sentKey, JSON.stringify(sentInvs));
        const pending = sentInvs.filter((inv: any) => inv.status === 'pending');
        setPendingSentInvitations(pending);
        console.log('[Village Debug] After migration: sentInvs', sentInvs);
        console.log('[Village Debug] After migration: pendingSentInvitations', pending);
      } catch (e) {
        setPendingSentInvitations([]);
      }
    } catch (error) {
      console.error('Error checking user:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  async function loadVillageData(userId: string) {
        // Debug: log what is being read from localStorage for conversations
        try {
          const convKey = `conversations_${userId}`;
          const storedConvs = localStorage.getItem(convKey);
          console.log('[Village Debug] Read conversations from localStorage:', convKey, storedConvs);
        } catch (e) {
          console.error('[Village Debug] Error reading conversations from localStorage:', e);
        }
    try {
      // Load village members
      const villageKey = `village_${userId}`;
      const storedVillage = localStorage.getItem(villageKey);
      if (storedVillage) {
        setVillageMembers(JSON.parse(storedVillage));
      }

      // Load village invitations
      const invKey = `village_invitations_${userId}`;
      const storedInv = localStorage.getItem(invKey);
      if (storedInv) {
        const invs: VillageInvitation[] = JSON.parse(storedInv);
        setVillageInvitations(invs);
      }

      // Load conversations from localStorage if available, else fetch from Supabase
      const convKey = `conversations_${userId}`;
      let storedConvs = localStorage.getItem(convKey);
      if (!storedConvs) {
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
          const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
          const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
          const { data: convRows, error: convError } = await supabaseClient
            .from('conversations')
            .select('*')
            .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
            .order('created_at', { ascending: false });
          if (!convError && convRows) {
            const convs = convRows.map((conv) => {
              const other_user_id = conv.user1_id === userId ? conv.user2_id : conv.user1_id;
              const other_user_name = conv.user1_id === userId ? conv.user2_name : conv.user1_name;
              const other_user_photo = conv.user1_id === userId ? conv.user2_photo : conv.user1_photo;
              const other_user_email = conv.user1_id === userId ? conv.user2_email : conv.user1_email;
              const other_user_city = conv.user1_id === userId ? conv.user2_city : conv.user1_city;
              const other_user_state = conv.user1_id === userId ? conv.user2_state : conv.user1_state;
              return {
                id: conv.id,
                match_id: conv.id,
                other_user_id,
                other_user_name,
                other_user_photo,
                other_user_email,
                other_user_city,
                other_user_state,
                last_message: '',
                last_message_time: '',
                created_at: conv.created_at,
              };
            });
            localStorage.setItem(convKey, JSON.stringify(convs));
            setConversations(convs);
            console.log('[Village Debug] Loaded conversations from Supabase:', convs);
          } else {
            setConversations([]);
            console.warn('[Village Debug] No conversations found in Supabase or error:', convError);
          }
        } catch (e) {
          setConversations([]);
          console.error('[Village Debug] Error fetching conversations from Supabase:', e);
        }
      } else {
        // Patch: ensure city/state are present if missing in stored conversations
        let convs = JSON.parse(storedConvs);
        convs = convs.map((conv: any) => {
          if (typeof conv.other_user_city === 'undefined' || typeof conv.other_user_state === 'undefined') {
            // Try to infer from mom profile if available
            const mom = availableMoms.find(m => m.id === conv.other_user_id || m.email === conv.other_user_email);
            return {
              ...conv,
              other_user_city: mom?.user_metadata?.city || '',
              other_user_state: mom?.user_metadata?.state || '',
            };
          }
          return conv;
        });
        setConversations(convs);
        console.log('[Village Debug] Loaded conversations from localStorage:', convs);
      }
      // Warn if conversations are still empty
      setTimeout(() => {
        if (Array.isArray(conversations) && conversations.length === 0) {
          console.warn('[Village Debug] Conversations are empty after all attempts. Pending invites may not enrich correctly.');
        }
      }, 1000);
    } catch (error) {
      console.error('Error loading village data:', error);
    }
  }

  async function loadAvailableMoms() {
    try {
      // In a real app, you'd fetch from Supabase
      // For now, we'll simulate by loading from mock data if available
      // This would typically come from Find Moms or other sources
      setAvailableMoms([]);
    } catch (error) {
      console.error('Error loading available moms:', error);
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

      const invitation: VillageInvitation & { to_user_id: string; to_user_name?: string; to_user_email?: string } = {
        id: `vinv_${Date.now()}`,
        from_user_id: currentUserId,
        from_user_name: currentProfile?.full_name || 'A Mom',
        from_user_photo: currentProfile?.profile_photo_url,
        status: 'pending',
        created_at: new Date().toISOString(),
        message: inviteMessage,
        to_user_id: selectedMom.id,
        to_user_name: selectedMom.user_metadata?.full_name,
        to_user_email: selectedMom.email,
      };

      // Save to the invited mom's village invitations
      const invKey = `village_invitations_${selectedMom.id}`;
      const invitations = JSON.parse(localStorage.getItem(invKey) || '[]');
      invitations.unshift(invitation);
      localStorage.setItem(invKey, JSON.stringify(invitations));

      // Also save to current user's sent invitations
      const sentKey = `village_invitations_sent_${currentUserId}`;
      const sentInvitations = JSON.parse(localStorage.getItem(sentKey) || '[]');
      sentInvitations.unshift(invitation);
      localStorage.setItem(sentKey, JSON.stringify(sentInvitations));

      // Update pendingSentInvitations state immediately
      const pending = sentInvitations.filter((inv: any) => inv.status === 'pending');
      setPendingSentInvitations(pending);
      console.log('[Village Debug] After send: sentInvitations', sentInvitations);
      console.log('[Village Debug] After send: pendingSentInvitations', pending);

      setMessage(`Village invitation sent to ${selectedMom.user_metadata?.full_name}!`);
      setSelectedMomId("");
      setSelectedMom(null);
      setInviteMessage("");
      setShowInviteForm(false);
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error('Error sending invitation:', error);
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

      const invKey = `village_invitations_${currentUserId}`;
      localStorage.setItem(invKey, JSON.stringify(updatedInvitations));
      setVillageInvitations(updatedInvitations);

      // If accepted, add to village members
      if (accept) {
        // Fetch the user's info from Supabase
        const { data: { user: inviterUser }, error } = await supabase.auth.admin.getUserById(invitation.from_user_id);
        
        if (!error && inviterUser?.user_metadata) {
          const newMember: VillageMember = {
            id: invitation.from_user_id,
            name: inviterUser.user_metadata.full_name || 'Mom',
            photo: inviterUser.user_metadata.profile_photo_url,
            email: inviterUser.email,
            city: inviterUser.user_metadata.city,
            state: inviterUser.user_metadata.state,
            joined_date: new Date().toISOString(),
          };

          const villageKey = `village_${currentUserId}`;
          const villageMembers = JSON.parse(localStorage.getItem(villageKey) || '[]');
          if (!villageMembers.find((m: VillageMember) => m.id === newMember.id)) {
            villageMembers.unshift(newMember);
            localStorage.setItem(villageKey, JSON.stringify(villageMembers));
            setVillageMembers(villageMembers);

            // Also add current user to inviter's village
            const inviterVillageKey = `village_${invitation.from_user_id}`;
            const inviterVillage = JSON.parse(localStorage.getItem(inviterVillageKey) || '[]');
            const currentMember: VillageMember = {
              id: currentUserId,
              name: currentProfile?.full_name || 'A Mom',
              photo: currentProfile?.profile_photo_url,
              email: user?.email,
              city: currentProfile?.city,
              state: currentProfile?.state,
              joined_date: new Date().toISOString(),
            };
            if (!inviterVillage.find((m: VillageMember) => m.id === currentMember.id)) {
              inviterVillage.unshift(currentMember);
              localStorage.setItem(inviterVillageKey, JSON.stringify(inviterVillage));
            }
          }
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
      } else {
        // Create new conversation
        const conversationId = [currentUserId, memberId].sort().join('_');
        const member = villageMembers.find(m => m.id === memberId);
        
        if (member) {
          const newConv = {
            id: conversationId,
            other_user_id: memberId,
            other_user_name: member.name,
            other_user_photo: member.photo,
            last_message: 'Conversation started',
            last_message_time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          };

          // Save conversation
          const convKey = `conversations_${currentUserId}`;
          const convs = JSON.parse(localStorage.getItem(convKey) || '[]');
          if (!convs.find((c: any) => c.id === conversationId)) {
            convs.unshift(newConv);
            localStorage.setItem(convKey, JSON.stringify(convs));
          }

          setConversations(convs);
          router.push(`/messages?conversation=${conversationId}`);
        }
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      setMessage("Failed to start conversation");
      setTimeout(() => setMessage(""), 3000);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  const pendingInvitations = villageInvitations.filter(i => i.status === 'pending');
  const acceptedInvitations = villageInvitations.filter(i => i.status === 'accepted');

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">My Village 🏘️</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Your circle of mom support and friendship
              </p>
            </div>
            <Link href="/home" className="text-sm text-pink-600 dark:text-pink-400 hover:underline">
              Back to Home
            </Link>
          </div>
        </header>

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
              activeTab === 'members'
                ? 'text-pink-600 dark:text-pink-400 border-b-2 border-pink-600 dark:border-pink-400'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50'
            }`}
          >
            Members ({villageMembers.length})
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`px-4 py-2 font-medium text-sm transition-colors relative whitespace-nowrap ${
              activeTab === 'invitations'
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
              activeTab === 'invite'
                ? 'text-pink-600 dark:text-pink-400 border-b-2 border-pink-600 dark:border-pink-400'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50'
            }`}
          >
            Invite a Mom
          </button>
        </div>

        {/* Members Tab */}
        {activeTab === 'members' && (
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
        {activeTab === 'invitations' && (
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
        {activeTab === 'invite' && (
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
                        {conversations.map((conv) => (
                          (() => {
                            const alreadyInvited = pendingSentInvitations.some(
                              (inv) => inv.to_user_id === conv.other_user_id || inv.to_user_email === conv.other_user_email
                            );
                            return (
                              <div
                                key={conv.id || conv.match_id}
                                onClick={alreadyInvited ? undefined : () => {
                                  setSelectedMomId(conv.other_user_id);
                                  setSelectedMom({
                                    id: conv.other_user_id,
                                    email: conv.other_user_email || "",
                                    user_metadata: {
                                      full_name: conv.other_user_name || "Mom",
                                      profile_photo_url: conv.other_user_photo,
                                      city: conv.other_user_city,
                                      state: conv.other_user_state,
                                    },
                                  });
                                }}
                                className={`flex items-center gap-3 p-3 rounded-lg border-2 ${alreadyInvited ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-pink-300 dark:hover:border-pink-600'} transition-colors ${
                                  selectedMomId === conv.other_user_id
                                    ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20'
                                    : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800'
                                }`}
                              >
                                <img
                                  src={conv.other_user_photo || "/placeholder.png"}
                                  alt={conv.other_user_name || "Mom"}
                                  className="h-12 w-12 rounded-full object-cover"
                                />
                                <div className="flex-1">
                                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                                    {conv.other_user_name || "Unknown Mom"}
                                  </p>
                                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                    {(conv.other_user_city || conv.other_user_state)
                                      ? `${conv.other_user_city || ''}${conv.other_user_city && conv.other_user_state ? ', ' : ''}${conv.other_user_state || ''}`
                                      : "Location not set"}
                                  </p>
                                  {alreadyInvited && (
                                    <span className="inline-block mt-1 px-2 py-0.5 text-xs font-semibold bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 rounded">Already Invited</span>
                                  )}
                                </div>
                                {!alreadyInvited && selectedMomId === conv.other_user_id && (
                                  <div className="text-pink-500">✓</div>
                                )}
                              </div>
                            );
                          })()
                        ))}
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
                          const alreadyInvited = pendingSentInvitations.some(
                            (inv) => inv.to_user_id === mom.id || inv.to_user_email === mom.email
                          );
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
                                {alreadyInvited && (
                                  <span className="inline-block mt-1 px-2 py-0.5 text-xs font-semibold bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 rounded">Already Invited</span>
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
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                    placeholder="Tell her why you'd like her in your village..."
                    rows={4}
                    className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 placeholder-zinc-500 dark:placeholder-zinc-400"
                  />
                </div>

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
                  <button
                    onClick={handleSendVillageInvitation}
                    className="flex-1 px-6 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-medium hover:shadow-lg transition-all"
                  >
                    Send Invitation
                  </button>
                </div>
              </div>
            )}
            {/* Pending Invitations List (below invite box) */}
            {pendingSentInvitations.length > 0 && (
              <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2 text-sm">Pending Invitations:</h3>
                <ul className="space-y-3">
                  <AsyncPendingInvites invites={pendingSentInvitations} />
                </ul>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2">These moms have not yet accepted or declined your invitation.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Profile Modal */}
      {selectedMemberProfile && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-zinc-200 dark:border-zinc-800">
            <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Profile</h2>
              <button
                onClick={() => setSelectedMemberProfile(null)}
                className="text-2xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              {/* Photo */}
              <div className="text-center mb-6">
                {selectedMemberProfile.photo ? (
                  <img
                    src={selectedMemberProfile.photo}
                    alt={selectedMemberProfile.name}
                    className="w-24 h-24 rounded-full object-cover border-4 border-pink-300 mx-auto mb-4"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white text-4xl font-semibold mx-auto mb-4">
                    {selectedMemberProfile.name[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                  {selectedMemberProfile.name}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                  {selectedMemberProfile.email}
                </p>
              </div>

              {/* Info */}
              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">Location</p>
                  <p className="text-zinc-900 dark:text-zinc-50 mt-1">
                    {selectedMemberProfile.city && selectedMemberProfile.state && (selectedMemberProfile.city + ', ' + selectedMemberProfile.state)}
                    {!(selectedMemberProfile.city && selectedMemberProfile.state) && (() => {
                      console.log('[Village Debug] Fallback: selectedMemberProfile:', selectedMemberProfile);
                      // Try to get from conversations
                      const conv = conversations.find(c => c.other_user_id === selectedMemberProfile.id);
                      console.log('[Village Debug] Fallback: matching conversation:', conv);
                      if (conv) {
                        console.log('[Village Debug] Fallback: conv.other_user_city:', conv.other_user_city, 'conv.other_user_state:', conv.other_user_state);
                        if (conv.other_user_city || conv.other_user_state) {
                          return `${conv.other_user_city || ''}${conv.other_user_city && conv.other_user_state ? ', ' : ''}${conv.other_user_state || ''}`;
                        }
                      }
                      // Try to get from availableMoms by id or email
                      const mom = availableMoms.find(m => m.id === selectedMemberProfile.id || m.email === selectedMemberProfile.email);
                      console.log('[Village Debug] Fallback: matching mom from availableMoms:', mom);
                      if (mom) {
                        console.log('[Village Debug] Fallback: mom.user_metadata.city:', mom.user_metadata?.city, 'mom.user_metadata.state:', mom.user_metadata?.state);
                        if (mom.user_metadata?.city || mom.user_metadata?.state) {
                          return `${mom.user_metadata?.city || ''}${mom.user_metadata?.city && mom.user_metadata?.state ? ', ' : ''}${mom.user_metadata?.state || ''}`;
                        }
                      }
                      console.log('[Village Debug] Fallback: Location not set for', selectedMemberProfile.id);
                      return 'Location not set';
                    })()}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">Joined Village</p>
                  <p className="text-zinc-900 dark:text-zinc-50 mt-1">
                    {new Date(selectedMemberProfile.joined_date).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    handleStartConversation(selectedMemberProfile.id);
                    setSelectedMemberProfile(null);
                  }}
                  className="w-full px-4 py-2 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all font-medium"
                >
                  💬 Go to Chat
                </button>
                <button
                  onClick={() => setSelectedMemberProfile(null)}
                  className="w-full px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}