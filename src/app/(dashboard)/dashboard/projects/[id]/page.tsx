"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { ChatSkeleton } from "@/components/ChatSkeleton";
import { ProjectDetailSkeleton } from "@/components/ProjectDetailSkeleton";
import { cn } from "@/lib/utils";

const ProjectChat = dynamic(
  () => import("@/components/ProjectChat").then((m) => ({ default: m.ProjectChat })),
  { ssr: false, loading: () => <ChatSkeleton /> },
);
const DisputeModal = dynamic(
  () => import("@/components/modals/DisputeModal").then((m) => ({ default: m.DisputeModal })),
  { ssr: false },
);

type MilestoneRow = {
  id: string;
  title: string;
  amount: number;
  dueDate?: string;
  status: string;
  escrowAmount?: number;
};

type ProjectPayload = {
  id: string;
  title: string;
  description?: string;
  budget: number;
  status: string;
  deadline?: string;
  clientId?: unknown;
  freelancerId?: unknown;
  clientDisplayName?: string;
  freelancerDisplayName?: string;
  milestones: MilestoneRow[];
};

function idStr(x: unknown): string {
  if (!x) return "";
  if (typeof x === "object" && x !== null && "_id" in x) return String((x as { _id: unknown })._id);
  return String(x);
}

function initials(name: string) {
  const p = name.split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase();
  return p[0].slice(0, 2).toUpperCase();
}

function statusBadge(status: string) {
  if (status === "completed") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (status === "active") return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  return "border-amber-500/30 bg-amber-500/10 text-amber-200";
}

function milestoneBadge(status: string) {
  const s = status.replace(/_/g, " ");
  if (status === "released") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (status === "submitted" || status === "approved") return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  if (status === "in_progress" || status === "funded") return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  return "border-border-subtle bg-bg-elevated text-text-secondary";
}

function formatMoney(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const router = useRouter();
  const { data: session } = useSession();

  const [project, setProject] = useState<ProjectPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDue, setNewDue] = useState("");
  const [adding, setAdding] = useState(false);

  const [submitNotes, setSubmitNotes] = useState<Record<string, string>>({});
  const [submitOpenId, setSubmitOpenId] = useState<string | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeNotice, setDisputeNotice] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}`, { signal });
      if (!res.ok) {
        if (!signal?.aborted) {
          setError("Could not load project.");
          setProject(null);
        }
        return;
      }
      const j = (await res.json()) as { data: ProjectPayload };
      if (signal?.aborted) return;
      setProject(j.data);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      if (!signal?.aborted) setError("Could not load project.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  const uid = session?.user?.id ?? "";
  const clientId = project ? idStr(project.clientId) : "";
  const freelancerId = project ? idStr(project.freelancerId) : "";
  const isClient = uid === clientId;
  const isFreelancer = uid === freelancerId;

  const stats = useMemo(() => {
    if (!project?.milestones?.length) {
      return { escrowHeld: 0, released: 0 };
    }
    let escrowHeld = 0;
    let released = 0;
    for (const m of project.milestones) {
      escrowHeld += m.escrowAmount ?? 0;
      if (m.status === "released") released += m.amount ?? 0;
    }
    return { escrowHeld, released };
  }, [project]);

  const runAction = async (path: string, body?: object) => {
    setBusyId(path);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) return;
      await load();
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const addMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDue || !project) return;
    const amount = Number(newAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setAdding(true);
    try {
      const res = await fetch("/api/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          title: newTitle.trim(),
          amount,
          dueDate: newDue,
        }),
      });
      if (!res.ok) return;
      setNewTitle("");
      setNewAmount("");
      setNewDue("");
      setShowAddMilestone(false);
      await load();
      router.refresh();
    } finally {
      setAdding(false);
    }
  };

  const submitWork = async (milestoneId: string) => {
    const notes = submitNotes[milestoneId]?.trim() ?? "";
    if (notes.length < 20) return;
    await runAction(`/api/milestones/${milestoneId}/submit`, { deliveryNotes: notes });
    setSubmitOpenId(null);
    setSubmitNotes((prev) => ({ ...prev, [milestoneId]: "" }));
  };

  if (!id) {
    return <p className="text-text-muted">Invalid project.</p>;
  }

  if (loading && !project) {
    return <ProjectDetailSkeleton />;
  }

  if (error || !project) {
    return (
      <div className="rounded-xl border border-border-subtle bg-bg-card p-8 text-center">
        <p className="text-text-secondary">{error ?? "Project not found."}</p>
        <Link href="/dashboard/projects" className="mt-4 inline-block text-orange-500 hover:text-orange-400">
          Back to projects
        </Link>
      </div>
    );
  }

  const statusLabel = project.status.charAt(0).toUpperCase() + project.status.slice(1);

  const canDispute = project.status === "active" || project.status === "completed";

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      {disputeNotice ? (
        <div
          className="fixed bottom-6 left-1/2 z-[110] max-w-md -translate-x-1/2 rounded-md border border-emerald-500/40 bg-bg-card px-4 py-2 text-center text-sm text-text-primary shadow-lg"
          role="status"
        >
          {disputeNotice}
        </div>
      ) : null}
      <div className="min-w-0 flex-1 space-y-8 lg:w-[60%] lg:flex-none lg:basis-[60%]">
        <header className="rounded-xl border border-border-subtle bg-bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="font-display text-2xl font-bold text-text-primary md:text-[24px]">{project.title}</h1>
            <div className="flex flex-wrap items-center gap-2">
              {canDispute ? (
                <button
                  type="button"
                  onClick={() => setDisputeOpen(true)}
                  className="rounded-lg border border-red-500 bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/30"
                >
                  Report dispute
                </button>
              ) : null}
              <span className={`rounded-full border px-3 py-1 text-xs ${statusBadge(project.status)}`}>
                {statusLabel}
              </span>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-xs font-semibold text-black">
                {initials(project.clientDisplayName ?? "Client")}
              </span>
              <span className="text-text-secondary">{project.clientDisplayName ?? "Client"}</span>
            </div>
            <span className="text-text-muted">↔</span>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-elevated text-xs font-semibold text-orange-300">
                {initials(project.freelancerDisplayName ?? "Freelancer")}
              </span>
              <span className="text-text-secondary">{project.freelancerDisplayName ?? "Freelancer"}</span>
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <article className="rounded-xl border border-orange-500/25 bg-bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-text-muted">Total budget</p>
            <p className="mt-2 font-display text-2xl text-orange-400">{formatMoney(project.budget)}</p>
          </article>
          <article className="rounded-xl border border-orange-500/25 bg-bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-text-muted">In escrow</p>
            <p className="mt-2 font-display text-2xl text-orange-300">{formatMoney(stats.escrowHeld)}</p>
          </article>
          <article className="rounded-xl border border-orange-500/25 bg-bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-text-muted">Released</p>
            <p className="mt-2 font-display text-2xl text-orange-500">{formatMoney(stats.released)}</p>
          </article>
        </section>

        <section className="rounded-xl border border-border-subtle bg-bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-text-primary">Milestones</h2>
            {isClient ? (
              <button
                type="button"
                onClick={() => setShowAddMilestone((v) => !v)}
                className="inline-flex items-center gap-2 rounded-md border border-orange-600 bg-orange-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-orange-400"
              >
                <Plus className="h-4 w-4" />
                Add Milestone
              </button>
            ) : null}
          </div>

          {showAddMilestone && isClient ? (
            <form onSubmit={(e) => void addMilestone(e)} className="mt-4 space-y-3 rounded-lg border border-border-subtle bg-bg-surface p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-1">
                  <label className="text-xs text-text-muted">Title</label>
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-border-default bg-bg-card px-2 text-sm text-text-primary"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-text-muted">Amount (USD)</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-border-default bg-bg-card px-2 text-sm text-text-primary"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-text-muted">Due date</label>
                  <input
                    type="date"
                    value={newDue}
                    onChange={(e) => setNewDue(e.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-border-default bg-bg-card px-2 text-sm text-text-primary"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddMilestone(false)}
                  className="rounded-md border border-border-strong px-3 py-1.5 text-xs text-text-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="rounded-md bg-orange-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-orange-400 disabled:opacity-50"
                >
                  {adding ? "Saving…" : "Create"}
                </button>
              </div>
            </form>
          ) : null}

          <div className="mt-6 space-y-5">
            {(project.milestones ?? []).length === 0 ? (
              <p className="text-sm text-text-muted">No milestones yet.</p>
            ) : (
              project.milestones.map((m, index) => (
                <div key={m.id} className="relative grid grid-cols-[20px_1fr] gap-4">
                  <div className="relative flex justify-center">
                    <span
                      className={cn(
                        "mt-1 h-3.5 w-3.5 rounded-full",
                        m.status === "released"
                          ? "bg-emerald-400"
                          : m.status === "pending"
                            ? "bg-amber-400"
                            : "bg-orange-400",
                      )}
                    />
                    {index < project.milestones.length - 1 && (
                      <span className="absolute top-5 h-[calc(100%+16px)] w-px bg-border-subtle" />
                    )}
                  </div>
                  <article className="relative rounded-lg border border-border-subtle bg-bg-surface p-4">
                    {(m.escrowAmount ?? 0) > 0 && m.status !== "released" ? (
                      <div className="pointer-events-none absolute right-3 top-3 -rotate-12 border border-orange-500/50 bg-orange-500/10 px-2 py-1 text-[10px] font-bold tracking-[0.2em] text-orange-400">
                        IN ESCROW
                      </div>
                    ) : null}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="font-semibold text-text-primary">{m.title}</h3>
                      <span className={`rounded-full border px-2.5 py-1 text-xs capitalize ${milestoneBadge(m.status)}`}>
                        {m.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                      <p className="text-orange-400">{formatMoney(m.amount)}</p>
                      {m.dueDate ? (
                        <p className="text-text-secondary">
                          Due: {new Date(m.dueDate).toLocaleDateString()}
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {isClient && m.status === "pending" ? (
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => void runAction(`/api/milestones/${m.id}/fund`)}
                          className="rounded-md border border-orange-600 bg-orange-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-orange-400 disabled:opacity-50"
                        >
                          {busyId === `/api/milestones/${m.id}/fund` ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Fund milestone"
                          )}
                        </button>
                      ) : null}

                      {isFreelancer && m.status === "funded" ? (
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => void runAction(`/api/milestones/${m.id}/in-progress`)}
                          className="rounded-md border border-orange-600 bg-orange-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-orange-400 disabled:opacity-50"
                        >
                          Start work
                        </button>
                      ) : null}

                      {isFreelancer && m.status === "in_progress" ? (
                        <button
                          type="button"
                          onClick={() => setSubmitOpenId(submitOpenId === m.id ? null : m.id)}
                          className="rounded-md border border-border-strong px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
                        >
                          Submit work
                        </button>
                      ) : null}

                      {isClient && m.status === "submitted" ? (
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => void runAction(`/api/milestones/${m.id}/approve`)}
                          className="rounded-md border border-orange-600 bg-orange-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-orange-400 disabled:opacity-50"
                        >
                          Approve & release
                        </button>
                      ) : null}
                    </div>

                    {submitOpenId === m.id && isFreelancer && m.status === "in_progress" ? (
                      <div className="mt-4 space-y-2 rounded-md border border-border-default bg-bg-card p-3">
                        <label className="text-xs text-text-muted">Delivery notes (min 20 characters)</label>
                        <textarea
                          value={submitNotes[m.id] ?? ""}
                          onChange={(e) =>
                            setSubmitNotes((prev) => ({ ...prev, [m.id]: e.target.value }))
                          }
                          rows={4}
                          className="w-full rounded-md border border-border-default bg-bg-surface px-2 py-2 text-sm text-text-primary"
                          placeholder="Describe what was delivered…"
                        />
                        <button
                          type="button"
                          disabled={(submitNotes[m.id]?.trim().length ?? 0) < 20 || busyId !== null}
                          onClick={() => void submitWork(m.id)}
                          className="rounded-md bg-orange-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-orange-400 disabled:opacity-50"
                        >
                          Submit for review
                        </button>
                      </div>
                    ) : null}
                  </article>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="w-full shrink-0 lg:sticky lg:top-6 lg:w-[40%] lg:basis-[40%] lg:self-start">
        <ProjectChat projectId={id} />
      </div>

      <DisputeModal
        open={disputeOpen}
        onClose={() => setDisputeOpen(false)}
        projectId={project.id}
        projectTitle={project.title}
        onRaised={(msg) => {
          setDisputeNotice(msg);
          window.setTimeout(() => setDisputeNotice(null), 5000);
        }}
      />
    </div>
  );
}
