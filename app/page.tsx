"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sacramento } from "next/font/google";

const scriptFont = Sacramento({
  subsets: ["latin"],
  weight: "400",
});

export default function Home() {
  const [phase, setPhase] = useState(0);
  const [showButtons, setShowButtons] = useState(false);

  useEffect(() => {
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    timers.push(setTimeout(() => setPhase(1), 120));
    timers.push(setTimeout(() => setPhase(2), 2200));
    timers.push(setTimeout(() => setPhase(3), 4700));
    timers.push(setTimeout(() => setShowButtons(true), 6900));

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#efefef] flex items-center justify-center overflow-hidden p-4">
      <div className="w-full max-w-[900px] aspect-square relative">
        <svg viewBox="0 0 900 900" className="w-full h-full">
          <g
            style={{
              opacity: phase >= 1 ? 1 : 0,
              transform: `translateX(${phase >= 3 ? -210 : phase >= 2 ? -170 : 0}px) translateY(${phase >= 3 ? -40 : phase >= 2 ? 40 : 0}px) scale(${phase >= 3 ? 0.58 : phase >= 2 ? 0.68 : 1})`,
              transformOrigin: "center",
              transition: "opacity 900ms ease, transform 1300ms ease-in-out",
            }}
          >
            <path
              d="M300 620 L300 430"
              fill="none"
              stroke="black"
              strokeWidth="16"
            />
            <path
              d="M480 620 L480 430"
              fill="none"
              stroke="black"
              strokeWidth="16"
            />
            <path
              d="M285 430 L390 200 L495 430"
              fill="none"
              stroke="black"
              strokeWidth="16"
            />
            <path
              d="M300 430 L390 570 L480 430"
              fill="none"
              stroke="black"
              strokeWidth="16"
            />
          </g>

          <g
            style={{
              opacity: phase >= 3 ? 1 : 0,
              transform: `translateX(-210px) translateY(-40px)`,
              transformOrigin: "center",
              transition: "opacity 1000ms ease",
            }}
          >
            <path
              d="M210 430 L210 260 L300 405 L390 260 L390 430"
              fill="none"
              stroke="black"
              strokeWidth="18"
            />
            <path
              d="M210 450 L300 690 L390 450"
              fill="none"
              stroke="black"
              strokeWidth="18"
            />
          </g>

          <text
            x="430"
            y="430"
            fill="#000"
            fontSize="92"
            className={scriptFont.className}
            style={{
              opacity: phase >= 2 ? 1 : 0,
              transform: `translateX(${phase >= 2 ? 0 : 120}px) translateY(${phase >= 3 ? 160 : 0}px)`,
              transition: "opacity 1300ms ease, transform 1300ms ease-in-out",
            }}
          >
            illage
          </text>

          <text
            x="430"
            y="520"
            fill="#000"
            fontSize="92"
            className={scriptFont.className}
            style={{
              opacity: phase >= 2 ? 1 : 0,
              transform: `translateX(${phase >= 2 ? 0 : -80}px) translateY(${phase >= 3 ? -70 : 0}px)`,
              transition: "opacity 1300ms ease, transform 1300ms ease-in-out",
            }}
          >
            om
          </text>

          <text
            x="450"
            y="770"
            textAnchor="middle"
            fill="#111"
            fontSize="31"
            style={{
              opacity: phase >= 3 ? 1 : 0,
              transform: `translateY(${phase >= 3 ? -18 : 0}px)`,
              transition: "opacity 850ms ease, transform 850ms ease",
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
