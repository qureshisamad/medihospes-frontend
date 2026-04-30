"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchNotifications } from "@/lib/calendar-api";

interface NotificationBadgeProps {
  /** Polling interval in milliseconds. Defaults to 30 000 (30s). */
  pollInterval?: number;
}

/**
 * Displays the count of unread notifications as a small badge.
 * Polls GET /notifications on a configurable interval.
 * Renders nothing when the count is zero.
 */
export default function NotificationBadge({
  pollInterval = 30_000,
}: NotificationBadgeProps) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const notifications = await fetchNotifications();
      setCount(notifications.length);
    } catch {
      // Silently ignore — badge is non-critical UI
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    refresh();

    // Set up polling
    const id = setInterval(refresh, pollInterval);
    return () => clearInterval(id);
  }, [refresh, pollInterval]);

  if (count === 0) return null;

  return (
    <span
      className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold leading-none text-white bg-danger-500 rounded-full"
      aria-label={`${count} unread notification${count === 1 ? "" : "s"}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
