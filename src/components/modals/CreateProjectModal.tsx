"use client";

import { FormEvent, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { UserSearch, type SearchUser } from "@/components/UserSearch";

type CreateProjectModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  onNotify?: (message: string) => void;
};

export function CreateProjectModal({ open, onClose, onCreated, onNotify }: CreateProjectModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [freelancer, setFreelancer] = useState<SearchUser | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const minDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const reset = () => {
    setTitle("");
    setDescription("");
    setBudget("");
    setDeadline("");
    setFreelancer(null);
    setError("");
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!freelancer) {
      setError("Assign a freelancer.");
      return;
    }
    const budgetNum = Number(budget);
    if (!Number.isFinite(budgetNum) || budgetNum <= 0) {
      setError("Enter a valid budget.");
      return;
    }
    if (!deadline) {
      setError("Choose a deadline.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          budget: budgetNum,
          deadline,
          freelancerId: freelancer.id,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(typeof payload.error === "string" ? payload.error : "Could not create project.");
        return;
      }
      reset();
      onClose();
      onNotify?.("Project created and freelancer notified!");
      onCreated?.();
    } catch {
      setError("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-lg flex-col border-l border-border-subtle bg-bg-surface shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
              <h2 className="font-display text-xl font-semibold text-text-primary">New Project</h2>
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="rounded-md border border-border-strong p-2 text-text-secondary hover:text-text-primary disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
              <div>
                <label className="mb-2 block text-sm text-text-secondary">Project Title</label>
                <input
                  required
                  minLength={3}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-11 w-full rounded-md border border-border-default bg-bg-card px-3 text-sm outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-text-secondary">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-md border border-border-default bg-bg-card px-3 py-2 text-sm outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-text-secondary">Total Budget</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                    $
                  </span>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    required
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="h-11 w-full rounded-md border border-border-default bg-bg-card pl-7 pr-3 text-sm outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-text-secondary">Deadline</label>
                <input
                  type="date"
                  required
                  min={minDate}
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="h-11 w-full rounded-md border border-border-default bg-bg-card px-3 text-sm outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-text-secondary">Assign Freelancer</label>
                <UserSearch onSelect={(u) => setFreelancer(u)} />
                {freelancer ? (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 text-sm text-orange-300">
                    <span className="truncate">{freelancer.name}</span>
                    <button
                      type="button"
                      onClick={() => setFreelancer(null)}
                      className="shrink-0 rounded-full p-0.5 hover:bg-orange-500/20"
                      aria-label="Remove freelancer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>

              {error ? <p className="text-sm text-orange-400">{error}</p> : null}

              <button
                type="submit"
                disabled={submitting}
                className="mt-auto flex h-12 w-full items-center justify-center rounded-md border border-orange-600 bg-orange-500 text-sm font-semibold text-black transition-colors hover:bg-orange-400 disabled:opacity-70"
              >
                {submitting ? "Creating…" : "Create Project"}
              </button>
            </form>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
