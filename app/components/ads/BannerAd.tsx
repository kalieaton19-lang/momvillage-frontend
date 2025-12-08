"use client";
import React from "react";

interface BannerAdProps {
  title?: string;
  subtitle?: string;
  ctaText?: string;
  ctaHref?: string;
  onClick?: () => void;
  className?: string;
}

export function BannerAd({
  title = "MomVillage Plus",
  subtitle = "Unlock premium features and local perks",
  ctaText = "Learn more",
  ctaHref = "/",
  onClick,
  className = "",
}: BannerAdProps) {
  const enabled = typeof window !== "undefined" && process.env.NEXT_PUBLIC_ENABLE_ADS === "true";
  if (!enabled) return null;

  return (
    <div className={`w-full mb-4 rounded-2xl border bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 border-pink-200 dark:border-pink-800 p-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</div>
          <div className="text-xs text-zinc-700 dark:text-zinc-300">{subtitle}</div>
        </div>
        <a
          href={ctaHref}
          onClick={onClick}
          className="text-xs px-3 py-1 rounded-full bg-pink-600 text-white hover:bg-pink-700"
        >
          {ctaText}
        </a>
      </div>
    </div>
  );
}
