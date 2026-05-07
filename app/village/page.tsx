}
}
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
                  // File intentionally left blank to resolve parse errors
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
                  })();}
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