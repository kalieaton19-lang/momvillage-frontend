import { useState, useEffect, useRef } from "react";

export function useNotification() {
  const [notification, setNotification] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  function showNotification(message: string, duration = 4000) {
    setNotification(message);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setNotification(null), duration);
  }

  function NotificationComponent() {
    if (!notification) return null;
    return (
      <div style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        background: '#f472b6',
        color: 'white',
        padding: '16px 24px',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        zIndex: 9999,
        fontWeight: 600,
        fontSize: 16,
      }}>
        {notification}
      </div>
    );
  }

  return { showNotification, NotificationComponent };
}
