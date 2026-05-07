import { useState } from "react";

export default function VillagePage() {
  const [activeTab, setActiveTab] = useState<'members' | 'invitations' | 'invite'>('members');

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900 p-6">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">My Village 🏘️</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Your circle of mom support and friendship
          </p>
        </header>

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
            Members
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`px-4 py-2 font-medium text-sm transition-colors whitespace-nowrap ${
              activeTab === 'invitations'
                ? 'text-pink-600 dark:text-pink-400 border-b-2 border-pink-600 dark:border-pink-400'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50'
            }`}
          >
            Invitations
          </button>
          <button
            onClick={() => setActiveTab('invite')}
            className={`px-4 py-2 font-medium text-sm transition-colors whitespace-nowrap ${
              activeTab === 'invite'
                ? 'text-pink-600 dark:text-pink-400 border-b-2 border-pink-600 dark:border-pink-400'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50'
            }`}
          >
            Invite a Mom
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'members' && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-3">🏘️</div>
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">Your village members will appear here.</p>
            <p className="text-zinc-400 text-xs">(Coming soon: member list, profile modal, actions)</p>
          </div>
        )}
        {activeTab === 'invitations' && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-3">📬</div>
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">Your invitations will appear here.</p>
            <p className="text-zinc-400 text-xs">(Coming soon: pending/accepted invites)</p>
          </div>
        )}
        {activeTab === 'invite' && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-3">🤝</div>
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">Invite a mom to your village.</p>
            <p className="text-zinc-400 text-xs">(Coming soon: search and invite form)</p>
          </div>
        )}
      </div>
    </div>
  );
}
