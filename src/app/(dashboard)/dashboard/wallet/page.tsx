"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, Wallet } from "lucide-react";
import { WithdrawModal } from "@/components/modals/WithdrawModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

type FundTx = {
  id: string;
  type: string;
  amount: number;
  status: string;
  date: string;
  merchantId?: string;
};

function formatMoney(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function typeLabel(t: string) {
  if (t === "split_payment") return "Split payment (store)";
  if (t === "escrow_release") return "Escrow release";
  if (t === "escrow_funding") return "Escrow funding";
  return t.replace(/_/g, " ");
}

export default function WalletPage() {
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [fundedTotal, setFundedTotal] = useState(0);
  const [rows, setRows] = useState<FundTx[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setTxLoading(true);
    try {
      const [rDash, rTx] = await Promise.all([
        fetch("/api/dashboard-stats", { cache: "no-store" }),
        fetch(
          "/api/transactions?types=split_payment,escrow_release,escrow_funding&status=completed&limit=50",
          { cache: "no-store" },
        ),
      ]);
      if (rDash.ok) {
        const j = (await rDash.json()) as {
          data: { walletBalance: number; fundedSplitPayVolume: number };
        };
        setBalance(j.data?.walletBalance ?? 0);
        setFundedTotal(j.data?.fundedSplitPayVolume ?? 0);
      }
      if (rTx.ok) {
        const j = (await rTx.json()) as { data: FundTx[] };
        setRows(j.data ?? []);
      }
    } finally {
      setLoading(false);
      setTxLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
            Wallet
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Funded payments from SplitPay store and escrow — withdraw via PayPal or Stripe (simulated).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setWithdrawOpen(true)}
          disabled={loading || balance <= 0}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowDownLeft className="h-4 w-4" />
          Payout
        </button>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-xl border border-border-subtle bg-bg-surface p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Spendable balance</p>
          {loading ? (
            <Skeleton className="mt-3 h-10 w-40" />
          ) : (
            <p className="mt-2 font-display text-3xl text-text-primary">{formatMoney(balance)}</p>
          )}
          <p className="mt-2 text-xs text-text-muted">
            Matches your{" "}
            <Link href="/dashboard/virtual-card" className="text-orange-400 underline hover:text-orange-300">
              virtual card
            </Link>
            . Store payments settle here until you withdraw.
          </p>
        </article>
        <article className="rounded-xl border border-border-subtle bg-bg-surface p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Total funded (SplitPay store)
          </p>
          {loading ? (
            <Skeleton className="mt-3 h-10 w-40" />
          ) : (
            <p className="mt-2 font-display text-3xl text-orange-400">{formatMoney(fundedTotal)}</p>
          )}
          <p className="mt-2 text-xs text-text-muted">
            Sum of completed split checkouts linked to your Split Code. If this is $0 but you paid on the store,
            confirm the store and dashboard use the same MongoDB database and the same 4-digit code.
          </p>
        </article>
      </section>

      <section className="rounded-xl border border-border-subtle bg-bg-surface p-5">
        <h2 className="font-display text-lg font-semibold text-text-primary">Funded activity</h2>
        <p className="mt-1 text-sm text-text-muted">Split payments and escrow funding/releases.</p>
        {txLoading ? (
          <div className="mt-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-8 py-8">
            <EmptyState
              icon={Wallet}
              title="No funded payments yet"
              description="Complete a checkout on the SplitPay store with your Split Code, then refresh."
            />
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-border-subtle">
            {rows.map((tx) => (
              <li key={tx.id} className="flex flex-wrap items-center gap-3 py-4 first:pt-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary">{typeLabel(tx.type)}</p>
                  <p className="text-xs text-text-muted">
                    {new Date(tx.date).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                    {tx.merchantId ? ` · ${tx.merchantId}` : ""}
                  </p>
                </div>
                <span className="font-display text-lg text-emerald-400">+{formatMoney(tx.amount)}</span>
              </li>
            ))}
          </ul>
        )}
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
