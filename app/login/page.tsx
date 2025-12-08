"use client";
import React, { useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { Input } from "@/app/components/ui/Input";
import { Button } from "@/app/components/ui/Button";
import { Alert } from "@/app/components/ui/Alert";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const mapError = (message?: string) => {
    if (!message) return "Login failed";
    const m = message.toLowerCase();
    if (m.includes("invalid login")) return "Invalid email or password.";
    if (m.includes("email not confirmed")) return "Please confirm your email before logging in.";
    return message;
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErrorMsg(mapError(error.message));
      } else if (data?.session) {
        const { data: userData } = await supabase.auth.getUser();
        const hasProfile = userData?.user?.user_metadata?.full_name;
        window.location.href = hasProfile ? "/home" : "/profile";
      } else {
        setErrorMsg("Check your email for a confirmation link (if enabled).");
      }
    } catch (err: any) {
      setErrorMsg(mapError(err?.message));
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

        {errorMsg ? <Alert variant="error" className="mb-4" title="Login error">{errorMsg}</Alert> : null}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            type="email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" fullWidth disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Don't have an account? <Link href="/signup" className="text-pink-600 dark:text-pink-400">Sign up</Link>
        </div>
      </div>
    </div>
  );
}
