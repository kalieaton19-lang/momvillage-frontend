"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoadingProvider, setOauthLoadingProvider] = useState<"google" | "apple" | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const hasMinimumLength = password.length >= 8;
    const hasNumber = /\d/.test(password);

    if (!hasMinimumLength || !hasNumber) {
      setMessage("Password must be at least 8 characters and include at least 1 number.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

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

  async function handleOAuthSignIn(provider: "google" | "apple") {
    setMessage("");
    setOauthLoadingProvider(provider);

    try {
      const redirectTo = typeof window !== "undefined"
        ? `${window.location.origin}/home`
        : undefined;

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
        },
      });

      if (error) {
        const rawMessage = String(error.message || "");
        const unsupportedProvider =
          rawMessage.toLowerCase().includes("unsupported provider") ||
          rawMessage.toLowerCase().includes("provider is not enabled");

        if (unsupportedProvider) {
          setMessage(
            `"Continue with ${provider === "google" ? "Google" : "Apple"}" is not enabled yet in Supabase Auth providers.`,
          );
        } else {
          setMessage(rawMessage || "Could not start social sign-up.");
        }
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not start social sign-up.");
    } finally {
      setOauthLoadingProvider(null);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-8">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Create an account</h1>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <input required type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="px-3 py-2 border rounded-md" />
          <input required type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="px-3 py-2 border rounded-md" />
          <input required type="password" placeholder="Re-enter password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="px-3 py-2 border rounded-md" />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Password must be at least 8 characters and include at least 1 number.
          </p>
          <button className="rounded-full bg-pink-600 text-white px-4 py-2" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</button>
        </form>
        {message && <div className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">{message}</div>}
        <div className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Or continue with
        </div>
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={() => void handleOAuthSignIn("google")}
            disabled={!!oauthLoadingProvider}
            className="flex-1 rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 disabled:opacity-60"
          >
            {oauthLoadingProvider === "google" ? "Connecting…" : "Continue with Google"}
          </button>
          <button
            type="button"
            onClick={() => void handleOAuthSignIn("apple")}
            disabled={!!oauthLoadingProvider}
            className="flex-1 rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 disabled:opacity-60"
          >
            {oauthLoadingProvider === "apple" ? "Connecting…" : "Continue with Apple"}
          </button>
        </div>
        <div className="mt-4 text-sm">Already have an account? <Link href="/login" className="text-pink-600">Sign in</Link></div>
      </div>
    </div>
  );
}
