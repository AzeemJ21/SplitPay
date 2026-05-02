"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

type FundMilestoneModalProps = {
  open: boolean;
  title: string;
  amount: number;
  milestoneId: string;
  onClose: () => void;
  onSuccess?: () => void;
  onNotify?: (message: string) => void;
};

function formatMoney(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function FundMilestoneModal({
  open,
  title,
  amount,
  milestoneId,
  onClose,
  onSuccess,
  onNotify,
}: FundMilestoneModalProps) {
  const confirm = async () => {
    try {
      const res = await fetch(`/api/milestones/${milestoneId}/fund`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        onNotify?.(typeof j.error === "string" ? j.error : "Funding failed.");
        return;
      }
      onNotify?.("Funds held in escrow");
      onSuccess?.();
      onClose();
    } catch {
      onNotify?.("Funding failed.");
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
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="fixed left-1/2 top-1/2 z-[70] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border-subtle bg-bg-surface p-6 shadow-xl"
          >
            <h3 className="font-display text-xl font-semibold text-text-primary">Fund milestone</h3>
            <p className="mt-2 text-sm text-text-secondary">{title}</p>
            <p className="mt-4 font-display text-3xl text-orange-400">{formatMoney(amount)}</p>
            <div className="mt-4 flex gap-3 rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 text-sm text-orange-200">
              <AlertTriangle className="h-5 w-5 shrink-0 text-orange-400" />
              <p>Funds will be held in escrow until you approve the freelancer&apos;s work.</p>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="h-12 flex-1 rounded-md border border-border-strong text-sm text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirm()}
                className="h-12 flex-1 rounded-md border border-orange-600 bg-orange-500 text-sm font-semibold text-black hover:bg-orange-400"
              >
                Confirm Funding
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
