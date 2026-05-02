"use client";

import { FormEvent, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type SubmitWorkModalProps = {
  open: boolean;
  milestoneId: string;
  title: string;
  onClose: () => void;
  onSuccess?: () => void;
  onNotify?: (message: string) => void;
};

export function SubmitWorkModal({
  open,
  milestoneId,
  title,
  onClose,
  onSuccess,
  onNotify,
}: SubmitWorkModalProps) {
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (notes.trim().length < 20) {
      setError("Describe your deliverables (at least 20 characters).");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/milestones/${milestoneId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryNotes: notes.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(typeof j.error === "string" ? j.error : "Submit failed.");
        return;
      }
      onNotify?.("Work submitted — awaiting client review");
      setNotes("");
      onSuccess?.();
      onClose();
    } catch {
      setError("Submit failed.");
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
            onClick={() => !submitting && onClose()}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed right-0 top-0 z-[70] flex h-screen w-full max-w-lg flex-col border-l border-border-subtle bg-bg-surface p-6 shadow-xl"
          >
            <h3 className="font-display text-xl font-semibold text-text-primary">Submit work</h3>
            <p className="mt-2 text-sm text-text-secondary">{title}</p>
            <form onSubmit={onSubmit} className="mt-6 flex flex-1 flex-col gap-4">
              <div>
                <label className="mb-2 block text-sm text-text-secondary">Deliverables</label>
                <textarea
                  required
                  minLength={20}
                  rows={6}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Describe your deliverables..."
                  className="w-full rounded-md border border-border-default bg-bg-card px-3 py-2 text-sm outline-none focus:border-orange-500"
                />
              </div>
              {error ? <p className="text-sm text-orange-400">{error}</p> : null}
              <button
                type="submit"
                disabled={submitting}
                className="mt-auto flex h-12 w-full items-center justify-center rounded-md border border-orange-600 bg-orange-500 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-70"
              >
                {submitting ? "Submitting…" : "Submit Work"}
              </button>
            </form>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
