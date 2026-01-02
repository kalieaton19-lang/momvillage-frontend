"use client";
import { useState, useCallback } from "react";

export function useNotification() {
  const [message, setMessage] = useState<string | null>(null);
  const [type, setType] = useState<"success" | "error" | null>(null);

  const showNotification = useCallback((msg: string, t: "success" | "error" = "error") => {
    setMessage(msg);
    setType(t);
    setTimeout(() => {
      setMessage(null);
      setType(null);
    }, 3500);
  }, []);

  const NotificationComponent = message ? (
    <div
      className={`fixed top-6 left-1/2 z-50 -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg text-white font-medium transition-all duration-300 ${
        type === "success" ? "bg-green-600" : "bg-red-600"
      }`}
      style={{ minWidth: 200, textAlign: "center" }}
    >
      {message}
    </div>
  ) : null;

  return { showNotification, NotificationComponent };
}
