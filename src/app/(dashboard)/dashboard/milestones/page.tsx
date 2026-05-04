"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { FundMilestoneModal } from "@/components/modals/FundMilestoneModal";
import { SubmitWorkModal } from "@/components/modals/SubmitWorkModal";
import { CountdownTimer } from "@/components/ui/CountdownTimer";

type MilestoneStatus =
  | "pending"
  | "funded"
  | "in_progress"
  | "submitted"
  | "approved"
  | "released";

type ApiMilestone = {
  id: string;
  title: string;
  amount: number;
  status: MilestoneStatus;
  escrowAmount: number;
  dueDate?: string;
  autoReleaseAt?: string;
  project?: {
    _id?: unknown;
    title?: string;
    clientId?: unknown;
    freelancerId?: unknown;
  } | null;
};

const tabs = ["All", "Pending", "Funded", "In Progress", "Submitted", "Released"] as const;
type Tab = (typeof tabs)[number];

function idStr(v: unknown) {
  if (v == null) return "";
  if (typeof v === "object" && v !== null && "_id" in v && (v as { _id: unknown })._id != null) {
    return String((v as { _id: unknown })._id);
  }
  return String(v);
}

function statusBadgeClass(s: MilestoneStatus) {
  switch (s) {
    case "released":
      return "border-green-500/30 bg-green-500/10 text-green-300";
    case "submitted":
    case "approved":
      return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
    case "funded":
    case "in_progress":
      return "border-orange-500/30 bg-orange-500/10 text-orange-300";
    default:
      return "border-border-strong bg-bg-elevated text-text-secondary";
  }
}

function tabToFilter(tab: Tab): MilestoneStatus | "all" {
  if (tab === "All") return "all";
  const map: Record<Exclude<Tab, "All">, MilestoneStatus> = {
    Pending: "pending",
    Funded: "funded",
    "In Progress": "in_progress",
    Submitted: "submitted",
    Released: "released",
  };
  return map[tab as Exclude<Tab, "All">];
}

/** Client-facing description of where escrow / payout stands. */
function paymentStatusLabel(m: ApiMilestone): string {
  const escrow = m.escrowAmount ?? 0;
  switch (m.status) {
    case "pending":
      return "Not funded — fund the milestone to hold payment in escrow.";
    case "funded":
      return escrow > 0
        ? "Escrow active — payment held until you release or the freelancer completes work."
        : "Funded — no escrow balance.";
    case "in_progress":
      return escrow > 0
        ? "Escrow active — freelancer is working; you can release anytime or wait for submission."
        : "In progress.";
    case "submitted":
      return escrow > 0
        ? "Awaiting you — review work and release, or release immediately."
        : "Submitted.";
    case "approved":
      return "Approved — processing release.";
    case "released":
      return "Paid out — escrow released to the freelancer.";
    default:
      return "—";
  }
}

export default function EscrowMilestonesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const myId = session?.user?.id ?? "";

  const [rows, setRows] = useState<ApiMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("All");
  const [toast, setToast] = useState<string | null>(null);

  const [fundOpen, setFundOpen] = useState(false);
  const [fundTarget, setFundTarget] = useState<ApiMilestone | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitTarget, setSubmitTarget] = useState<ApiMilestone | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/milestones");
      if (!res.ok) return;
      const j = (await res.json()) as { data: ApiMilestone[] };
      setRows(j.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const f = tabToFilter(tab);
    if (f === "all") return rows;
    return rows.filter((r) => r.status === f);
  }, [rows, tab]);

  const isClient = (m: ApiMilestone) => idStr(m.project?.clientId) === myId;
  const isFreelancer = (m: ApiMilestone) => idStr(m.project?.freelancerId) === myId;

  const markInProgress = async (m: ApiMilestone) => {
    const res = await fetch(`/api/milestones/${m.id}/in-progress`, { method: "POST" });
    if (!res.ok) {
      showToast("Could not update milestone.");
      return;
    }
    showToast("Marked in progress.");
    void load();
    router.refresh();
  };

  const approveRelease = async (m: ApiMilestone, instant: boolean) => {
    const res = await fetch(`/api/milestones/${m.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instant }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      showToast(j.error ?? "Release failed.");
      return;
    }
    showToast(instant ? "Payment released immediately." : "Funds released to freelancer.");
    void load();
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-md border border-orange-500/40 bg-bg-card px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      ) : null}

      <h1 className="font-display text-3xl font-bold text-text-primary">Escrow Milestones</h1>

      <div className="flex flex-wrap gap-3 border-b border-border-subtle pb-2">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              tab === t
                ? "bg-orange-500/15 text-orange-400"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {loading &&
          [1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl border border-border-subtle bg-bg-card" />
          ))}

        {!loading && filtered.length === 0 && (
          <p className="text-center text-sm text-text-muted">No milestones in this view.</p>
        )}

        {!loading &&
          filtered.map((m) => {
            const projectTitle =
              m.project && typeof m.project === "object" && "title" in m.project
                ? String((m.project as { title?: string }).title || "Project")
                : "Project";
            const due = m.dueDate
              ? new Date(m.dueDate).toLocaleDateString(undefined, { dateStyle: "medium" })
              : "—";
            const inEscrow =
              (m.status === "funded" || m.status === "in_progress" || m.status === "submitted") &&
              (m.escrowAmount ?? 0) > 0;

            return (
              <article
                key={m.id}
                className="rounded-xl border border-border-subtle bg-bg-card p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-display text-base font-semibold text-white">{m.title}</h2>
                    <p className="mt-1 text-sm text-text-muted">{projectTitle}</p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs capitalize ${statusBadgeClass(
                      m.status,
                    )}`}
                  >
                    {m.status.replace("_", " ")}
                  </span>
                </div>

                <p className="mt-4 font-display text-3xl text-orange-400">
                  ${m.amount.toLocaleString("en-US")}
                </p>
                <p className="mt-2 text-sm text-text-muted">Due {due}</p>

                {inEscrow ? (
                  <p className="mt-3 flex items-center gap-2 text-sm text-text-secondary">
                    <Lock className="h-4 w-4 text-orange-400" />
                    In Escrow:{" "}
                    <span className="font-medium text-orange-400">
                      ${(m.escrowAmount ?? 0).toLocaleString("en-US")}
                    </span>
                  </p>
                ) : null}

                {isClient(m) ? (
                  <div className="mt-3 rounded-lg border border-border-subtle bg-bg-elevated/60 px-3 py-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Payment status</p>
                    <p className="mt-1 text-sm text-text-secondary">{paymentStatusLabel(m)}</p>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {m.status === "pending" && isClient(m) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFundTarget(m);
                        setFundOpen(true);
                      }}
                      className="rounded-md border border-orange-600 bg-orange-500 px-4 py-2 text-sm font-semibold text-black hover:bg-orange-400"
                    >
                      Fund Milestone
                    </button>
                  )}

                  {m.status === "funded" && isFreelancer(m) && (
                    <button
                      type="button"
                      onClick={() => void markInProgress(m)}
                      className="rounded-md border border-orange-500/50 bg-transparent px-4 py-2 text-sm font-medium text-orange-400 hover:bg-orange-500/10"
                    >
                      Mark In Progress
                    </button>
                  )}

                  {m.status === "in_progress" && isFreelancer(m) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSubmitTarget(m);
                        setSubmitOpen(true);
                      }}
                      className="rounded-md border border-orange-600 bg-orange-500 px-4 py-2 text-sm font-semibold text-black hover:bg-orange-400"
                    >
                      Submit Work
                    </button>
                  )}

                  {isClient(m) &&
                    (m.status === "funded" || m.status === "in_progress") &&
                    (m.escrowAmount ?? 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => void approveRelease(m, true)}
                        className="rounded-md border border-emerald-500/50 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/25"
                      >
                        Release payment now
                      </button>
                    )}

                  {m.status === "submitted" && isClient(m) && (
                    <>
                      <button
                        type="button"
                        onClick={() => void approveRelease(m, false)}
                        className="rounded-md border border-green-500/40 bg-green-500/15 px-4 py-2 text-sm font-semibold text-green-300 hover:bg-green-500/25"
                      >
                        Approve &amp; release
                      </button>
                      {m.autoReleaseAt ? (
                        <div className="w-full text-sm">
                          <CountdownTimer targetDate={new Date(m.autoReleaseAt)} />
                        </div>
                      ) : null}
                    </>
                  )}

                  {m.status === "released" && (
                    <Link
                      href="/dashboard/transactions"
                      className="rounded-md border border-border-strong px-4 py-2 text-sm text-text-secondary hover:border-orange-500/40 hover:text-text-primary"
                    >
                      View Receipt
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
      </div>

      <FundMilestoneModal
        open={Boolean(fundOpen && fundTarget)}
        title={fundTarget?.title ?? ""}
        amount={fundTarget?.amount ?? 0}
        milestoneId={fundTarget?.id ?? ""}
        onClose={() => {
          setFundOpen(false);
          setFundTarget(null);
        }}
        onSuccess={() => {
          void load();
          router.refresh();
        }}
        onNotify={showToast}
      />

      <SubmitWorkModal
        open={Boolean(submitOpen && submitTarget)}
        milestoneId={submitTarget?.id ?? ""}
        title={submitTarget?.title ?? ""}
        onClose={() => {
          setSubmitOpen(false);
          setSubmitTarget(null);
        }}
        onSuccess={() => {
          void load();
          router.refresh();
        }}
        onNotify={showToast}
      />
    </div>
  );
}
