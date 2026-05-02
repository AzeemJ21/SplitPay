"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  Briefcase,
  CircleDollarSign,
  Clock,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  relatedId?: string;
};

function timeAgo(iso: string) {
  const then = new Date(iso).getTime();
  const s = Math.floor((Date.now() - then) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function iconForType(type: string): { Icon: LucideIcon; className: string } {
  if (type === "project_assigned" || type === "milestone_funded" || type === "dispute_opened") {
    return { Icon: Briefcase, className: "text-blue-400" };
  }
  if (type === "work_submitted") {
    return { Icon: ShieldCheck, className: "text-blue-300" };
  }
  if (
    type === "payment_released" ||
    type === "payment_failed" ||
    type === "refund_initiated"
  ) {
    return { Icon: CircleDollarSign, className: "text-orange-400" };
  }
  if (type === "auto_release") {
    return { Icon: RefreshCw, className: "text-emerald-400" };
  }
  return { Icon: Bell, className: "text-[#888888]" };
}

function hrefForNotification(n: NotificationRow): string {
  const base = "/dashboard";
  switch (n.type) {
    case "project_assigned":
    case "milestone_funded":
    case "work_submitted":
    case "dispute_opened":
      return n.relatedId ? `${base}/projects/${n.relatedId}` : `${base}/projects`;
    case "payment_released":
    case "payment_failed":
    case "refund_initiated":
      return `${base}/transactions`;
    case "auto_release":
      return `${base}/milestones`;
    default:
      return `${base}/notifications`;
  }
}

export default function NotificationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const j = (await res.json()) as { data: NotificationRow[] };
      setRows(j.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await fetch("/api/notifications/read-all", { method: "PUT" });
      await load();
      router.refresh();
    } finally {
      setMarkingAll(false);
    }
  };

  const onItemClick = async (n: NotificationRow) => {
    if (!n.read) {
      await fetch(`/api/notifications/${n.id}/read`, { method: "PUT" });
      setRows((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      router.refresh();
    }
    router.push(hrefForNotification(n));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-3xl font-bold text-white">Notifications</h1>
        <button
          type="button"
          onClick={() => void markAllRead()}
          disabled={markingAll || rows.length === 0 || rows.every((r) => r.read)}
          className="inline-flex items-center justify-center rounded-md border border-[#333333] px-4 py-2 text-sm font-medium text-white transition-colors hover:border-orange-500/50 hover:text-orange-400 disabled:opacity-40"
        >
          {markingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Mark all read
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-border-subtle bg-bg-surface px-6 py-16 text-center">
          <Bell className="h-14 w-14 text-text-muted" />
          <p className="mt-6 font-display text-xl text-white">You&apos;re all caught up!</p>
          <p className="mt-2 text-sm text-[#666666]">New alerts will appear here.</p>
          <Link
            href="/dashboard"
            className="mt-6 text-sm font-medium text-orange-500 hover:text-orange-400"
          >
            Back to Home
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((n) => {
            const { Icon, className: iconClass } = iconForType(n.type);
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => void onItemClick(n)}
                  className={cn(
                    "flex w-full gap-4 rounded-lg border px-4 py-4 text-left transition-colors",
                    n.read
                      ? "border-transparent bg-transparent opacity-70 hover:bg-bg-card/80"
                      : "border-l-2 border-orange-500 bg-bg-card hover:bg-bg-elevated",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#222222]",
                      iconClass,
                    )}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "font-semibold",
                        n.read ? "text-[#888888]" : "text-white",
                      )}
                    >
                      {n.title}
                    </p>
                    <p className="mt-1 text-sm text-[#888888]">{n.message}</p>
                    <p className="mt-2 flex items-center gap-1 text-xs text-[#666666]">
                      <Clock className="h-3.5 w-3.5" />
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                  {!n.read ? (
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-orange-500" aria-hidden />
                  ) : (
                    <span className="w-2.5 shrink-0" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
