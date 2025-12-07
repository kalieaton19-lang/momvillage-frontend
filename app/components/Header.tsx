"use client";

import { useState } from "react";
import Link from "next/link";

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="max-w-6xl mx-auto p-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-pink-600 flex items-center justify-center text-white font-semibold">MV</div>
        <span className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">MomVillage</span>
      </div>

      <nav className="hidden md:flex gap-6 text-sm">
        <Link href="/">Home</Link>
        <Link href="/community">Community</Link>
        <Link href="/resources">Resources</Link>
        <Link href="/about">About</Link>
      </nav>

      <div className="flex items-center gap-3">
        <div className="hidden md:block">
          <Link href="/login" className="rounded-full bg-pink-600 text-white px-4 py-2 text-sm">Join</Link>
        </div>

        <button
          className="md:hidden p-2 rounded-md border border-zinc-200 dark:border-zinc-800"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((s) => !s)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {open && (
        <div className="absolute inset-x-4 top-20 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-lg p-4 md:hidden">
          <nav className="flex flex-col gap-3">
            <Link href="/">Home</Link>
            <Link href="/community">Community</Link>
            <Link href="/resources">Resources</Link>
            <Link href="/about">About</Link>
            <Link href="/login">Login</Link>
          </nav>
        </div>
      )}
    </header>
  );
}
