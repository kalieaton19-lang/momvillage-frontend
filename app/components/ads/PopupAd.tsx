"use client";
import React, { useEffect, useState } from "react";

interface PopupAdProps {
  title?: string;
  body?: string;
  ctaText?: string;
  ctaHref?: string;
  frequencyHours?: number;
}

export function PopupAd({
  title = "Upgrade to MomVillage Plus",
  body = "Enjoy advanced scheduling, priority support, and local partner discounts.",
  ctaText = "Explore Plus",
  ctaHref = "/",
  frequencyHours = 24,
}: PopupAdProps) {
  const [open, setOpen] = useState(false);
  const enabled = typeof window !== "undefined" && process.env.NEXT_PUBLIC_ENABLE_ADS === "true";

  useEffect(() => {
    if (!enabled) return;
    const key = "popup_ad_last_shown";
    const last = localStorage.getItem(key);
    const now = Date.now();
    const ms = frequencyHours * 60 * 60 * 1000;
    if (!last || now - Number(last) > ms) {
      setTimeout(() => setOpen(true), 600); // small delay after page load
      localStorage.setItem(key, String(now));
    }
  }, [enabled, frequencyHours]);

  if (!enabled || !open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl border border-pink-200 dark:border-pink-800 bg-white dark:bg-zinc-900 p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</div>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{body}</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="mt-4 flex gap-3">
          <a href={ctaHref} className="flex-1 px-4 py-2 rounded-lg bg-pink-600 text-white text-sm font-medium hover:bg-pink-700 text-center">{ctaText}</a>
          <button onClick={() => setOpen(false)} className="flex-1 px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">Not now</button>
        </div>
        <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">You’ll only see this once every {frequencyHours}h.</div>
      </div>
    </div>
  );
}
