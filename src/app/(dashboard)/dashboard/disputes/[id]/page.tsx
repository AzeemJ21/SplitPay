"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, FileImage, FileText, Loader2, Sparkles } from "lucide-react";
import Image from "next/image";
import { Skeleton } from "@/components/ui/Skeleton";
import { extractRiskScore, parseAiSections, riskSeverityClass } from "@/lib/parse-ai-summary";
import { cn } from "@/lib/utils";

type EvidenceItem = { url: string; name: string; type: string };
type Shot = { url: string; name: string };
type Att = { url: string; name: string; mimeType: string };

type DisputeDetail = {
  id: string;
  projectId: string;
  projectTitle: string;
  raisedByName: string;
  title: string;
  description: string;
  type?: string;
  evidence: EvidenceItem[];
  screenshots?: Shot[];
  attachments?: Att[];
  status: string;
  resolution?: string;
  aiSummary?: string;
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

export default function DisputeDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [localSummary, setLocalSummary] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!id) return;
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/disputes/${id}`, { signal: ac.signal });
        if (!res.ok) {
          setError("Could not load dispute.");
          setDispute(null);
          return;
        }
        const j = (await res.json()) as { data: DisputeDetail };
        setDispute(j.data);
        setLocalSummary(j.data.aiSummary ?? null);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError("Could not load dispute.");
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [id]);

  const summaryText = localSummary ?? dispute?.aiSummary ?? "";
  const aiSections = useMemo(() => parseAiSections(summaryText), [summaryText]);
  const riskScore = useMemo(() => extractRiskScore(summaryText), [summaryText]);

  useEffect(() => {
    if (aiSections.length) {
      setOpenSections({ 0: true });
    }
  }, [summaryText, aiSections.length]);

  const generateSummary = async () => {
    if (!id) return;
    setAiLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/disputes/${id}/summarize`, { method: "POST" });
      const j = (await res.json()) as { summary?: string; error?: string };
      if (!res.ok) {
        setError(j.error ?? "Summary failed.");
        return;
      }
      if (j.summary) {
        setLocalSummary(j.summary);
        setDispute((prev) => (prev ? { ...prev, aiSummary: j.summary, status: "under_review" } : prev));
      }
    } finally {
      setAiLoading(false);
    }
  };

  const toggleSection = (i: number) => {
    setOpenSections((prev) => ({ ...prev, [i]: !prev[i] }));
  };

  if (!id) {
    return <p className="text-text-muted">Invalid dispute.</p>;
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-10 w-3/4 rounded-lg" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !dispute) {
    return (
      <div className="dash-card rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-8 text-center">
        <p className="text-text-secondary">{error ?? "Not found."}</p>
        <Link href="/dashboard/complaints" className="mt-4 inline-block text-orange-500 hover:text-orange-400">
          Back to complaints
        </Link>
      </div>
    );
  }

  const evidenceRows: EvidenceItem[] =
    (dispute.evidence?.length ?? 0) > 0
      ? dispute.evidence
      : [
          ...(dispute.screenshots ?? []).map((s) => ({
            url: s.url,
            name: s.name,
            type: "image/png",
          })),
          ...(dispute.attachments ?? []).map((a) => ({
            url: a.url,
            name: a.name,
            type: a.mimeType,
          })),
        ];

  const hasEvidence = evidenceRows.length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/complaints" className="text-sm text-orange-500 transition-colors hover:text-orange-400">
            ← Complaints
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="dash-page-title text-2xl md:text-3xl">{dispute.title}</h1>
            {dispute.type ? (
              <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-xs text-orange-300">
                {dispute.type.replace(/_/g, " ")}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-[#666]">{dispute.projectTitle}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs ${statusBadge(dispute.status)}`}>
          {statusLabel(dispute.status)}
        </span>
      </div>

      <section className="dash-card-interactive rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-5 md:p-6">
        <h2 className="dash-table-head font-semibold">Description</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-text-primary">{dispute.description}</p>
        {dispute.resolution ? (
          <div className="mt-6 border-t border-border-subtle pt-4">
            <h3 className="dash-table-head">Resolution notes</h3>
            <p className="mt-2 text-sm text-text-secondary">{dispute.resolution}</p>
          </div>
        ) : null}
      </section>

      <section className="dash-card-interactive rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-5 md:p-6">
        <h2 className="dash-table-head font-semibold">Evidence</h2>
        {!hasEvidence ? (
          <p className="mt-3 text-sm text-text-muted">No files uploaded.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {evidenceRows.map((ev, i) => {
              const isImg = ev.type.startsWith("image/");
              return (
                <li
                  key={`${ev.name}-${i}`}
                  className="flex flex-wrap items-start gap-4 rounded-xl border border-border-default bg-bg-surface p-3 transition-all duration-200"
                >
                  {isImg ? (
                    <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-lg border border-border-subtle bg-black/20">
                      <Image src={ev.url} alt={ev.name} fill className="object-cover" unoptimized />
                    </div>
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-bg-card text-orange-400">
                      {ev.type.includes("pdf") ? <FileText className="h-6 w-6" /> : <FileImage className="h-6 w-6" />}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-text-primary">{ev.name}</p>
                    <p className="text-xs text-text-muted">{ev.type}</p>
                    <a
                      href={ev.url}
                      download={ev.name}
                      className="mt-2 inline-block text-sm text-orange-500 transition-colors hover:text-orange-400"
                    >
                      Download
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void generateSummary()}
          disabled={aiLoading}
          className="dash-btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
        >
          {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Generate AI summary
        </button>
      </div>

      {summaryText ? (
        <section className="overflow-hidden rounded-xl border border-orange-500/20 bg-orange-500/5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-orange-500/15 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg" aria-hidden>
                🤖
              </span>
              <h2 className="font-display text-lg font-bold tracking-tight text-orange-400">AI Analysis</h2>
              <span className="rounded-full border border-orange-500/25 bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-200/90">
                Generated by Claude
              </span>
            </div>
            {riskScore != null ? (
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold",
                  riskSeverityClass(riskScore),
                )}
              >
                Severity: {riskScore}/10
              </span>
            ) : null}
          </div>

          <div className="mt-4 space-y-2">
            {aiSections.map((sec, i) => {
              const open = openSections[i] ?? false;
              return (
                <div key={i} className="rounded-lg border border-orange-500/15 bg-black/10">
                  <button
                    type="button"
                    onClick={() => toggleSection(i)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-text-primary transition-colors hover:bg-orange-500/5"
                  >
                    <span>{sec.fullHeading}</span>
                    <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
                  </button>
                  {open ? (
                    <div className="border-t border-orange-500/10 px-3 py-3 text-sm leading-relaxed text-text-secondary">
                      {sec.body}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-xs leading-relaxed text-text-muted">
            This analysis is AI-assisted and does not constitute a final decision.
          </p>
        </section>
      ) : null}
    </div>
  );
}
