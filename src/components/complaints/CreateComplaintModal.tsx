"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  HelpCircle,
  Loader2,
  MessageSquareWarning,
  ShieldAlert,
  Target,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type ModalComplaintType = "payment_issue" | "fraud" | "milestone_dispute" | "chat_abuse" | "other";

const TYPES: { value: ModalComplaintType; label: string; icon: LucideIcon }[] = [
  { value: "payment_issue", label: "Payment issue", icon: CreditCard },
  { value: "fraud", label: "Fraud", icon: ShieldAlert },
  { value: "milestone_dispute", label: "Milestone dispute", icon: Target },
  { value: "chat_abuse", label: "Chat abuse", icon: MessageSquareWarning },
  { value: "other", label: "Other", icon: HelpCircle },
];

type ProjectOption = { id: string; title: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmitted?: (reference: string) => void;
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

export function CreateComplaintModal({ open, onClose, onSubmitted }: Props) {
  const [step, setStep] = useState(1);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectSearch, setProjectSearch] = useState("");
  const [projectId, setProjectId] = useState("");
  const [complaintType, setComplaintType] = useState<ModalComplaintType>("milestone_dispute");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [screenshotFiles, setScreenshotFiles] = useState<{ file: File; preview: string }[]>([]);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/projects?limit=100", { signal: ac.signal });
        if (!res.ok) return;
        const j = (await res.json()) as { data: { id: string; title: string }[] };
        setProjects((j.data ?? []).map((p) => ({ id: p.id, title: p.title })));
      } catch {
        /* ignore */
      }
    })();
    return () => ac.abort();
  }, [open]);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setProjectSearch("");
      setProjectId("");
      setComplaintType("milestone_dispute");
      setTitle("");
      setDescription("");
      setAdditionalNotes("");
      setScreenshotFiles([]);
      setAttachmentFiles([]);
      setSubmitting(false);
    }
  }, [open]);

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.title.toLowerCase().includes(q));
  }, [projectSearch, projects]);

  const selectedProject = projects.find((p) => p.id === projectId);

  const onPickScreenshots = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      const next = [...screenshotFiles];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (!f.type.startsWith("image/")) continue;
        const preview = await readAsDataUrl(f);
        next.push({ file: f, preview });
      }
      setScreenshotFiles(next.slice(0, 12));
    },
    [screenshotFiles],
  );

  const onPickAttachments = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const arr = Array.from(files).slice(0, 3);
    setAttachmentFiles((prev) => [...prev, ...arr].slice(0, 3));
  }, []);

  const removeScreenshot = (idx: number) => {
    setScreenshotFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeAttachment = (idx: number) => {
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const showToast = (msg: string) => {
    const el = document.createElement("div");
    el.className = "toast-success";
    el.textContent = msg;
    document.body.appendChild(el);
    window.setTimeout(() => el.remove(), 4200);
  };

  const handleSubmit = async () => {
    if (description.trim().length < 100) return;
    setSubmitting(true);
    try {
      const screenshots: { url: string; name: string }[] = [];
      for (const s of screenshotFiles) {
        const url = await readAsDataUrl(s.file);
        screenshots.push({ url, name: s.file.name });
      }
      const attachments: { url: string; name: string; mimeType: string }[] = [];
      for (const f of attachmentFiles) {
        const url = await readAsDataUrl(f);
        attachments.push({ url, name: f.name, mimeType: f.type || "application/octet-stream" });
      }

      const res = await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title: title.trim(),
          description: description.trim(),
          type: complaintType,
          screenshots: screenshots.length ? screenshots : undefined,
          attachments: attachments.length ? attachments : undefined,
          additionalNotes: additionalNotes.trim() || undefined,
        }),
      });
      const j = (await res.json()) as {
        data?: { reference?: string; id?: string };
        error?: string;
      };
      if (!res.ok) {
        showToast(j.error ?? "Could not submit complaint.");
        return;
      }
      const ref = j.data?.reference ?? j.data?.id ?? "";
      showToast(`Complaint submitted — reference #${ref}`);
      onSubmitted?.(ref);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const descLen = description.trim().length;
  const canNext1 =
    projectId &&
    title.trim().length > 0 &&
    complaintType &&
    descLen >= 100;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
      <div
        className="dash-card flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] transition-all duration-200"
        role="dialog"
        aria-modal
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4 md:px-6">
          <h2 className="font-display text-lg font-bold tracking-tight text-text-primary">New complaint</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted transition-colors duration-150 hover:bg-bg-surface hover:text-text-primary"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 md:px-6">
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="text-sm text-[#666]">Complaint type</label>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {TYPES.map((t) => {
                    const Icon = t.icon;
                    const sel = complaintType === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setComplaintType(t.value)}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-all duration-200 active:scale-[0.97]",
                          sel
                            ? "border-orange-500/50 bg-orange-500/10 text-orange-400"
                            : "border-border-default bg-bg-surface text-text-secondary hover:border-[#333]",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="relative">
                <label className="text-sm text-[#666]">Related project</label>
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  className="mt-2 h-11 w-full rounded-lg border border-border-default bg-bg-card px-3 text-sm outline-none transition-colors focus:border-orange-500"
                />
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="mt-2 h-11 w-full rounded-lg border border-border-default bg-bg-card px-3 text-sm outline-none focus:border-orange-500"
                  required
                >
                  <option value="">Select a project</option>
                  {filteredProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-[#666]">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-2 h-11 w-full rounded-lg border border-border-default bg-bg-card px-3 text-sm outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="text-sm text-[#666]">Description (min 100 characters)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  className="mt-2 w-full resize-none rounded-lg border border-border-default bg-bg-card px-3 py-2 text-sm outline-none focus:border-orange-500"
                />
                <p className={cn("mt-1 text-xs", descLen >= 100 ? "text-emerald-400/90" : "text-[#666]")}>
                  {descLen} / 100 min
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium text-text-primary">Upload screenshots</label>
                <p className="text-xs text-text-muted">Images only. Stored as base64 for this prototype.</p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="mt-2 block w-full text-sm text-text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black hover:file:bg-orange-600"
                  onChange={(e) => void onPickScreenshots(e.target.files)}
                />
                {screenshotFiles.length > 0 ? (
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {screenshotFiles.map((s, i) => (
                      <div key={i} className="group relative aspect-square overflow-hidden rounded-lg border border-border-default">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.preview} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeScreenshot(i)}
                          className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                          aria-label="Remove"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div>
                <label className="text-sm font-medium text-text-primary">Attachments (max 3)</label>
                <input
                  type="file"
                  multiple
                  className="mt-2 block w-full text-sm text-text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-bg-surface file:px-4 file:py-2 file:text-sm file:text-text-primary file:ring-1 file:ring-border-default"
                  onChange={(e) => onPickAttachments(e.target.files)}
                />
                <ul className="mt-3 space-y-2">
                  {attachmentFiles.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border-default bg-bg-surface px-3 py-2 text-sm"
                    >
                      <span className="truncate text-text-secondary">{f.name}</span>
                      <span className="shrink-0 text-xs text-text-muted">{(f.size / 1024).toFixed(0)} KB</span>
                      <button type="button" onClick={() => removeAttachment(i)} className="shrink-0 text-red-400">
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <label className="text-sm text-[#666]">Additional notes (optional)</label>
                <textarea
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  rows={3}
                  className="mt-2 w-full resize-none rounded-lg border border-border-default bg-bg-card px-3 py-2 text-sm outline-none focus:border-orange-500"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 text-sm">
              <h3 className="font-display text-base font-bold text-text-primary">Review</h3>
              <dl className="space-y-2 text-text-secondary">
                <div>
                  <dt className="text-xs uppercase tracking-widest text-[#666]">Type</dt>
                  <dd className="text-text-primary">{TYPES.find((t) => t.value === complaintType)?.label}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-widest text-[#666]">Project</dt>
                  <dd className="text-text-primary">{selectedProject?.title ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-widest text-[#666]">Title</dt>
                  <dd className="text-text-primary">{title}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-widest text-[#666]">Description</dt>
                  <dd className="whitespace-pre-wrap text-text-primary">{description}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-widest text-[#666]">Evidence</dt>
                  <dd>
                    {screenshotFiles.length} screenshot(s), {attachmentFiles.length} attachment(s)
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-5 py-4 md:px-6">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="inline-flex items-center gap-1 rounded-lg border border-border-strong px-4 py-2 text-sm text-text-secondary transition-all duration-150 hover:bg-bg-surface disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 1 && !canNext1}
              className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-black transition-all duration-150 hover:bg-orange-600 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting || descLen < 100}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-black transition-all duration-150 hover:bg-orange-600 active:scale-[0.97] disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Submit complaint
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
