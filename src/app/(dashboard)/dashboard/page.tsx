"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  Copy,
  CreditCard,
  FolderKanban,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonStat } from "@/components/ui/Skeleton";

const CreateProjectModal = dynamic(
  () => import("@/components/modals/CreateProjectModal").then((m) => ({ default: m.CreateProjectModal })),
  { ssr: false },
);

type TxRow = {
  id: string;
  amount: number;
  type: string;
  status: string;
  date: string;
  splitCode: string;
};

type PreviewProject = {
  id: string;
  title: string;
  budget: number;
  completedMilestones: number;
  totalMilestones: number;
  freelancerLabel: string;
};

function formatMoney(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatMoneyPlain(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function mapTxTypeLabel(type: string) {
  if (type === "split_payment") return "Split payment";
  if (type === "escrow_funding") return "Escrow funding";
  if (type === "escrow_release") return "Escrow release";
  if (type === "merchant_payout") return "Merchant payout";
  if (type === "charge_reversal") return "Card rollback";
  if (type === "withdrawal") return "Withdrawal";
  if (type === "refund") return "Refund";
  if (type === "failed_payment") return "Failed payment";
  return type.replace(/_/g, " ");
}

function TxIcon({ type }: { type: string }) {
  if (type === "escrow_funding" || type === "escrow_release") {
    return <ShieldCheck className="h-4 w-4 text-orange-400" />;
  }
  if (
    type === "split_payment" ||
    type === "merchant_payout" ||
    type === "charge_reversal" ||
    type === "refund" ||
    type === "failed_payment"
  ) {
    return <CreditCard className="h-4 w-4 text-orange-400" />;
  }
  return <ArrowLeftRight className="h-4 w-4 text-orange-400" />;
}

function statusBadge(status: string) {
  if (status === "completed") return "border-green-500/30 bg-green-500/10 text-green-300";
  if (status === "failed") return "border-red-500/30 bg-red-500/10 text-red-300";
  return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
}

function useTimeGreeting() {
  const [greeting, setGreeting] = useState("Hello");
  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting("Good morning");
    else if (h < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);
  return greeting;
}

export default function DashboardHomePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const greeting = useTimeGreeting();
  const name = session?.user?.name ?? "there";
  const splitCode = session?.user?.splitCode ?? "";

  const [statsLoading, setStatsLoading] = useState(true);
  const [activeProjects, setActiveProjects] = useState<number | null>(null);
  const [escrowTotal, setEscrowTotal] = useState<number | null>(null);
  const [pendingMilestones, setPendingMilestones] = useState<number | null>(null);
  const [totalTransacted, setTotalTransacted] = useState<number | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [fundedSplitPayVolume, setFundedSplitPayVolume] = useState<number | null>(null);

  const [txLoading, setTxLoading] = useState(true);
  const [transactions, setTransactions] = useState<TxRow[]>([]);

  const [projectsLoading, setProjectsLoading] = useState(true);
  const [previewProjects, setPreviewProjects] = useState<PreviewProject[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [homeToast, setHomeToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadStats() {
      setStatsLoading(true);
      try {
        const rDash = await fetch("/api/dashboard-stats", { cache: "no-store" });
        const [rPending] = await Promise.all([
          fetch("/api/milestones?status=pending&countOnly=true", { cache: "no-store" }),
        ]);
        if (cancelled) return;
        const jDash = rDash.ok
          ? await rDash.json()
          : {
              data: {
                activeProjects: 0,
                escrowTotal: 0,
                totalTransacted: 0,
                walletBalance: 0,
                fundedSplitPayVolume: 0,
              },
            };
        const jPending = rPending.ok ? await rPending.json() : { meta: { total: 0 } };
        const d = jDash.data ?? {};
        setActiveProjects(d.activeProjects ?? 0);
        setEscrowTotal(d.escrowTotal ?? 0);
        setPendingMilestones(jPending.meta?.total ?? 0);
        setTotalTransacted(d.totalTransacted ?? 0);
        setWalletBalance(d.walletBalance ?? 0);
        setFundedSplitPayVolume(d.fundedSplitPayVolume ?? 0);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    }
    void loadStats();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadTx() {
      setTxLoading(true);
      try {
        const res = await fetch("/api/transactions?limit=5", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const j = (await res.json()) as { data: TxRow[] };
        setTransactions(j.data ?? []);
      } finally {
        if (!cancelled) setTxLoading(false);
      }
    }
    void loadTx();
    return () => {
      cancelled = true;
    };
  }, []);

  /** After store checkout, refresh recent activity + stats without reloading the page. */
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void (async () => {
        try {
          const [rDash, rTx] = await Promise.all([
            fetch("/api/dashboard-stats", { cache: "no-store" }),
            fetch("/api/transactions?limit=5", { cache: "no-store" }),
          ]);
          if (rTx.ok) {
            const j = (await rTx.json()) as { data: TxRow[] };
            setTransactions(j.data ?? []);
          }
          if (rDash.ok) {
            const jDash = (await rDash.json()) as {
              data?: {
                activeProjects?: number;
                escrowTotal?: number;
                totalTransacted?: number;
                walletBalance?: number;
                fundedSplitPayVolume?: number;
              };
            };
            const d = jDash.data ?? {};
            setActiveProjects(d.activeProjects ?? 0);
            setEscrowTotal(d.escrowTotal ?? 0);
            setTotalTransacted(d.totalTransacted ?? 0);
            setWalletBalance(d.walletBalance ?? 0);
            setFundedSplitPayVolume(d.fundedSplitPayVolume ?? 0);
          }
        } catch {
          /* ignore */
        }
      })();
    }, 10_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadProjects() {
      setProjectsLoading(true);
      try {
        const res = await fetch("/api/projects?limit=3", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const j = (await res.json()) as {
          data: Array<{
            id: string;
            title: string;
            budget: number;
            milestones?: { status?: string }[];
            freelancerDisplayName?: string;
          }>;
        };
        const rows = (j.data ?? []).map((p) => {
          const ms = p.milestones ?? [];
          const completed = ms.filter((m) => m.status === "released" || m.status === "approved").length;
          return {
            id: p.id,
            title: p.title,
            budget: p.budget,
            completedMilestones: completed,
            totalMilestones: Math.max(ms.length, 1),
            freelancerLabel: p.freelancerDisplayName?.trim() || "—",
          };
        });
        setPreviewProjects(rows);
      } finally {
        if (!cancelled) setProjectsLoading(false);
      }
    }
    void loadProjects();
    return () => {
      cancelled = true;
    };
  }, []);

  const splitDisplay = splitCode ? `#${splitCode}` : "—";

  const copySplitCode = async () => {
    if (!splitCode) return;
    await navigator.clipboard.writeText(splitCode);
  };

  const refreshDashboard = async () => {
    const [rDash, rPending, rTx, rProj] = await Promise.all([
      fetch("/api/dashboard-stats", { cache: "no-store" }),
      fetch("/api/milestones?status=pending&countOnly=true", { cache: "no-store" }),
      fetch("/api/transactions?limit=5", { cache: "no-store" }),
      fetch("/api/projects?limit=3", { cache: "no-store" }),
    ]);
    const jDash = rDash.ok
      ? await rDash.json()
      : {
          data: {
            activeProjects: 0,
            escrowTotal: 0,
            totalTransacted: 0,
            walletBalance: 0,
            fundedSplitPayVolume: 0,
          },
        };
    const jPending = rPending.ok ? await rPending.json() : { meta: { total: 0 } };
    const d = jDash.data ?? {};
    setActiveProjects(d.activeProjects ?? 0);
    setEscrowTotal(d.escrowTotal ?? 0);
    setPendingMilestones(jPending.meta?.total ?? 0);
    setTotalTransacted(d.totalTransacted ?? 0);
    setWalletBalance(d.walletBalance ?? 0);
    setFundedSplitPayVolume(d.fundedSplitPayVolume ?? 0);
    if (rTx.ok) {
      const jTx = (await rTx.json()) as { data: TxRow[] };
      setTransactions(jTx.data ?? []);
    }
    if (rProj.ok) {
      const j = (await rProj.json()) as {
        data: Array<{
          id: string;
          title: string;
          budget: number;
          milestones?: { status?: string }[];
          freelancerDisplayName?: string;
        }>;
      };
      setPreviewProjects(
        (j.data ?? []).map((p) => {
          const ms = p.milestones ?? [];
          const completed = ms.filter((m) => m.status === "released" || m.status === "approved").length;
          return {
            id: p.id,
            title: p.title,
            budget: p.budget,
            completedMilestones: completed,
            totalMilestones: Math.max(ms.length, 1),
            freelancerLabel: p.freelancerDisplayName?.trim() || "—",
          };
        }),
      );
    }
  };

  const showHomeToast = (msg: string) => {
    setHomeToast(msg);
    window.setTimeout(() => setHomeToast(null), 4000);
  };

  return (
    <div className="space-y-10">
      {homeToast ? (
        <div
          className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-md border border-orange-500/40 bg-bg-card px-4 py-2 text-sm text-text-primary shadow-lg"
          role="status"
        >
          {homeToast}
        </div>
      ) : null}

      {/* Section A */}
      <section className="dash-card-interactive flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
        <div>
          <h1 className="dash-page-title text-2xl md:text-[26px]">
            {greeting}, {name.split(" ")[0]}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-text-muted">Split Code:</span>
            <span className="font-mono text-orange-500">{splitDisplay}</span>
            <button
              type="button"
              onClick={() => void copySplitCode()}
              disabled={!splitCode}
              className="rounded-md border border-border-subtle p-1.5 text-text-muted transition-colors hover:text-text-primary disabled:opacity-40"
              aria-label="Copy split code"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="dash-btn-primary inline-flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </section>

      {/* Section B */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statsLoading ? (
          <>
            <SkeletonStat />
            <SkeletonStat />
            <SkeletonStat />
            <SkeletonStat />
          </>
        ) : (
          <>
            <article className="dash-stat-card p-5 md:p-6">
              <p className="dash-table-head font-medium">Wallet balance</p>
              <p className="mt-2 font-display text-[28px] leading-none text-text-primary">
                {formatMoney(walletBalance ?? 0)}
              </p>
              <p className="mt-1 text-xs text-text-muted">Available on your virtual card</p>
            </article>
            <article className="dash-stat-card p-5 md:p-6">
              <p className="dash-table-head font-medium">SplitPay store (funded)</p>
              <p className="mt-2 font-display text-[28px] leading-none text-text-primary">
                {formatMoney(fundedSplitPayVolume ?? 0)}
              </p>
              <p className="mt-1 text-xs text-text-muted">Completed split checkouts</p>
            </article>
            <article className="dash-stat-card p-5 md:p-6">
              <p className="dash-table-head font-medium">Escrow held</p>
              <p className="mt-2 font-display text-[28px] leading-none text-text-primary">
                {formatMoneyPlain(escrowTotal ?? 0)}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {pendingMilestones ?? 0} milestone{(pendingMilestones ?? 0) === 1 ? "" : "s"} pending
              </p>
            </article>
            <article className="dash-stat-card p-5 md:p-6">
              <p className="dash-table-head font-medium">Active projects</p>
              <p className="mt-2 font-display text-[28px] leading-none text-text-primary">
                {activeProjects ?? 0}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                All volume: {formatMoney(totalTransacted ?? 0)}
              </p>
            </article>
          </>
        )}
      </section>

      {/* Section C */}
      <section className="rounded-xl border border-border-subtle bg-bg-surface p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-text-primary">Recent Activity</h2>
          <Link href="/dashboard/transactions" className="text-sm font-medium text-orange-500 hover:text-orange-400">
            View All
          </Link>
        </div>
        {txLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="No transactions yet"
            description="Completed payments and milestone movements will show up here."
          />
        ) : (
          <ul className="divide-y divide-[#2A2A2A]">
            {transactions.map((tx) => (
              <li key={tx.id} className="flex flex-wrap items-center gap-3 py-4 first:pt-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-card">
                  <TxIcon type={tx.type} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary">{mapTxTypeLabel(tx.type)}</p>
                  <p className="text-xs text-text-muted">
                    {new Date(tx.date).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <span className="font-display text-lg text-orange-500">{formatMoney(tx.amount)}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs capitalize ${statusBadge(tx.status)}`}
                >
                  {tx.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Section D */}
      <section>
        <h2 className="mb-4 font-display text-xl font-semibold text-text-primary">Active Projects</h2>
        {projectsLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-44 w-full rounded-xl" />
            ))}
          </div>
        ) : previewProjects.length === 0 ? (
          <div className="rounded-xl border border-border-subtle bg-bg-surface px-6 py-14">
            <EmptyState
              icon={FolderKanban}
              title="No projects yet"
              description="Create a project to start milestones and escrow."
              action={{ label: "Create your first project", onClick: () => setShowModal(true) }}
            />
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible md:pb-0">
            {previewProjects.map((p) => {
              const progress = Math.round((p.completedMilestones / p.totalMilestones) * 100);
              return (
                <article
                  key={p.id}
                  className="min-w-[260px] shrink-0 rounded-xl border border-border-subtle bg-bg-card p-5 md:min-w-0"
                >
                  <h3 className="font-display text-lg font-semibold text-text-primary">{p.title}</h3>
                  <p className="mt-2 text-xs text-text-muted">
                    Freelancer: <span className="text-text-secondary">{p.freelancerLabel}</span>
                  </p>
                  <p className="mt-4 font-display text-2xl text-orange-500">{formatMoneyPlain(p.budget)}</p>
                  <div className="mt-4">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#222222]">
                      <div className="h-full bg-orange-500" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-text-muted">
                      {p.completedMilestones} of {p.totalMilestones} milestones
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/projects/${p.id}`}
                    className="mt-4 inline-block text-sm font-medium text-orange-500 hover:text-orange-400"
                  >
                    View project
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <CreateProjectModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={() => {
          void refreshDashboard();
          router.refresh();
        }}
        onNotify={showHomeToast}
      />
    </div>
  );
}
