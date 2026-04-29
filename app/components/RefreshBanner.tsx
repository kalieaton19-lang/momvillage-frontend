"use client";
import { useEffect, useState } from "react";

// This component checks for a new deployment every 60 seconds by fetching /vercel.json
// If the deploymentId changes, it shows a refresh banner
export default function RefreshBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let isMounted = true;
    async function checkVersion() {
      try {
        const res = await fetch("/vercel.json", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (isMounted) {
          if (!currentId) {
            setCurrentId(json.deploymentId);
          } else if (json.deploymentId !== currentId) {
            setShowBanner(true);
          }
        }
      } catch {}
    }
    checkVersion();
    interval = setInterval(checkVersion, 60000); // check every 60s
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  if (!showBanner) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-pink-600 text-white text-center py-3 shadow-lg animate-fade-in">
      <span>New version available. </span>
      <button
        className="underline font-semibold ml-1"
        onClick={() => window.location.reload()}
      >
        Refresh
      </button>
    </div>
  );
}
