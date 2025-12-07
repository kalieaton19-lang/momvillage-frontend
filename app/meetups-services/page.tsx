"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

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

interface Conversation {
  id: string;
  other_user_id: string;
  other_user_name: string;
  other_user_photo?: string;
}

interface Village {
  id: string;
  name: string;
  photo?: string;
}

interface Invitation {
  id: string;
  inviter_id: string;
  inviter_name: string;
  inviter_photo?: string;
  date: string;
  start_time: string;
  end_time: string;
  type: 'meetup' | 'service';
  title: string;
  description?: string;
  location?: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export default function MeetupsServicesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [villageMembers, setVillageMembers] = useState<Village[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<'create' | 'invitations'>('create');
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<'meetup' | 'service'>('meetup');
  const [selectedInvitee, setSelectedInvitee] = useState("");
  const [inviteeSource, setInviteeSource] = useState<'conversation' | 'village'>('conversation');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    startTime: '',
    endTime: '',
    location: '',
  });

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
      
      await loadConversations(session.user.id);
      await loadVillage(session.user.id);
      await loadInvitations(session.user.id);
    } catch (error) {
      console.error('Error checking user:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  function loadConversations(userId: string) {
    try {
      const convKey = `conversations_${userId}`;
      const storedConvs = localStorage.getItem(convKey);
      if (storedConvs) {
        setConversations(JSON.parse(storedConvs));
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  }

  function loadVillage(userId: string) {
    try {
      const villageKey = `village_${userId}`;
      const storedVillage = localStorage.getItem(villageKey);
      if (storedVillage) {
        setVillageMembers(JSON.parse(storedVillage));
      }
    } catch (error) {
      console.error('Error loading village:', error);
    }
  }

  function loadInvitations(userId: string) {
    try {
      const invKey = `invitations_${userId}`;
      const storedInv = localStorage.getItem(invKey);
      if (storedInv) {
        const invs: Invitation[] = JSON.parse(storedInv);
        setInvitations(invs);
      }
    } catch (error) {
      console.error('Error loading invitations:', error);
    }
  }

  async function handleCreateInvitation() {
    if (!selectedInvitee || !formData.title || !formData.date || !formData.startTime || !formData.endTime) {
      setMessage("Please fill in all required fields");
      setTimeout(() => setMessage(""), 3000);
      return;
    }

    try {
      // Get invitee info
      let inviteeName = "";
      let inviteeId = selectedInvitee;
      
      if (inviteeSource === 'conversation') {
        const conv = conversations.find(c => c.other_user_id === selectedInvitee);
        inviteeName = conv?.other_user_name || "Mom";
      } else {
        const village = villageMembers.find(m => m.id === selectedInvitee);
        inviteeName = village?.name || "Mom";
      }

      // Create invitation object for both users
      const invitation: Invitation = {
        id: `inv_${Date.now()}`,
        inviter_id: currentUserId,
        inviter_name: currentProfile?.full_name || 'A Mom',
        inviter_photo: currentProfile?.profile_photo_url,
        date: formData.date,
        start_time: formData.startTime,
        end_time: formData.endTime,
        type: formType,
        title: formData.title,
        description: formData.description,
        location: formData.location,
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      // Save to invitee's invitations
      const inviteeKey = `invitations_${inviteeId}`;
      const inviteeInvs = JSON.parse(localStorage.getItem(inviteeKey) || '[]');
      inviteeInvs.unshift(invitation);
      localStorage.setItem(inviteeKey, JSON.stringify(inviteeInvs));

      // Also save to current user's sent invitations
      const sentKey = `sent_invitations_${currentUserId}`;
      const sentInvs = JSON.parse(localStorage.getItem(sentKey) || '[]');
      sentInvs.unshift(invitation);
      localStorage.setItem(sentKey, JSON.stringify(sentInvs));

      setMessage(`Invitation sent to ${inviteeName}!`);
      setFormData({ title: '', description: '', date: '', startTime: '', endTime: '', location: '' });
      setSelectedInvitee("");
      setShowForm(false);
      await loadInvitations(currentUserId);
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error('Error creating invitation:', error);
      setMessage("Failed to send invitation");
      setTimeout(() => setMessage(""), 3000);
    }
  }

  async function handleRespondToInvitation(invitationId: string, accept: boolean) {
    try {
      const updatedInvs = invitations.map(inv => 
        inv.id === invitationId 
          ? { ...inv, status: (accept ? 'accepted' : 'declined') as ('pending' | 'accepted' | 'declined') }
          : inv
      );
      
      const invKey = `invitations_${currentUserId}`;
      localStorage.setItem(invKey, JSON.stringify(updatedInvs));
      setInvitations(updatedInvs);

      // Update sender's sent invitations
      const sentKey = `sent_invitations_${invitations.find(i => i.id === invitationId)?.inviter_id}`;
      const sentInvs = JSON.parse(localStorage.getItem(sentKey) || '[]');
      const updated = sentInvs.map((inv: Invitation) =>
        inv.id === invitationId
          ? { ...inv, status: (accept ? 'accepted' : 'declined') as ('pending' | 'accepted' | 'declined') }
          : inv
      );
      localStorage.setItem(sentKey, JSON.stringify(updated));

      const invitation = invitations.find(i => i.id === invitationId);
      setMessage(`Invitation ${accept ? 'accepted' : 'declined'} for ${invitation?.title}`);
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error('Error responding to invitation:', error);
      setMessage("Failed to respond to invitation");
      setTimeout(() => setMessage(""), 3000);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  const allInvitees = [
    ...conversations.map(c => ({
      id: c.other_user_id,
      name: c.other_user_name,
      photo: c.other_user_photo,
      source: 'conversation' as const,
    })),
    ...villageMembers.map(v => ({
      id: v.id,
      name: v.name,
      photo: v.photo,
      source: 'village' as const,
    })),
  ];

  const pendingInvitations = invitations.filter(i => i.status === 'pending');
  const acceptedInvitations = invitations.filter(i => i.status === 'accepted');

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Meetups & Services 🤝</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Plan and coordinate with other moms in your village
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
        <div className="mb-6 flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 font-medium text-sm transition-colors ${
              activeTab === 'create'
                ? 'text-pink-600 dark:text-pink-400 border-b-2 border-pink-600 dark:border-pink-400'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50'
            }`}
          >
            Create Invitation
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`px-4 py-2 font-medium text-sm transition-colors relative ${
              activeTab === 'invitations'
                ? 'text-pink-600 dark:text-pink-400 border-b-2 border-pink-600 dark:border-pink-400'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50'
            }`}
          >
            My Invitations
            {pendingInvitations.length > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {pendingInvitations.length}
              </span>
            )}
          </button>
        </div>

        {/* Create Invitation Tab */}
        {activeTab === 'create' && (
          <div className="max-w-2xl">
            {!showForm ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    setFormType('meetup');
                    setShowForm(true);
                  }}
                  className="p-6 bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 border border-pink-200 dark:border-pink-800 rounded-2xl hover:shadow-lg transition-all"
                >
                  <div className="text-3xl mb-3">👋</div>
                  <h3 className="text-lg font-semibold text-pink-900 dark:text-pink-50 mb-2">Plan a Meetup</h3>
                  <p className="text-sm text-pink-700 dark:text-pink-300">
                    Invite another mom to meet up in person or virtually
                  </p>
                </button>
                <button
                  onClick={() => {
                    setFormType('service');
                    setShowForm(true);
                  }}
                  className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border border-purple-200 dark:border-purple-800 rounded-2xl hover:shadow-lg transition-all"
                >
                  <div className="text-3xl mb-3">🤝</div>
                  <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-50 mb-2">Exchange Services</h3>
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    Coordinate a service exchange with someone in your village
                  </p>
                </button>
              </div>
            ) : (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-6">
                  {formType === 'meetup' ? 'Plan a Meetup' : 'Exchange Services'} 👋
                </h2>

                {/* Select Invitee */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                    Who do you want to invite?
                  </label>
                  
                  {allInvitees.length === 0 ? (
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      <p className="mb-2">You don't have any conversations or village members yet.</p>
                      <Link href="/find-moms" className="text-pink-600 dark:text-pink-400 hover:underline">
                        Find moms to connect with →
                      </Link>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {allInvitees.map(invitee => (
                        <button
                          key={invitee.id}
                          onClick={() => setSelectedInvitee(invitee.id)}
                          className={`p-3 rounded-lg border-2 text-left transition-all ${
                            selectedInvitee === invitee.id
                              ? 'border-pink-500 dark:border-pink-600 bg-pink-50 dark:bg-pink-900/20'
                              : 'border-zinc-200 dark:border-zinc-700 hover:border-pink-300 dark:hover:border-pink-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {invitee.photo ? (
                              <img src={invitee.photo} alt={invitee.name} className="w-8 h-8 rounded-full" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-zinc-300 dark:bg-zinc-600"></div>
                            )}
                            <div className="min-w-0">
                              <div className="font-medium text-sm text-zinc-900 dark:text-zinc-50 truncate">
                                {invitee.name}
                              </div>
                              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                {invitee.source === 'conversation' ? '💬 Conversation' : '👥 Village'}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedInvitee && (
                  <>
                    {/* Title */}
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                        {formType === 'meetup' ? 'Meetup Title' : 'Service Title'}
                      </label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder={formType === 'meetup' ? 'e.g., Coffee & Chat' : 'e.g., Babysitting Exchange'}
                        className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 placeholder-zinc-500 dark:placeholder-zinc-400"
                      />
                    </div>

                    {/* Description */}
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                        Description
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Add any details or notes..."
                        rows={3}
                        className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 placeholder-zinc-500 dark:placeholder-zinc-400"
                      />
                    </div>

                    {/* Date & Time */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div>
                        <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                          Date
                        </label>
                        <input
                          type="date"
                          value={formData.date}
                          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                            Start Time
                          </label>
                          <input
                            type="time"
                            value={formData.startTime}
                            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                            End Time
                          </label>
                          <input
                            type="time"
                            value={formData.endTime}
                            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Location */}
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                        Location (optional)
                      </label>
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        placeholder="e.g., Park near Main St or Virtual"
                        className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 placeholder-zinc-500 dark:placeholder-zinc-400"
                      />
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowForm(false)}
                        className="flex-1 px-6 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleCreateInvitation}
                        className="flex-1 px-6 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-pink-600 text-white font-medium hover:shadow-lg transition-all"
                      >
                        Send Invitation
                      </button>
                    </div>
                  </>
                )}
              </div>
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
                      className={`p-6 rounded-2xl border ${
                        invitation.type === 'service'
                          ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
                          : 'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">
                              {invitation.type === 'service' ? '🤝' : '👋'}
                            </span>
                            <div>
                              <h4 className={`font-semibold ${
                                invitation.type === 'service'
                                  ? 'text-purple-900 dark:text-purple-50'
                                  : 'text-pink-900 dark:text-pink-50'
                              }`}>
                                {invitation.title}
                              </h4>
                              <p className={`text-sm ${
                                invitation.type === 'service'
                                  ? 'text-purple-700 dark:text-purple-300'
                                  : 'text-pink-700 dark:text-pink-300'
                              }`}>
                                From {invitation.inviter_name}
                              </p>
                            </div>
                          </div>
                          {invitation.description && (
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                              {invitation.description}
                            </p>
                          )}
                          <div className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                            <p>📅 {new Date(invitation.date).toLocaleDateString()} at {invitation.start_time}</p>
                            {invitation.location && <p>📍 {invitation.location}</p>}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleRespondToInvitation(invitation.id, true)}
                          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                            invitation.type === 'service'
                              ? 'bg-purple-500 hover:bg-purple-600 text-white'
                              : 'bg-pink-500 hover:bg-pink-600 text-white'
                          }`}
                        >
                          ✓ Accept
                        </button>
                        <button
                          onClick={() => handleRespondToInvitation(invitation.id, false)}
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
                  ✓ Confirmed ({acceptedInvitations.length})
                </h3>
                <div className="space-y-4">
                  {acceptedInvitations.map(invitation => (
                    <div
                      key={invitation.id}
                      className={`p-6 rounded-2xl border ${
                        invitation.type === 'service'
                          ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
                          : 'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <span className="text-2xl">
                          {invitation.type === 'service' ? '🤝' : '👋'}
                        </span>
                        <div className="flex-1">
                          <h4 className={`font-semibold mb-1 ${
                            invitation.type === 'service'
                              ? 'text-purple-900 dark:text-purple-50'
                              : 'text-pink-900 dark:text-pink-50'
                          }`}>
                            {invitation.title}
                          </h4>
                          <p className={`text-sm mb-2 ${
                            invitation.type === 'service'
                              ? 'text-purple-700 dark:text-purple-300'
                              : 'text-pink-700 dark:text-pink-300'
                          }`}>
                            With {invitation.inviter_name}
                          </p>
                          <div className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                            <p>📅 {new Date(invitation.date).toLocaleDateString()} at {invitation.start_time}</p>
                            {invitation.location && <p>📍 {invitation.location}</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {invitations.length === 0 && (
              <div className="text-center py-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-zinc-600 dark:text-zinc-400">
                  No invitations yet. Create one to get started!
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
