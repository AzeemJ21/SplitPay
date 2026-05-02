"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Check, CreditCard, Loader2 } from "lucide-react";

type Step = 1 | 2 | 3;

const initialCard = {
  number: "",
  expiry: "",
  cvv: "",
  name: "",
};

function formatCurrency(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function formatCardNumber(raw: string) {
  const digitsOnly = raw.replace(/\D/g, "").slice(0, 16);
  return digitsOnly.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function maskCardNumber(number: string, fallback: string) {
  const digits = number.replace(/\D/g, "");
  const last4 = digits.slice(-4);
  return `•••• •••• •••• ${last4 || fallback}`;
}

export default function NewSplitPaymentPage() {
  const { data: session } = useSession();
  const [step, setStep] = useState<Step>(1);
  const [totalAmount, setTotalAmount] = useState(1200);
  const [card1Percent, setCard1Percent] = useState(60);
  const [card1, setCard1] = useState(initialCard);
  const [card2, setCard2] = useState(initialCard);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [txId, setTxId] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [showMobilePreview, setShowMobilePreview] = useState(false);

  const card2Percent = 100 - card1Percent;
  const card1Amount = useMemo(() => (totalAmount * card1Percent) / 100, [totalAmount, card1Percent]);
  const card2Amount = useMemo(() => totalAmount - card1Amount, [totalAmount, card1Amount]);
  const splitCodeLabel = session?.user?.splitCode ? `#${session.user.splitCode}` : "—";
  const splitCodeDigits = session?.user?.splitCode ?? "";

  const processPayment = async () => {
    setPaymentError("");
    if (!splitCodeDigits) {
      setPaymentError("Sign in to load your split code before processing a payment.");
      return;
    }
    const c1 = card1.number.replace(/\D/g, "");
    const c2 = card2.number.replace(/\D/g, "");
    if (c1.length < 8 || c2.length < 8) {
      setPaymentError("Enter at least 8 digits for each card number.");
      return;
    }
    setIsProcessing(true);
    try {
      const res = await fetch("/api/split-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          totalAmount,
          splitCode: splitCodeDigits,
          card1: {
            number: c1,
            expiry: card1.expiry,
            cvv: card1.cvv,
            amount: card1Amount,
          },
          card2: {
            number: c2,
            expiry: card2.expiry,
            cvv: card2.cvv,
            amount: card2Amount,
          },
        }),
      });
      const payload = (await res.json()) as {
        data?: { success?: boolean };
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setPaymentError(
          (payload.message as string | undefined) ??
            (payload.error as string | undefined) ??
            "Payment could not be completed.",
        );
        return;
      }
      setTxId(payload.data?.success ? "completed" : "");
      setIsSuccess(true);
    } catch {
      setPaymentError("Something went wrong. Try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const makeAnother = () => {
    setStep(1);
    setIsSuccess(false);
    setIsProcessing(false);
    setTxId("");
    setPaymentError("");
  };

  const onSubmitStep1 = (event: FormEvent) => {
    event.preventDefault();
    setStep(2);
  };

  const onSubmitStep2 = (event: FormEvent) => {
    event.preventDefault();
    setStep(3);
  };

  return (
    <div className="relative grid min-h-[calc(100vh-56px)] gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative rounded-lg border border-border-subtle bg-bg-surface p-6">
        <div className="mb-6 flex items-center gap-2">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setStep(n as Step)}
              className={`h-8 w-8 rounded-full border text-xs font-semibold transition-colors ${
                step === n
                  ? "border-orange-500 bg-orange-500 text-black"
                  : "border-border-strong text-text-secondary hover:text-text-primary"
              }`}
            >
              {n}
            </button>
          ))}
          <span className="ml-3 text-sm text-text-secondary">
            {step === 1 ? "Payment Details" : step === 2 ? "Card Details" : "Confirm"}
          </span>
          <button
            type="button"
            onClick={() => setShowMobilePreview(true)}
            className="ml-auto rounded-md border border-border-strong px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary lg:hidden"
          >
            Preview
          </button>
        </div>

        {step === 1 && (
          <form onSubmit={onSubmitStep1} className="space-y-8">
            <div>
              <p className="text-sm text-text-secondary">Step 1 - Payment Details</p>
              <div className="mt-4 border-b-2 border-orange-500 pb-2">
                <label className="text-xs uppercase tracking-wide text-text-muted">Amount</label>
                <div className="mt-1 flex items-end justify-center">
                  <span className="mr-2 font-display text-3xl text-orange-500">$</span>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    value={totalAmount}
                    onChange={(event) => setTotalAmount(Number(event.target.value) || 0)}
                    className="w-full bg-transparent text-center font-display text-[48px] font-bold leading-none text-text-primary outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-md border border-border-subtle bg-bg-card p-4">
                <p className="text-sm text-text-secondary">Card 1</p>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={card1Percent}
                  onChange={(event) => setCard1Percent(Number(event.target.value))}
                  className="mt-4 h-1 w-full cursor-pointer accent-orange-500"
                />
                <p className="mt-3 text-sm text-orange-400">Card 1: {formatCurrency(card1Amount)}</p>
              </div>
              <div className="rounded-md border border-border-subtle bg-bg-card p-4">
                <p className="text-sm text-text-secondary">Card 2</p>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={card2Percent}
                  onChange={(event) => setCard1Percent(100 - Number(event.target.value))}
                  className="mt-4 h-1 w-full cursor-pointer accent-orange-300"
                />
                <p className="mt-3 text-sm text-orange-300">Card 2: {formatCurrency(card2Amount)}</p>
              </div>
            </div>

            <button
              type="submit"
              className="h-12 w-full rounded-md border border-orange-600 bg-orange-500 text-sm font-semibold text-black transition-colors hover:bg-orange-400"
            >
              Continue to Card Details
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={onSubmitStep2} className="space-y-6">
            <p className="text-sm text-text-secondary">Step 2 - Card Details</p>

            <div className="rounded-md border border-border-subtle bg-bg-card p-4">
              <h3 className="mb-4 text-sm font-semibold text-text-primary">Card 1</h3>
              <div className="space-y-3">
                <input
                  placeholder="Cardholder Name"
                  value={card1.name}
                  onChange={(event) => setCard1((prev) => ({ ...prev, name: event.target.value }))}
                  className="h-11 w-full rounded-md border border-border-default bg-bg-surface px-3 text-sm outline-none focus:border-orange-500"
                />
                <input
                  placeholder="1234 5678 9012 3456"
                  value={card1.number}
                  onChange={(event) =>
                    setCard1((prev) => ({ ...prev, number: formatCardNumber(event.target.value) }))
                  }
                  className="h-11 w-full rounded-md border border-border-default bg-bg-surface px-3 font-mono text-sm outline-none focus:border-orange-500"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    placeholder="MM/YY"
                    value={card1.expiry}
                    onChange={(event) =>
                      setCard1((prev) => ({ ...prev, expiry: formatExpiry(event.target.value) }))
                    }
                    className="h-11 w-full rounded-md border border-border-default bg-bg-surface px-3 text-sm outline-none focus:border-orange-500"
                  />
                  <input
                    placeholder="CVV"
                    value={card1.cvv}
                    onChange={(event) =>
                      setCard1((prev) => ({
                        ...prev,
                        cvv: event.target.value.replace(/\D/g, "").slice(0, 4),
                      }))
                    }
                    className="h-11 w-full rounded-md border border-border-default bg-bg-surface px-3 text-sm outline-none focus:border-orange-500"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-md border border-border-subtle bg-bg-card p-4">
              <h3 className="mb-4 text-sm font-semibold text-text-primary">Card 2</h3>
              <div className="space-y-3">
                <input
                  placeholder="Cardholder Name"
                  value={card2.name}
                  onChange={(event) => setCard2((prev) => ({ ...prev, name: event.target.value }))}
                  className="h-11 w-full rounded-md border border-border-default bg-bg-surface px-3 text-sm outline-none focus:border-orange-500"
                />
                <input
                  placeholder="1234 5678 9012 3456"
                  value={card2.number}
                  onChange={(event) =>
                    setCard2((prev) => ({ ...prev, number: formatCardNumber(event.target.value) }))
                  }
                  className="h-11 w-full rounded-md border border-border-default bg-bg-surface px-3 font-mono text-sm outline-none focus:border-orange-500"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    placeholder="MM/YY"
                    value={card2.expiry}
                    onChange={(event) =>
                      setCard2((prev) => ({ ...prev, expiry: formatExpiry(event.target.value) }))
                    }
                    className="h-11 w-full rounded-md border border-border-default bg-bg-surface px-3 text-sm outline-none focus:border-orange-500"
                  />
                  <input
                    placeholder="CVV"
                    value={card2.cvv}
                    onChange={(event) =>
                      setCard2((prev) => ({
                        ...prev,
                        cvv: event.target.value.replace(/\D/g, "").slice(0, 4),
                      }))
                    }
                    className="h-11 w-full rounded-md border border-border-default bg-bg-surface px-3 text-sm outline-none focus:border-orange-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="h-12 w-full rounded-md border border-border-strong text-sm text-text-secondary transition-colors hover:text-text-primary"
              >
                Back
              </button>
              <button
                type="submit"
                className="h-12 w-full rounded-md border border-orange-600 bg-orange-500 text-sm font-semibold text-black transition-colors hover:bg-orange-400"
              >
                Review Payment
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <p className="text-sm text-text-secondary">Step 3 - Confirm</p>
            <div className="space-y-3 rounded-md border border-border-subtle bg-bg-card p-5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Total</span>
                <span className="font-semibold text-text-primary">{formatCurrency(totalAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Card 1 Amount</span>
                <span className="font-semibold text-orange-400">{formatCurrency(card1Amount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Card 2 Amount</span>
                <span className="font-semibold text-orange-300">{formatCurrency(card2Amount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Split Code</span>
                <span className="font-mono text-orange-400">{splitCodeLabel}</span>
              </div>
            </div>

            {paymentError ? (
              <p className="text-sm text-orange-400" role="alert">
                {paymentError}
              </p>
            ) : null}

            <button
              type="button"
              onClick={processPayment}
              disabled={isProcessing}
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-md bg-orange-500 text-sm font-semibold text-black transition-colors hover:bg-orange-600 disabled:opacity-80"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-orange-900" />
                  Processing...
                </>
              ) : (
                "Process Payment"
              )}
            </button>
          </div>
        )}
      </section>

      <section className="hidden rounded-lg border border-border-subtle bg-bg-surface p-6 lg:block">
        <h2 className="text-sm text-text-secondary">Live Preview</h2>
        <div className="mt-5 space-y-6">
          <div className="relative h-[260px]">
            <motion.div
              layout
              className="absolute inset-x-0 top-0 rounded-xl border border-orange-500/30 bg-bg-card p-5 shadow-[0_0_0_1px_rgba(249,115,22,0.18)]"
            >
              <div className="pointer-events-none absolute inset-y-0 right-0 w-1 bg-gradient-to-b from-orange-500 to-orange-300" />
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-text-secondary">Card 1</span>
                <CreditCard className="h-4 w-4 text-orange-400" />
              </div>
              <p className="mt-10 font-mono text-xl text-text-primary">
                {maskCardNumber(card1.number, "4321")}
              </p>
              <div className="mt-8 flex items-center justify-between text-xs text-text-secondary">
                <span>{card1.name || "Primary Holder"}</span>
                <span>{card1.expiry || "MM/YY"}</span>
              </div>
            </motion.div>

            <motion.div
              layout
              className="absolute inset-x-4 top-16 rounded-xl border border-border-strong bg-bg-surface p-5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-text-secondary">Card 2</span>
                <CreditCard className="h-4 w-4 text-orange-300" />
              </div>
              <p className="mt-10 font-mono text-xl text-text-primary">
                {maskCardNumber(card2.number, "9012")}
              </p>
              <div className="mt-8 flex items-center justify-between text-xs text-text-secondary">
                <span>{card2.name || "Secondary Holder"}</span>
                <span>{card2.expiry || "MM/YY"}</span>
              </div>
            </motion.div>
          </div>

          <div className="rounded-md border border-border-subtle bg-bg-card p-4">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-text-secondary">Split Distribution</span>
              <span className="text-text-primary">
                {card1Percent}% / {card2Percent}%
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-bg-elevated">
              <motion.div
                animate={{ width: `${card1Percent}%` }}
                transition={{ duration: 0.25 }}
                className="h-full bg-orange-500"
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-orange-400">Card 1: {formatCurrency(card1Amount)}</span>
              <span className="text-orange-300">Card 2: {formatCurrency(card2Amount)}</span>
            </div>
          </div>
        </div>
      </section>

      {isSuccess && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-bg-base/95 p-6 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-lg border border-orange-500/30 bg-bg-card p-8 text-center">
            <motion.svg
              width="84"
              height="84"
              viewBox="0 0 100 100"
              className="mx-auto"
              initial="hidden"
              animate="visible"
            >
              <motion.circle
                cx="50"
                cy="50"
                r="42"
                stroke="#F97316"
                strokeWidth="4"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5 }}
              />
              <motion.path
                d="M30 52 L44 66 L70 38"
                fill="none"
                stroke="#F97316"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.45, delay: 0.45 }}
              />
            </motion.svg>

            <h3 className="mt-6 font-display text-3xl font-bold text-text-primary">
              Payment Split Successfully
            </h3>
            <div className="mt-6 space-y-2 text-sm">
              <p className="text-text-secondary">
                Split Code: <span className="font-mono text-orange-400">{splitCodeLabel}</span>
              </p>
              <p className="text-text-secondary">
                Card 1: <span className="text-orange-400">{formatCurrency(card1Amount)}</span>
              </p>
              <p className="text-text-secondary">
                Card 2: <span className="text-orange-300">{formatCurrency(card2Amount)}</span>
              </p>
              <p className="text-text-secondary">
                Transaction ID: <span className="font-mono text-text-primary">{txId}</span>
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className="h-11 rounded-md border border-orange-600 bg-orange-500 text-sm font-semibold text-black transition-colors hover:bg-orange-400"
              >
                View Transaction
              </button>
              <button
                type="button"
                onClick={makeAnother}
                className="h-11 rounded-md border border-border-strong text-sm font-semibold text-text-primary transition-colors hover:border-orange-500/50"
              >
                Make Another
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {showMobilePreview && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-0 lg:hidden">
          <div className="w-full rounded-t-xl border border-border-subtle bg-bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm text-text-secondary">Live Preview</h3>
              <button
                type="button"
                onClick={() => setShowMobilePreview(false)}
                className="rounded-md border border-border-strong px-2 py-1 text-xs text-text-secondary"
                aria-label="Close payment preview"
              >
                Close
              </button>
            </div>
            <div className="space-y-4">
              <div className="rounded-xl border border-orange-500/30 bg-bg-card p-4">
                <p className="text-xs text-text-secondary">Card 1</p>
                <p className="mt-4 font-mono text-lg text-text-primary">{maskCardNumber(card1.number, "4321")}</p>
              </div>
              <div className="rounded-xl border border-border-strong bg-bg-surface p-4">
                <p className="text-xs text-text-secondary">Card 2</p>
                <p className="mt-4 font-mono text-lg text-text-primary">{maskCardNumber(card2.number, "9012")}</p>
              </div>
              <div className="rounded-md border border-border-subtle bg-bg-card p-4">
                <div className="mb-2 flex items-center justify-between text-xs text-text-secondary">
                  <span>{card1Percent}%</span>
                  <span>{card2Percent}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-bg-elevated">
                  <div className="h-full bg-orange-500" style={{ width: `${card1Percent}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
