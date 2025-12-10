"use client";

import React from "react";

export interface AvailabilityToggleProps {
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
  description?: string;
}

export default function AvailabilityToggle({ enabled, onToggle, disabled, description }: AvailabilityToggleProps) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`w-full text-left p-3 rounded-lg border transition-all ${
        disabled
          ? 'opacity-50 cursor-not-allowed bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700'
          : enabled
          ? 'bg-pink-50 dark:bg-pink-900/20 border-pink-300 dark:border-pink-700'
          : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-pink-300 dark:hover:border-pink-700'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">⏱️ Availability</span>
        <div className={`w-10 h-5 rounded-full transition-colors ${
          enabled ? 'bg-pink-600' : 'bg-zinc-300 dark:bg-zinc-600'
        }`}>
          <div className={`w-4 h-4 rounded-full bg-white transition-transform transform ${
            enabled ? 'translate-x-5' : 'translate-x-0.5'
          } mt-0.5`} />
        </div>
      </div>
      <div className="text-xs text-zinc-600 dark:text-zinc-400">{description || 'Only moms with any availability set'}</div>
    </button>
  );
}
