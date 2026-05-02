"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Scale } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

type DisputeRow = {
  id: string;
  projectId: string;
  projectTitle: string;
  title: string;
  status: string;
  createdAt: string;
};

function statusBadge(status: string) {
  if (status === "open") return "border-red-500/40 bg-red-500/15 text-red-300";
  if (status === "under_review") return "border-amber-500/40 bg-amber-500/15 text-amber-200";
  if (status === "resolved") return "border-emerald-500/40 bg-emerald-500/15 text-emerald-300";
  return "border-border-default bg-bg-card text-text-secondary";
}

function statusLabel(status: string) {
  if (status === "under_review") return "Under Review";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function DisputesListPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DisputeRow[]>([]);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/disputes", { signal: ac.signal });
        if (!res.ok) return;
        const j = (await res.json()) as { data: DisputeRow[] };
        setRows(j.data ?? []);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Disputes</h1>
        <p className="mt-1 text-sm text-text-muted">Track and review disputes on your projects.</p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-bg-surface px-6 py-14">
          <EmptyState
            icon={Scale}
            title="No disputes"
            description="When you or your counterpart opens a dispute, it will appear here."
          />
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map((d) => (
            <li
              key={d.id}
              className="rounded-xl border border-border-subtle bg-bg-card p-5 transition-colors hover:border-orange-500/30"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-semibold text-text-primary">{d.title}</h2>
                  <p className="mt-1 text-sm text-text-secondary">{d.projectTitle}</p>
                  <p className="mt-2 text-xs text-text-muted">
                    Raised {new Date(d.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <span className={cn("shrink-0 rounded-full border px-3 py-1 text-xs", statusBadge(d.status))}>
                  {statusLabel(d.status)}
                </span>
              </div>
              <div className="mt-4">
                <Link
                  href={`/dashboard/disputes/${d.id}`}
                  className="inline-flex rounded-md border border-border-strong bg-bg-surface px-3 py-1.5 text-sm font-medium text-orange-500 hover:bg-bg-card hover:text-orange-400"
                >
                  View details
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
