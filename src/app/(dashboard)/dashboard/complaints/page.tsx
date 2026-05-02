"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Plus, Sparkles } from "lucide-react";
import { CreateComplaintModal } from "@/components/complaints/CreateComplaintModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import type { ComplaintType } from "@/models/Dispute";

type Row = {
  id: string;
  projectId: string;
  projectTitle: string;
  title: string;
  type?: ComplaintType;
  status: string;
  createdAt: string;
  aiUnlockAt?: string;
  aiAgentReady?: boolean;
  hasAiSummary?: boolean;
};

const TYPE_STYLES: Record<ComplaintType, string> = {
  payment_issue: "border-red-500/30 bg-red-500/10 text-red-300",
  fraud: "border-red-800/40 bg-red-950/40 text-red-200",
  milestone_dispute: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  chat_abuse: "border-yellow-500/30 bg-yellow-500/10 text-yellow-200",
  other: "border-border-default bg-bg-surface text-text-secondary",
};

const TYPE_LABEL: Record<ComplaintType, string> = {
  payment_issue: "Payment",
  fraud: "Fraud",
  milestone_dispute: "Milestone",
  chat_abuse: "Chat abuse",
  other: "Other",
};

function statusDot(status: string) {
  if (status === "open") return "bg-red-500";
  if (status === "under_review") return "bg-yellow-500";
  if (status === "resolved") return "bg-emerald-500";
  return "bg-text-muted";
}

function statusLabel(status: string) {
  if (status === "under_review") return "Under Review";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function ComplaintsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/disputes", { cache: "no-store" });
      if (!res.ok) return;
      const j = (await res.json()) as { data: Row[] };
      setRows(j.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
            Complaints &amp; Disputes
          </h1>
          <p className="mt-1 text-sm text-[#666]">Track complaints filed on your projects.</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-black transition-all duration-150 hover:bg-orange-600 active:scale-[0.97]"
        >
          <Plus className="h-4 w-4" />
          New Complaint
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="dash-card rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] px-6 py-14 transition-all duration-200">
          <EmptyState
            icon={AlertTriangle}
            title="No complaints yet"
            description="When you file a complaint, it will appear here with status updates."
          />
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map((d) => (
            <li key={d.id}>
              <Link
                href={`/dashboard/disputes/${d.id}`}
                className="dash-card group flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-5 transition-all duration-200 hover:border-[#333] md:p-6"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        TYPE_STYLES[(d.type ?? "other") as keyof typeof TYPE_STYLES] ?? TYPE_STYLES.other,
                      )}
                    >
                      {TYPE_LABEL[(d.type ?? "other") as keyof typeof TYPE_LABEL] ?? d.type}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
                      <span className={cn("h-2 w-2 rounded-full", statusDot(d.status))} />
                      {statusLabel(d.status)}
                    </span>
                    {d.hasAiSummary ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                        <Sparkles className="h-3 w-3" />
                        AI analysis saved
                      </span>
                    ) : d.aiAgentReady ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-200">
                        <Sparkles className="h-3 w-3" />
                        AI ready — open case
                      </span>
                    ) : d.aiUnlockAt ? (
                      <span className="rounded-full border border-border-subtle bg-bg-card px-2 py-0.5 text-[10px] text-text-muted">
                        AI agent: unlocks{" "}
                        {new Date(d.aiUnlockAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-2 font-display text-lg font-semibold text-text-primary group-hover:text-orange-400">
                    {d.title}
                  </h2>
                  <p className="mt-1 text-sm text-text-secondary">{d.projectTitle}</p>
                  <p className="mt-2 text-xs text-text-muted">
                    {new Date(d.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <CreateComplaintModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmitted={() => void load()} />
    </div>
  );
}
