"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("Mom");
  const [email, setEmail] = useState("");
  const [privateProfile, setPrivateProfile] = useState(false);
  const [privacySaving, setPrivacySaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push("/login");
          return;
        }

        const authUser = session.user;
        const displayName =
          String(authUser.user_metadata?.full_name || authUser.user_metadata?.name || "").trim() ||
          "Mom";

        setFullName(displayName);
        setEmail(authUser.email || "");

        const { data: publicProfile } = await supabase
          .from("user_public_profiles")
          .select("is_public")
          .eq("id", authUser.id)
          .maybeSingle();

        if (publicProfile) {
          setPrivateProfile(publicProfile.is_public === false);
        }
      } finally {
        setLoading(false);
      }
    }

    void loadUser();
  }, [router]);

  if (loading) {
    return <div className="p-8 text-center">Loading settings...</div>;
  }

  async function handlePrivateToggle(nextPrivateValue: boolean) {
    setPrivateProfile(nextPrivateValue);
    setPrivacySaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    if (!userId) {
      setPrivacySaving(false);
      return;
    }

    const { error } = await supabase
      .from("user_public_profiles")
      .update({ is_public: !nextPrivateValue })
      .eq("id", userId);

    if (error) {
      setPrivateProfile(!nextPrivateValue);
      alert(error.message || "Could not update privacy setting.");
    }

    setPrivacySaving(false);
  }

  return (
    <div className="min-h-screen bg-pink-50 dark:bg-pink-950 p-0 sm:p-4">
      <div className="w-full max-w-2xl mx-auto flex items-center pt-4 pb-2 px-2 sm:px-0">
        <button
          onClick={() => router.push("/profile")}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full p-2 shadow hover:bg-pink-50 dark:hover:bg-pink-800 transition focus:outline-none focus:ring-2 focus:ring-pink-400"
          aria-label="Back to Profile"
        >
          <svg
            width="24"
            height="24"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            className="text-pink-600"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      <div className="w-full max-w-2xl mx-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Manage your account information, privacy, and subscription preferences.
        </p>

        <section className="mt-5 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-pink-600 dark:text-pink-300">Account Information</h2>
          <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">
            <div><span className="font-semibold">Name:</span> {fullName}</div>
            <div><span className="font-semibold">Email:</span> {email || "Not set"}</div>
          </div>
          <Link
            href="/edit-profile"
            className="inline-flex mt-3 px-3 py-2 rounded-lg bg-pink-100 hover:bg-pink-200 text-pink-700 border border-pink-500 font-semibold text-sm dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700 dark:hover:bg-pink-900/45"
          >
            Edit profile details
          </Link>
        </section>

        <section className="mt-4 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-pink-600 dark:text-pink-300">Privacy</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Control who can view your profile and activity.
          </p>
          <label className="mt-3 inline-flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={privateProfile}
              onChange={(event) => {
                void handlePrivateToggle(event.target.checked);
              }}
              disabled={privacySaving}
              className="h-4 w-4 rounded border-zinc-300 text-pink-600 focus:ring-pink-500"
            />
            <span className="text-sm text-zinc-700 dark:text-zinc-200">
              Private profile {privacySaving ? "(saving...)" : ""}
            </span>
          </label>
          <div className="mt-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 p-3 text-xs text-zinc-600 dark:text-zinc-300 space-y-2">
            <p>
              <span className="font-semibold text-zinc-800 dark:text-zinc-100">Public profile:</span> All users can see your villagers, profile information, and posts.
            </p>
            <p>
              <span className="font-semibold text-zinc-800 dark:text-zinc-100">Private profile:</span> All users can only see your profile photo, village count, posts count, and moms helped count.
            </p>
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-pink-600 dark:text-pink-300">Subscription</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            View and manage premium subscription options.
          </p>
          <button
            type="button"
            onClick={() => alert("Subscription management is coming soon.")}
            className="mt-3 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Manage subscription
          </button>
        </section>

        <section className="mt-4 rounded-xl border border-red-200 dark:border-red-900/40 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-red-600 dark:text-red-300">Delete Account</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Permanently delete your account and all associated data.
          </p>

          {!showDeleteConfirm ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="mt-3 px-3 py-2 rounded-lg border border-red-400 text-red-600 dark:text-red-300 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              Delete account
            </button>
          ) : (
            <div className="mt-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 p-3">
              <p className="text-sm text-red-700 dark:text-red-300">
                Account deletion currently requires support assistance. Please email support to complete this safely.
              </p>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="mt-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:underline"
              >
                Cancel
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
