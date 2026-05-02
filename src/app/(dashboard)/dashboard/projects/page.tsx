"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FolderKanban, Plus } from "lucide-react";
import { CreateProjectModal } from "@/components/modals/CreateProjectModal";

type ProjectStatus = "Active" | "Completed" | "Pending";

type Project = {
  id: string;
  title: string;
  status: ProjectStatus;
  clientName: string;
  freelancerName: string;
  clientId: string;
  freelancerId: string;
  budget: number;
  completedMilestones: number;
  totalMilestones: number;
  deadlineLabel: string;
};

const roleTabs = ["All", "As Client", "As Freelancer"] as const;
type RoleTab = (typeof roleTabs)[number];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function statusBadgeClass(status: ProjectStatus) {
  if (status === "Completed") return "border-green-500/30 bg-green-500/10 text-green-300";
  if (status === "Active") return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
}

type ApiProject = {
  id: string;
  title: string;
  budget: number;
  status: string;
  clientId: string;
  freelancerId?: string;
  clientDisplayName?: string;
  freelancerDisplayName?: string;
  deadline?: string;
  milestones?: { status?: string }[];
};

function mapApiProject(p: ApiProject, myUserId: string | undefined): Project {
  const ms = p.milestones ?? [];
  const completed = ms.filter((m) => m.status === "released" || m.status === "approved").length;
  const statusLower = (p.status ?? "pending").toLowerCase();
  const status: ProjectStatus =
    statusLower === "active" ? "Active" : statusLower === "completed" ? "Completed" : "Pending";
  const clientName =
    p.clientDisplayName?.trim() || (p.clientId === myUserId ? "You" : "Client");
  const freelancerName =
    p.freelancerDisplayName?.trim() || (p.freelancerId === myUserId ? "You" : "Freelancer");
  let deadlineLabel = "—";
  if (p.deadline) {
    const d = new Date(p.deadline);
    if (!Number.isNaN(d.getTime())) {
      deadlineLabel = d.toLocaleDateString(undefined, { dateStyle: "medium" });
    }
  }
  return {
    id: p.id,
    title: p.title,
    status,
    clientName,
    freelancerName,
    clientId: p.clientId,
    freelancerId: p.freelancerId ?? "",
    budget: p.budget,
    completedMilestones: completed,
    totalMilestones: Math.max(ms.length, 1),
    deadlineLabel,
  };
}

export default function ProjectsListPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<RoleTab>("All");
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const myId = session?.user?.id;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/projects?limit=100");
      if (!res.ok) return;
      const j = (await res.json()) as { data: ApiProject[] };
      setProjects((j.data ?? []).map((p) => mapApiProject(p, myId)));
    } finally {
      setLoading(false);
    }
  }, [myId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!myId) return projects;
    if (activeTab === "As Client") return projects.filter((p) => p.clientId === myId);
    if (activeTab === "As Freelancer") return projects.filter((p) => p.freelancerId === myId);
    return projects;
  }, [projects, activeTab, myId]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4000);
  };

  return (
    <div className="space-y-6">
      {toast ? (
        <div
          className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-md border border-orange-500/40 bg-bg-card px-4 py-2 text-sm text-text-primary shadow-lg"
          role="status"
        >
          {toast}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-3xl font-bold text-text-primary">Projects</h1>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-orange-600 bg-orange-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-orange-400"
        >
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-b border-border-subtle">
        {roleTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`border-b-2 pb-2 text-sm transition-colors ${
              activeTab === tab
                ? "border-orange-500 text-orange-400"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        {loading &&
          [1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-56 rounded-lg border border-border-subtle bg-bg-card animate-pulse"
            />
          ))}

        {!loading &&
          filtered.map((project) => {
            const progress = Math.round((project.completedMilestones / project.totalMilestones) * 100);
            return (
              <Link
                key={project.id}
                href={`/dashboard/projects/${project.id}`}
                className="block rounded-lg border border-border-subtle bg-bg-card p-5 transition-colors hover:border-orange-500/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-[18px] font-semibold text-text-primary">
                    {project.title}
                  </h2>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${statusBadgeClass(
                      project.status,
                    )}`}
                  >
                    {project.status}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-xs font-semibold text-black">
                      {initials(project.clientName)}
                    </span>
                    <div>
                      <p className="text-xs text-text-muted">Client</p>
                      <p className="text-sm text-text-secondary">{project.clientName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-elevated text-xs font-semibold text-orange-300">
                      {initials(project.freelancerName)}
                    </span>
                    <div>
                      <p className="text-xs text-text-muted">Freelancer</p>
                      <p className="text-sm text-text-secondary">{project.freelancerName}</p>
                    </div>
                  </div>
                </div>

                <p className="mt-4 font-display text-3xl text-orange-400">
                  ${project.budget.toLocaleString("en-US")}
                </p>
                <p className="mt-1 text-xs text-text-muted">Deadline: {project.deadlineLabel}</p>

                <div className="mt-4">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-bg-elevated">
                    <div className="h-full bg-orange-500" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-text-secondary">
                    {project.completedMilestones} of {project.totalMilestones} milestones complete
                  </p>
                </div>
              </Link>
            );
          })}

        {!loading && filtered.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center rounded-lg border border-border-subtle bg-bg-card p-10 text-center">
            <FolderKanban className="h-16 w-16 text-orange-500/40" strokeWidth={1.25} />
            <p className="mt-4 font-display text-lg text-text-primary">No projects yet</p>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="mt-4 rounded-md border border-orange-600 bg-orange-500 px-4 py-2 text-sm font-semibold text-black hover:bg-orange-400"
            >
              New Project
            </button>
          </div>
        )}
      </section>

      <CreateProjectModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={() => {
          void load();
          router.refresh();
        }}
        onNotify={showToast}
      />
    </div>
  );
}
