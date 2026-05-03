"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { WithdrawModal } from "@/components/modals/WithdrawModal";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

type CardApi = {
  maskedNumber: string;
  expiryMonth: number;
  expiryYear: number;
  currency: string;
};

type TxRow = {
  id: string;
  type: string;
  amount: number;
  status: string;
  date: string;
};

function formatMoney(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function typeLabel(t: string) {
  if (t === "split_payment") return "Split payment";
  if (t === "merchant_payout") return "Merchant payout";
  if (t === "charge_reversal") return "Card rollback";
  if (t === "refund") return "Refund";
  if (t === "escrow_release") return "Escrow release";
  if (t === "failed_payment") return "Failed payment";
  if (t === "withdrawal") return "Withdrawal";
  return t.replace(/_/g, " ");
}

type WithdrawalRow = {
  id: string;
  transactionRef: string;
  method: string;
  amount: number;
  status: string;
  createdAt: string;
};

function methodLabel(m: string) {
  if (m === "paypal") return "PayPal";
  if (m === "stripe") return "Stripe";
  if (m === "bank_transfer") return "Bank transfer";
  return m;
}

function withdrawalStatusBadge(status: string) {
  if (status === "completed")
    return "border-emerald-500/40 bg-emerald-500/15 text-emerald-300";
  if (status === "failed") return "border-red-500/40 bg-red-500/15 text-red-300";
  return "border-amber-500/40 bg-amber-500/15 text-amber-200";
}

function ChipIcon() {
  return (
    <svg width="44" height="32" viewBox="0 0 44 32" className="shrink-0" aria-hidden>
      <title>Card chip</title>
      <rect x="1" y="1" width="42" height="30" rx="4" fill="url(#chipGrid)" stroke="rgba(255,255,255,0.2)" />
      <defs>
        <pattern id="chipGrid" width="7" height="5" patternUnits="userSpaceOnUse">
          <rect width="6" height="4" x="0.5" y="0.5" fill="rgba(255,255,255,0.08)" rx="0.5" />
        </pattern>
      </defs>
    </svg>
  );
}

export default function VirtualCardPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<CardApi | null>(null);
  const [balance, setBalance] = useState(0);
  const [totalReceived, setTotalReceived] = useState(0);
  const [totalPaidOut, setTotalPaidOut] = useState(0);
  const [holder, setHolder] = useState("");
  const [tx, setTx] = useState<TxRow[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [wLoading, setWLoading] = useState(true);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
      setTxLoading(true);
      setWLoading(true);
    }
    try {
      const [rCard, rTx, rW] = await Promise.all([
        fetch("/api/virtual-card", { cache: "no-store" }),
        fetch("/api/transactions?type=virtual_card&limit=5", { cache: "no-store" }),
        fetch("/api/withdrawals?limit=20", { cache: "no-store" }),
      ]);
      if (rCard.ok) {
        const j = (await rCard.json()) as {
          data: {
            card: CardApi;
            balance: number;
            totalReceived: number;
            totalPaidOut: number;
            holderName: string;
          };
        };
        setCard(j.data.card);
        setBalance(j.data.balance);
        setTotalReceived(j.data.totalReceived);
        setTotalPaidOut(j.data.totalPaidOut);
        setHolder(j.data.holderName);
      }
      if (rTx.ok) {
        const j = (await rTx.json()) as { data: TxRow[] };
        setTx(j.data ?? []);
      }
      if (rW.ok) {
        const j = (await rW.json()) as { data: WithdrawalRow[] };
        setWithdrawals(j.data ?? []);
      }
    } finally {
      if (!opts?.silent) {
        setLoading(false);
        setTxLoading(false);
        setWLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load({ silent: true });
    }, 10_000);
    return () => window.clearInterval(id);
  }, [load]);

  const expStr =
    card != null
      ? `${String(card.expiryMonth).padStart(2, "0")}/${String(card.expiryYear).slice(-2)}`
      : "—/—";

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-3xl font-bold text-text-primary">Virtual Card</h1>
        <p className="mt-1 text-sm text-text-muted">Your SplitPay virtual card and activity</p>
      </header>

      <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-center">
        <div
          className="relative w-full max-w-[380px] overflow-hidden rounded-2xl border border-orange-500/25 shadow-[0_0_40px_-8px_rgba(249,115,22,0.35)]"
          style={{
            aspectRatio: "380 / 220",
            minHeight: "220px",
            background:
              "linear-gradient(145deg, #0f0f12 0%, #1a1410 45%, #0a0a0c 100%), radial-gradient(ellipse at top right, rgba(249,115,22,0.18), transparent 55%), radial-gradient(ellipse at bottom left, rgba(249,115,22,0.12), transparent 50%)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            }}
          />
          <div className="relative flex h-full flex-col p-6 text-white">
            <div className="flex items-start justify-between">
              <span className="font-display text-sm font-bold tracking-tight text-white/90">SplitPay</span>
              <ChipIcon />
            </div>
            <div className="flex flex-1 items-center">
              {loading ? (
                <Skeleton className="h-8 w-full max-w-[280px]" />
              ) : (
                <p
                  className="font-mono text-lg tracking-[0.2em] text-white sm:text-xl"
                  style={{ letterSpacing: "0.2em" }}
                >
                  {card?.maskedNumber ?? "•••• •••• •••• ••••"}
                </p>
              )}
            </div>
            <div className="flex items-end justify-between gap-4 text-xs">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Virtual card</p>
                <p className="mt-1 font-medium text-white/90">{session?.user?.name ?? holder ?? "Cardholder"}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-white/50">Expires</p>
                <p className="mt-1 font-mono text-sm">{expStr}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full max-w-md space-y-4">
          <div className="flex flex-col gap-4 rounded-xl border border-border-subtle bg-bg-surface p-6 sm:flex-row sm:items-end sm:justify-between">
            {loading ? (
              <Skeleton className="h-16 w-48" />
            ) : (
              <div>
                <p className="font-display text-[48px] leading-none text-text-primary">{formatMoney(balance)}</p>
                <p className="mt-2 text-sm text-text-muted">Available Balance</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => setWithdrawOpen(true)}
              disabled={loading}
              className="shrink-0 rounded-lg border-2 border-orange-500 bg-transparent px-5 py-2.5 text-sm font-semibold text-orange-500 transition-colors hover:bg-orange-500/10 disabled:opacity-40"
            >
              Withdraw
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-border-subtle bg-bg-base p-4 text-sm">
            <div>
              <p className="text-xs text-text-muted">Total Received</p>
              <p className="mt-1 font-medium text-text-secondary">
                {loading ? "—" : formatMoney(totalReceived)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Total Paid Out</p>
              <p className="mt-1 font-medium text-text-secondary">
                {loading ? "—" : formatMoney(totalPaidOut)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <section>
        <h2 className="font-display text-lg font-semibold text-text-primary">Withdrawal history</h2>
        <p className="mt-1 text-xs text-text-muted">FYP — simulated withdrawal requests only</p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border-subtle bg-bg-surface">
          {wLoading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : withdrawals.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-text-muted">No withdrawals yet</p>
          ) : (
            <table className="w-full min-w-[600px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-xs uppercase tracking-wide text-text-muted">
                  <th className="px-4 py-3 font-medium">Ref #</th>
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id} className="border-b border-border-subtle last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">{w.transactionRef}</td>
                    <td className="px-4 py-3 text-text-primary">{methodLabel(w.method)}</td>
                    <td className="px-4 py-3 font-display text-text-primary">{formatMoney(w.amount)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-0.5 text-xs capitalize",
                          withdrawalStatusBadge(w.status),
                        )}
                      >
                        {w.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {new Date(w.createdAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-text-primary">Recent card transactions</h2>
        <p className="mt-1 text-xs text-text-muted">Last 5 virtual-card–related movements</p>
        <div className="mt-4 rounded-xl border border-border-subtle bg-bg-surface">
          {txLoading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : tx.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-text-muted">No transactions yet</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {tx.map((row) => {
                const signed =
                  row.type === "merchant_payout" || row.type === "withdrawal" ? -row.amount : row.amount;
                return (
                  <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-card">
                      {signed >= 0 ? (
                        <ArrowDownLeft className="h-4 w-4 text-green-400" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 text-orange-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-text-primary">{typeLabel(row.type)}</p>
                      <p className="text-xs text-text-muted">
                        {new Date(row.date).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                    <span
                      className={`font-display text-sm ${signed >= 0 ? "text-green-400" : "text-orange-300"}`}
                    >
                      {signed >= 0 ? "+" : "−"}
                      {formatMoney(Math.abs(signed))}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs capitalize ${
                        row.status === "completed"
                          ? "border-green-500/30 bg-green-500/10 text-green-300"
                          : row.status === "failed"
                            ? "border-red-500/30 bg-red-500/10 text-red-300"
                            : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
                      }`}
                    >
                      {row.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <WithdrawModal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        balance={balance}
        onSuccess={() => void load()}
      />
    </div>
  );
}
