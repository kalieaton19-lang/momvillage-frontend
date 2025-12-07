"use client";

import { useState } from "react";
import Link from "next/link";

export default function ResetPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMessage(data?.error || "Failed to send reset email");
      else setMessage("Password reset email sent (demo)");
    } catch (err) {
      setMessage("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-8">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Reset password</h1>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <input required type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="px-3 py-2 border rounded-md" />
          <button className="rounded-full bg-pink-600 text-white px-4 py-2" disabled={loading}>{loading ? 'Sending…' : 'Send reset email'}</button>
        </form>
        {message && <div className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">{message}</div>}
        <div className="mt-4 text-sm">Remembered? <Link href="/login" className="text-pink-600">Sign in</Link></div>
      </div>
    </div>
  );
}
