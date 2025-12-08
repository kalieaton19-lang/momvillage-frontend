"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { Input } from "@/app/components/ui/Input";
import { Button } from "@/app/components/ui/Button";
import { Alert } from "@/app/components/ui/Alert";

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
        {message && (
          <Alert
            variant={message.toLowerCase().includes('error') ? 'error' : 'info'}
            className="mt-4"
            title={message.toLowerCase().includes('error') ? 'Signup error' : 'Notice'}
          >
            {message}
          </Alert>
        )}
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <Input
            required
            type="email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            required
            type="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" fullWidth disabled={loading}>
            {loading ? 'Creating…' : 'Create account'}
          </Button>
        </form>
        <div className="mt-4 text-sm">Already have an account? <Link href="/login" className="text-pink-600">Sign in</Link></div>
      </div>
    </div>
  );
}
