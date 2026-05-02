"use client";

import { Loader2, X } from "lucide-react";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

type DisputeModalProps = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
  onRaised: (message: string) => void;
};

export function DisputeModal({ open, onClose, projectId, projectTitle, onRaised }: DisputeModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setTitle("");
    setDescription("");
    setFiles([]);
    setError(null);
  }, []);

  const handleClose = () => {
    if (!submitting) {
      reset();
      onClose();
    }
  };

  const onFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list?.length) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    const d = description.trim();
    if (t.length < 1 || d.length < 50) {
      setError("Description must be at least 50 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, title: t, description: d }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? "Could not create dispute.");
        return;
      }
      const j = (await res.json()) as { data: { id: string } };
      const disputeId = j.data?.id;
      if (!disputeId) {
        setError("Invalid response.");
        return;
      }
      for (const file of files) {
        const fd = new FormData();
        fd.set("file", file);
        const up = await fetch(`/api/disputes/${disputeId}/evidence`, {
          method: "POST",
          body: fd,
        });
        if (!up.ok) {
          setError("Dispute created but some evidence uploads failed.");
          onRaised("Dispute raised. Our team will review within 48 hours.");
          reset();
          onClose();
          return;
        }
      }
      onRaised("Dispute raised. Our team will review within 48 hours.");
      reset();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border-subtle bg-bg-surface shadow-xl"
        role="dialog"
        aria-modal
        aria-labelledby="dispute-modal-title"
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <h2 id="dispute-modal-title" className="font-display text-lg font-semibold text-text-primary">
            Report a dispute
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="rounded-md p-1 text-text-muted hover:bg-bg-card hover:text-text-primary disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 p-4">
          <p className="text-sm text-text-secondary">
            Project: <span className="font-medium text-text-primary">{projectTitle}</span>
          </p>

          {error ? (
            <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          ) : null}

          <div>
            <label htmlFor="dispute-title" className="text-xs text-text-muted">
              Title
            </label>
            <input
              id="dispute-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-border-default bg-bg-card px-3 text-sm text-text-primary"
              required
              maxLength={200}
            />
          </div>

          <div>
            <label htmlFor="dispute-desc" className="text-xs text-text-muted">
              Description (min 50 characters)
            </label>
            <textarea
              id="dispute-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className={cn(
                "mt-1 w-full rounded-md border bg-bg-card px-3 py-2 text-sm text-text-primary",
                description.trim().length > 0 && description.trim().length < 50
                  ? "border-amber-600/50"
                  : "border-border-default",
              )}
              required
              minLength={50}
              placeholder="Describe the issue in detail…"
            />
            <p className="mt-1 text-xs text-text-muted">{description.trim().length} / 50 min</p>
          </div>

          <div>
            <label className="text-xs text-text-muted">Evidence (optional, multiple files)</label>
            <input
              type="file"
              multiple
              onChange={onFilesChange}
              className="mt-1 block w-full text-sm text-text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-orange-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-black"
            />
            {files.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-text-secondary">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-md bg-bg-card px-2 py-1">
                    <span className="truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="shrink-0 text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="rounded-md border border-border-strong px-4 py-2 text-sm text-text-secondary hover:bg-bg-card disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || description.trim().length < 50}
              className="inline-flex items-center gap-2 rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-400 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Submit dispute
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
