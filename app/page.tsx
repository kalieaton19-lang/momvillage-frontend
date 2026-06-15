"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Home() {
  const [phase, setPhase] = useState(0);
  const [showButtons, setShowButtons] = useState(false);

  useEffect(() => {
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    timers.push(setTimeout(() => setPhase(1), 120));
    timers.push(setTimeout(() => setPhase(2), 2100));
    timers.push(setTimeout(() => setPhase(3), 3900));
    timers.push(setTimeout(() => setShowButtons(true), 5400));

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#efefef] dark:bg-zinc-950 flex items-center justify-center overflow-hidden p-4">
      <div className="w-full max-w-[900px] aspect-square relative">
        <svg viewBox="0 0 900 900" className="w-full h-full">
          <g
            style={{
              opacity: phase >= 1 ? 1 : 0,
              transform: `translateX(${phase >= 2 ? -120 : 0}px) translateY(${phase >= 3 ? -140 : 0}px)`,
              transformOrigin: "center",
              transition: "opacity 800ms ease, transform 1200ms ease-in-out",
            }}
          >
            <path
              d="M250 600 L250 350 L350 550 L450 350 L450 600"
              fill="none"
              stroke="black"
              strokeWidth="24"
            />
          </g>

          <g
            style={{
              opacity: phase >= 1 ? 1 : 0,
              transform: `translateX(${phase >= 2 ? -120 : 0}px) translateY(${phase >= 3 ? 220 : 0}px) rotate(${phase >= 3 ? 180 : 0}deg)`,
              transformOrigin: "center",
              transition: "opacity 800ms ease, transform 1200ms ease-in-out",
            }}
          >
            <path
              d="M320 350 L450 650 L580 350"
              fill="none"
              stroke="black"
              strokeWidth="24"
            />
          </g>

          <text
            x="470"
            y="450"
            fill="#000"
            fontSize="72"
            style={{
              opacity: phase >= 2 ? 1 : 0,
              transform: `translateX(${phase >= 2 ? 0 : 120}px) translateY(${phase >= 3 ? 120 : 0}px)`,
              transition: "opacity 1200ms ease, transform 1200ms ease",
            }}
          >
            illage
          </text>

          <text
            x="470"
            y="560"
            fill="#000"
            fontSize="72"
            style={{
              opacity: phase >= 2 ? 1 : 0,
              transform: `translateX(${phase >= 2 ? 0 : -80}px) translateY(${phase >= 3 ? -120 : 0}px)`,
              transition: "opacity 1200ms ease, transform 1200ms ease",
            }}
          >
            om
          </text>

          <text
            x="450"
            y="760"
            textAnchor="middle"
            fill="#111"
            fontSize="32"
            style={{
              opacity: phase >= 3 ? 1 : 0,
              transform: `translateY(${phase >= 3 ? -15 : 0}px)`,
              transition: "opacity 800ms ease, transform 800ms ease",
            }}
          >
            A village of moms, for moms
          </text>
        </svg>

        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-8 flex flex-col sm:flex-row gap-3"
          style={{
            opacity: showButtons ? 1 : 0,
            transform: `translate(-50%, ${showButtons ? 0 : 12}px)`,
            transition: "opacity 500ms ease, transform 500ms ease",
            pointerEvents: showButtons ? "auto" : "none",
          }}
        >
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-full bg-zinc-900 text-white px-6 py-3 font-medium hover:bg-zinc-800"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-full border border-pink-300 bg-pink-100 text-pink-700 px-6 py-3 font-medium hover:bg-pink-200"
          >
            Create an Account
          </Link>
        </div>
      </div>
    </div>
  );
}
