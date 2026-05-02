"use client";

/**
 * FYP prototype — simulated withdrawals only. No real payouts or banking.
 */

import { Check, Landmark, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type WithdrawModalProps = {
  open: boolean;
  onClose: () => void;
  balance: number;
  onSuccess?: () => void;
};

type Method = "paypal" | "stripe" | "bank_transfer" | null;

function formatMoney(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function WithdrawModal({ open, onClose, balance, onSuccess }: WithdrawModalProps) {
  const [step, setStep] = useState(1);
  const [amountStr, setAmountStr] = useState("");
  const [method, setMethod] = useState<Method>(null);
  const [paypalEmail, setPaypalEmail] = useState("");
  const [stripeAccountId, setStripeAccountId] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedRef, setSubmittedRef] = useState("");
  const [step4Done, setStep4Done] = useState(false);

  const amountNum = parseFloat(amountStr.replace(/[^0-9.]/g, "")) || 0;

  const reset = () => {
    setStep(1);
    setAmountStr("");
    setMethod(null);
    setPaypalEmail("");
    setStripeAccountId("");
    setBankName("");
    setAccountNumber("");
    setAccountName("");
    setSubmitting(false);
    setError(null);
    setSubmittedRef("");
    setStep4Done(false);
  };

  const handleClose = () => {
    if (submitting && step !== 4) return;
    reset();
    onClose();
  };

  useEffect(() => {
    if (step !== 4) return;
    setStep4Done(false);
    const t = window.setTimeout(() => setStep4Done(true), 2000);
    return () => window.clearTimeout(t);
  }, [step]);

  const setQuickPct = (pct: number) => {
    const v = pct >= 1 ? balance : Math.floor(balance * pct * 100) / 100;
    setAmountStr(v > 0 ? String(v) : "");
  };

  const canNext1 = amountNum > 0 && amountNum <= balance + 1e-9;
  const canNext2 =
    method &&
    (method === "paypal"
      ? paypalEmail.includes("@")
      : method === "stripe"
        ? stripeAccountId.trim().length > 0
        : bankName.trim() && accountNumber.trim() && accountName.trim());

  const methodLabel =
    method === "paypal" ? "PayPal" : method === "stripe" ? "Stripe payout" : "Bank transfer";

  const reviewDestination =
    method === "paypal"
      ? paypalEmail
      : method === "stripe"
        ? stripeAccountId
        : `${bankName} · ${accountName}`;

  const arrivalLabel =
    method === "paypal" ? "Instant" : method === "stripe" ? "1–2 business days" : "2–3 business days";

  const submitWithdrawal = async () => {
    if (!method || !canNext2) return;
    setSubmitting(true);
    setError(null);
    try {
      const body =
        method === "paypal"
          ? { amount: amountNum, method: "paypal" as const, paypalEmail }
          : method === "stripe"
            ? { amount: amountNum, method: "stripe" as const, stripeAccountId }
            : {
                amount: amountNum,
                method: "bank_transfer" as const,
                bankName,
                accountNumber,
                accountName,
              };

      const res = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as {
        success?: boolean;
        withdrawal?: { transactionRef: string };
        error?: string;
        available?: number;
      };
      if (!res.ok) {
        if (j.error === "INSUFFICIENT_BALANCE" && typeof j.available === "number") {
          setError(`Insufficient balance. Available: ${formatMoney(j.available)}`);
        } else {
          setError(j.error ?? "Request failed.");
        }
        return;
      }
      setSubmittedRef(j.withdrawal?.transactionRef ?? "");
      setStep(4);
    } finally {
      setSubmitting(false);
    }
  };

  const done = () => {
    reset();
    onClose();
    onSuccess?.();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border-subtle bg-bg-surface shadow-xl"
        role="dialog"
        aria-modal
        aria-labelledby="withdraw-modal-title"
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <h2 id="withdraw-modal-title" className="font-display text-lg font-semibold text-text-primary">
            Withdraw funds
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting && step < 4}
            className="rounded-md p-1 text-text-muted hover:bg-bg-card hover:text-text-primary disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* FYP: step indicator */}
        <div className="flex justify-center gap-2 border-b border-border-subtle px-4 py-3">
          {[1, 2, 3, 4].map((s) => (
            <span
              key={s}
              className={cn(
                "h-2.5 w-2.5 rounded-full transition-colors",
                step >= s ? "bg-orange-500" : "bg-bg-elevated",
              )}
            />
          ))}
        </div>

        <div className="p-4">
          {step === 1 ? (
            <div className="space-y-6">
              <div className="text-center">
                <p className="mb-2 text-xs uppercase tracking-wide text-text-muted">Amount</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="font-display text-4xl text-orange-500 sm:text-[48px]">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    placeholder="0.00"
                    className="w-full max-w-[240px] border-0 bg-transparent text-center font-display text-4xl text-text-primary outline-none placeholder:text-text-muted sm:text-[48px]"
                  />
                </div>
                <p className="mt-3 text-sm text-text-muted">
                  Available balance: {formatMoney(balance)}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  { label: "25%", fn: () => setQuickPct(0.25) },
                  { label: "50%", fn: () => setQuickPct(0.5) },
                  { label: "75%", fn: () => setQuickPct(0.75) },
                  { label: "Max", fn: () => setQuickPct(1) },
                ].map((b) => (
                  <button
                    key={b.label}
                    type="button"
                    onClick={b.fn}
                    className="rounded-lg border border-border-strong px-4 py-2 text-sm text-text-secondary hover:border-orange-500/40 hover:text-text-primary"
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              {!canNext1 && amountStr ? (
                <p className="text-center text-xs text-orange-400">
                  Enter an amount between $0.01 and your available balance.
                </p>
              ) : null}
              <button
                type="button"
                disabled={!canNext1}
                onClick={() => setStep(2)}
                className="w-full rounded-lg bg-orange-500 py-3 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <p className="text-sm font-medium text-text-primary">Payout method</p>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setMethod("paypal")}
                  className={cn(
                    "w-full rounded-xl border p-4 text-left transition-colors",
                    "bg-[#1A1A1A] hover:border-orange-500/40",
                    method === "paypal" ? "border-orange-500 bg-orange-500/5" : "border-border-subtle",
                  )}
                >
                  <p className="font-display text-lg text-[#0070ba]">PayPal</p>
                  <p className="mt-1 text-xs text-text-muted">Instant payout to your PayPal account</p>
                </button>
                {method === "paypal" ? (
                  <input
                    type="email"
                    value={paypalEmail}
                    onChange={(e) => setPaypalEmail(e.target.value)}
                    placeholder="PayPal email address"
                    className="w-full rounded-lg border border-border-default bg-bg-card px-3 py-2 text-sm text-text-primary"
                  />
                ) : null}

                <button
                  type="button"
                  onClick={() => setMethod("stripe")}
                  className={cn(
                    "relative w-full rounded-xl border p-4 text-left transition-colors",
                    "bg-[#1A1A1A] hover:border-orange-500/40",
                    method === "stripe" ? "border-orange-500 bg-orange-500/5" : "border-border-subtle",
                  )}
                >
                  <span className="absolute right-3 top-3 rounded-full border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-400">
                    SIMULATED
                  </span>
                  <p className="font-display text-lg text-[#635bff]">Stripe</p>
                  <p className="mt-1 text-xs text-text-muted">Payout to your Stripe connected account</p>
                </button>
                {method === "stripe" ? (
                  <input
                    value={stripeAccountId}
                    onChange={(e) => setStripeAccountId(e.target.value)}
                    placeholder="Stripe Account ID"
                    className="w-full rounded-lg border border-border-default bg-bg-card px-3 py-2 text-sm text-text-primary"
                  />
                ) : null}

                <button
                  type="button"
                  onClick={() => setMethod("bank_transfer")}
                  className={cn(
                    "w-full rounded-xl border p-4 text-left transition-colors",
                    "bg-[#1A1A1A] hover:border-orange-500/40",
                    method === "bank_transfer" ? "border-orange-500 bg-orange-500/5" : "border-border-subtle",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Landmark className="h-6 w-6 text-orange-400" />
                    <div>
                      <p className="font-display text-lg text-text-primary">Bank transfer</p>
                      <p className="mt-1 text-xs text-text-muted">Direct bank transfer (2–3 business days)</p>
                    </div>
                  </div>
                </button>
                {method === "bank_transfer" ? (
                  <div className="space-y-2">
                    <input
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="Bank name"
                      className="w-full rounded-lg border border-border-default bg-bg-card px-3 py-2 text-sm text-text-primary"
                    />
                    <input
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="Account number"
                      className="w-full rounded-lg border border-border-default bg-bg-card px-3 py-2 text-sm text-text-primary"
                    />
                    <input
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      placeholder="Account holder name"
                      className="w-full rounded-lg border border-border-default bg-bg-card px-3 py-2 text-sm text-text-primary"
                    />
                  </div>
                ) : null}
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 rounded-lg border border-border-strong py-3 text-sm text-text-secondary"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!canNext2}
                  onClick={() => setStep(3)}
                  className="flex-1 rounded-lg bg-orange-500 py-3 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border-subtle bg-bg-card p-4 text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-text-muted">Withdrawal amount</span>
                  <span className="font-medium text-text-primary">{formatMoney(amountNum)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-text-muted">Method</span>
                  <span className="text-text-primary">{methodLabel}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-text-muted">To</span>
                  <span className="max-w-[60%] truncate text-right text-text-primary">{reviewDestination}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-text-muted">Estimated arrival</span>
                  <span className="text-text-primary">{arrivalLabel}</span>
                </div>
                <div className="flex justify-between border-t border-border-subtle py-2 mt-2 pt-3">
                  <span className="text-text-muted">Transaction fee</span>
                  <span className="text-text-primary">{formatMoney(0)}</span>
                </div>
              </div>
              <p className="text-xs text-text-muted">
                ⚠ This is a simulated withdrawal for demonstration purposes only.
              </p>
              {error ? <p className="text-sm text-orange-400">{error}</p> : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 rounded-lg border border-border-strong py-3 text-sm text-text-secondary"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void submitWithdrawal()}
                  className="flex-1 rounded-lg bg-orange-500 py-3 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Confirm"}
                </button>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="flex flex-col items-center py-8 text-center">
              {!step4Done ? (
                <>
                  <Loader2 className="h-12 w-12 animate-spin text-orange-500" />
                  <p className="mt-4 text-sm text-text-secondary">Processing your withdrawal…</p>
                  <p className="mt-2 text-xs text-text-muted">
                    {/* FYP — backend simulation completes in ~5s */}
                    Settlement is simulated; status updates in transaction history.
                  </p>
                </>
              ) : (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-emerald-500/50 bg-emerald-500/15">
                    <Check className="h-8 w-8 text-emerald-400" strokeWidth={2.5} />
                  </div>
                  <p className="mt-4 font-display text-xl font-semibold text-text-primary">
                    Withdrawal submitted!
                  </p>
                  <p className="mt-2 font-mono text-sm text-orange-400">{submittedRef}</p>
                  <p className="mt-3 max-w-sm text-xs text-text-muted">
                    Your balance was debited. Final status updates within a few seconds (simulated).
                  </p>
                  <button
                    type="button"
                    onClick={done}
                    className="mt-8 w-full rounded-lg bg-orange-500 py-3 text-sm font-semibold text-black hover:bg-orange-400"
                  >
                    Done
                  </button>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
