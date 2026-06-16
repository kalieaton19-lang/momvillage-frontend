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
    <div className="min-h-screen bg-[#efefef] flex items-start justify-center overflow-hidden p-4 pt-[6vh]">
      <div className="w-full max-w-[760px] md:max-w-[900px] flex flex-col items-center">
        <div className="w-full aspect-square relative overflow-hidden">
        <svg viewBox="0 0 900 900" className="w-full h-full scale-[1.2] sm:scale-[1.08] md:scale-[1.02] lg:scale-100 origin-center">
          <g
            style={{
              opacity: phase >= 1 ? 1 : 0,
              transform: `translateX(${phase >= 3 ? -70 : phase >= 2 ? -145 : 60}px) translateY(${phase >= 3 ? -230 : phase >= 2 ? 25 : 40}px) scale(${phase >= 3 ? 0.72 : phase >= 2 ? 0.82 : 1.2})`,
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
              d="M300 430 L390 570 L480 430"
              fill="none"
              stroke="black"
              strokeWidth="16"
            />
          </g>

          <g
            style={{
              opacity: phase >= 1 && phase < 3 ? 1 : 0,
              transform: `translateX(${phase >= 3 ? -66 : phase >= 2 ? -145 : 60}px) translateY(${phase >= 3 ? 90 : phase >= 2 ? 25 : 40}px) rotate(${phase >= 3 ? 180 : 0}deg) scale(${phase >= 3 ? 0.72 : phase >= 2 ? 0.82 : 1.2})`,
              transformOrigin: "center",
              transition: "opacity 900ms ease, transform 1300ms ease-in-out",
            }}
          >
            <path
              d="M285 430 L390 200 L495 430"
              fill="none"
              stroke="black"
              strokeWidth="16"
            />
          </g>

          <g
            style={{
              opacity: phase >= 3 ? 1 : 0,
              transition: "opacity 700ms ease",
            }}
          >
            <path
              d="M304 430 L354 565 L404 430"
              fill="none"
              stroke="black"
              strokeWidth="12"
            />
          </g>

          <text
            x="410"
            y="430"
            fill="#000"
            fontSize="92"
            className={scriptFont.className}
            style={{
              opacity: phase >= 2 ? 1 : 0,
              transform: `translateX(${phase >= 2 ? 0 : 120}px) translateY(${phase >= 3 ? 55 : 0}px)`,
              transition: "opacity 1300ms ease, transform 1300ms ease-in-out",
            }}
          >
            illage
          </text>

          <text
            x="410"
            y="520"
            fill="#000"
            fontSize="92"
            className={scriptFont.className}
            style={{
              opacity: phase >= 2 ? 1 : 0,
              transform: `translateX(${phase >= 2 ? 0 : -80}px) translateY(${phase >= 3 ? -175 : 0}px)`,
              transition: "opacity 1300ms ease, transform 1300ms ease-in-out",
            }}
          >
            om
          </text>

          <text
            x="450"
            y="740"
            textAnchor="middle"
            fill="#111"
            fontSize="31"
            style={{
              opacity: phase >= 3 ? 1 : 0,
              transform: `translateY(${phase >= 3 ? -10 : 0}px)`,
              transition: "opacity 850ms ease, transform 850ms ease",
            }}
          >
            A village of moms, for moms
          </text>
        </svg>
        </div>

        <div
          className="mt-3 flex flex-col sm:flex-row gap-3"
          style={{
            opacity: showButtons ? 1 : 0,
            transform: `translateY(${showButtons ? 0 : 12}px)`,
            transition: "opacity 500ms ease, transform 500ms ease",
            pointerEvents: showButtons ? "auto" : "none",
          }}
        >
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-full border border-pink-300 bg-white text-pink-700 px-6 py-3 font-medium hover:bg-pink-50"
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
