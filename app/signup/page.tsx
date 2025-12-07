"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setLoading(true);
    try {
      console.log('Attempting signup...', { email });
      const { data, error } = await supabase.auth.signUp({ email, password });
      console.log('Signup response:', { data, error });
      if (error) {
        console.error('Signup error:', error);
        setMessage(error.message || "Failed to sign up");
      } else {
        setMessage("Signup successful — please check your email to confirm (if enabled).");
      }
    } catch (err) {
      console.error('Network/fetch error:', err);
      setMessage(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}. Check console and verify Supabase URL in .env.local`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-8">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Create an account</h1>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <input required type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="px-3 py-2 border rounded-md" />
          <input required type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="px-3 py-2 border rounded-md" />
          <button className="rounded-full bg-pink-600 text-white px-4 py-2" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</button>
        </form>
        {message && <div className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">{message}</div>}
        <div className="mt-4 text-sm">Already have an account? <Link href="/login" className="text-pink-600">Sign in</Link></div>
      </div>
    </div>
  );
}
