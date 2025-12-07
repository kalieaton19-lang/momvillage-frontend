"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  function validate() {
    if (!email) return "Email is required";
    // simple email pattern
    if (!/^[\w-.]+@[\w-]+\.[a-zA-Z]{2,}$/.test(email)) return "Enter a valid email";
    if (!password) return "Password is required";
    if (password.length < 6) return "Password must be at least 6 characters";
    return "";
  }

  function fieldError(field: "email" | "password") {
    if (!error) return false;
    const e = error.toLowerCase();
    return e.includes(field);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    try {
        console.log('Attempting login...', { email });
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        console.log('Login response:', { data, error });
        if (error) {
          console.error('Login error:', error);
          setError(error.message || "Invalid credentials");
          return;
        }
        if (data?.session) {
          setSuccess("Logged in successfully. Redirecting...");
          // Check if user has profile set up
          const { data: { user } } = await supabase.auth.getUser();
          const hasProfile = user?.user_metadata?.full_name;
          
          // Redirect to profile if first time, otherwise to home
          setTimeout(() => {
            window.location.href = hasProfile ? '/home' : '/profile';
          }, 1000);
        } else {
          setSuccess("Check your email for a confirmation link (if enabled).");
        }
    } catch (err) {
      console.error('Network/fetch error:', err);
      setError(`Network error: ${err instanceof Error ? err.message : 'Unknown'}. Check console and verify Supabase URL in .env.local`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900 p-6">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-8 shadow-sm">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Sign in to MomVillage</h1>
          <Link href="/" className="text-sm text-zinc-600 dark:text-zinc-400">Home</Link>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col text-sm">
            <span className="mb-1 text-zinc-700 dark:text-zinc-300">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-zinc-200 px-3 py-2 bg-white text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-pink-300"
              placeholder="you@example.com"
              required
              aria-invalid={fieldError("email")}
            />
          </label>

          <label className="flex flex-col text-sm">
            <span className="mb-1 text-zinc-700 dark:text-zinc-300">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-zinc-200 px-3 py-2 bg-white text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-pink-300"
              placeholder="Your password"
              required
              aria-invalid={fieldError("password")}
            />
          </label>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
              <input type="checkbox" className="w-4 h-4" /> Remember me
            </label>
            <a href="#" className="text-pink-600 dark:text-pink-400">Forgot?</a>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}
          {success && <div className="text-sm text-green-600">{success}</div>}

          <button
            type="submit"
            className="mt-2 rounded-full bg-pink-600 text-white px-4 py-2 font-medium hover:bg-pink-700 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Or continue with
        </div>

        <div className="mt-3 flex gap-3">
          <button className="flex-1 rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800">Continue with Google</button>
          <button className="flex-1 rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800">Continue with Apple</button>
        </div>

        <div className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Don't have an account? <Link href="/signup" className="text-pink-600 dark:text-pink-400">Sign up</Link>
        </div>
      </div>
    </div>
  );
}
