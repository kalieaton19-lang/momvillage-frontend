import React from "react";

export default function NotificationsPage() {
  return (
    <div className="min-h-screen bg-pink-50 dark:bg-zinc-900 flex flex-col items-center justify-start pt-12">
      <h1 className="text-2xl font-bold mb-6 text-pink-600">Notifications</h1>
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow p-6 w-full max-w-xl">
        <p className="text-zinc-500 dark:text-zinc-300 text-center">You have no notifications yet.</p>
      </div>
    </div>
  );
}
