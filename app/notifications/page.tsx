import React from "react";

export default function NotificationsPage() {
  return (
    <div className="min-h-screen bg-pink-50 dark:bg-zinc-900 w-full">
      {/* White title banner */}
      <div className="w-full py-6 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 text-center rounded-none">
        <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Notifications</h1>
      </div>
      <div className="flex flex-col items-center justify-start pt-12">
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow p-6 w-full max-w-xl">
          <p className="text-zinc-500 dark:text-zinc-300 text-center">You have no notifications yet.</p>
        </div>
      </div>
    </div>
  );
}
