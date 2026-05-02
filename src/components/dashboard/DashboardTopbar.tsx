"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

const POLL_MS = 60_000;

export function DashboardTopbar() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function fetchUnread() {
      try {
        const res = await fetch("/api/notifications?limit=1");
        if (!res.ok || cancelled) return;
        const j = (await res.json()) as { unreadCount?: number };
        setUnreadCount(typeof j.unreadCount === "number" ? j.unreadCount : 0);
      } catch {
        /* ignore */
      }
    }
    void fetchUnread();
    const id = window.setInterval(() => void fetchUnread(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const badge =
    unreadCount > 0 ? (unreadCount > 99 ? "99+" : String(unreadCount)) : null;

  return (
    <header className="sticky top-0 z-30 mb-4 flex h-12 shrink-0 items-center justify-end border-b border-border-subtle/80 bg-bg-base/95 px-1 backdrop-blur-sm md:-mt-2 md:mb-6 md:border-transparent md:bg-transparent md:backdrop-blur-none">
      <Link
        href="/dashboard/notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-card hover:text-text-primary"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" strokeWidth={1.75} />
        {badge ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold leading-none text-black">
            {badge}
          </span>
        ) : null}
      </Link>
    </header>
  );
}
