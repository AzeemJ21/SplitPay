"use client";

import Link from "next/link";
import { Fragment, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

type Tx = {
  id: string;
  transactionId?: string;
  type: string;
  amount: number;
  card1Amount?: number;
  card2Amount?: number;
  status: string;
  date: string;
  splitCode?: string;
  merchantId?: string;
  note?: string;
};

type Meta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "split_payment", label: "Split Payment" },
  { value: "escrow_funding", label: "Escrow" },
  { value: "escrow_release", label: "Release" },
  { value: "charge_reversal", label: "Card rollback" },
  { value: "refund", label: "Refund" },
  { value: "failed_payment", label: "Failed" },
  { value: "withdrawal", label: "Withdrawal" },
] as const;

function typeBadgeClass(type: string) {
  if (type === "split_payment" || type === "merchant_payout")
    return "border-orange-500/40 bg-orange-500/15 text-orange-300";
  if (type === "escrow_funding") return "border-blue-500/40 bg-blue-500/15 text-blue-300";
  if (type === "escrow_release") return "border-emerald-500/40 bg-emerald-500/15 text-emerald-300";
  if (type === "charge_reversal") return "border-amber-500/40 bg-amber-500/15 text-amber-200";
  if (type === "failed_payment" || type === "refund")
    return "border-red-500/40 bg-red-500/15 text-red-300";
  return "border-border-default bg-bg-card text-text-secondary";
}

function typeLabel(type: string) {
  const row = TYPE_OPTIONS.find((o) => o.value === type);
  if (row?.label && row.value !== "") return row.label;
  if (type === "merchant_payout") return "Merchant payout";
  return type.replace(/_/g, " ");
}

function formatMoney(n: number, opts?: { signed?: boolean }) {
  const abs = Math.abs(n).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (opts?.signed && n < 0) return `−${abs}`;
  if (opts?.signed && n > 0) return `+${abs}`;
  return abs;
}

function signedAmount(tx: Tx): number {
  if (tx.type === "merchant_payout") return -Math.abs(tx.amount);
  if (tx.type === "withdrawal") return -Math.abs(tx.amount);
  if (tx.type === "refund") return -Math.abs(tx.amount);
  if (tx.type === "charge_reversal") return -Math.abs(tx.amount);
  if (tx.status === "failed" || tx.type === "failed_payment") return -Math.abs(tx.amount);
  return Math.abs(tx.amount);
}

function amountClass(tx: Tx) {
  const s = signedAmount(tx);
  if (s < 0) return "text-red-400";
  if (s > 0) return "text-emerald-400";
  return "text-white";
}

function statusPill(status: string) {
  if (status === "completed")
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (status === "failed") return "border-red-500/30 bg-red-500/10 text-red-300";
  return "border-amber-500/30 bg-amber-500/10 text-amber-200";
}

function formatDate(d: string) {
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeCsvField(s: string) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: Tx[]) {
  const headers = [
    "transactionId",
    "type",
    "amount",
    "status",
    "date",
    "splitCode",
    "card1Amount",
    "card2Amount",
    "merchantId",
    "note",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    const row = [
      r.transactionId ?? r.id,
      r.type,
      String(r.amount),
      r.status,
      new Date(r.date).toISOString(),
      r.splitCode ?? "",
      String(r.card1Amount ?? ""),
      String(r.card2Amount ?? ""),
      r.merchantId ?? "",
      r.note ?? "",
    ].map((x) => escapeCsvField(String(x)));
    lines.push(row.join(","));
  }
  return lines.join("\n");
}

export default function TransactionsHistoryPage() {
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const limit = 20;

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Tx[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const filtersActive = useMemo(() => q.trim().length > 0 || typeFilter !== "", [q, typeFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (deferredQ.trim()) params.set("q", deferredQ.trim());
      if (typeFilter) params.set("type", typeFilter);
      const res = await fetch(`/api/transactions?${params.toString()}`);
      if (!res.ok) return;
      const j = (await res.json()) as { data: Tx[]; meta: Meta };
      setRows(j.data ?? []);
      setMeta(j.meta ?? null);
      setPageInput(String(j.meta?.page ?? page));
    } finally {
      setLoading(false);
    }
  }, [page, deferredQ, typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const onExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("export", "1");
      if (q.trim()) params.set("q", q.trim());
      if (typeFilter) params.set("type", typeFilter);
      const res = await fetch(`/api/transactions?${params.toString()}`);
      if (!res.ok) return;
      const j = (await res.json()) as { data: Tx[] };
      const csv = toCsv(j.data ?? []);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `splitpay-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const total = meta?.total ?? 0;
  const totalPages = meta?.totalPages ?? 1;
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  const clearFilters = () => {
    setQ("");
    setTypeFilter("");
    setPage(1);
  };

  const goPage = (p: number) => {
    const next = Math.min(Math.max(1, p), totalPages);
    setPage(next);
  };

  const submitPageInput = () => {
    const p = parseInt(pageInput, 10);
    if (!Number.isFinite(p)) {
      setPageInput(String(page));
      return;
    }
    goPage(p);
    setPageInput(String(Math.min(Math.max(1, p), totalPages)));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-3xl font-bold text-white">Transaction History</h1>
        <button
          type="button"
          onClick={() => void onExport()}
          disabled={exporting}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-border-default bg-transparent px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-orange-500/50 hover:text-orange-400 disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export CSV
        </button>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <input
          type="search"
          placeholder="Search by transaction ID or split code..."
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          className="h-11 w-full rounded-md border border-border-subtle bg-bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-orange-500/50 focus:outline-none md:max-w-md"
        />
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="h-11 w-full rounded-md border border-border-subtle bg-bg-surface px-3 text-sm text-white focus:border-orange-500/50 focus:outline-none md:w-56"
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.label} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border-subtle bg-bg-surface">
        <table className="w-full min-w-[900px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-xs uppercase tracking-wide text-text-muted">
              <th className="px-4 py-3 font-medium">Transaction ID</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <tr key={i} className="border-b border-border-subtle">
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-28" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Skeleton className="ml-auto h-4 w-20" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-36" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-32" />
                    </td>
                  </tr>
                ))}
              </>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16">
                  <div className="flex flex-col items-center justify-center text-center">
                    <ArrowLeftRight className="h-12 w-12 text-text-muted" />
                    <p className="mt-4 font-display text-lg text-white">No transactions found</p>
                    {filtersActive ? (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="mt-4 text-sm font-medium text-orange-500 hover:text-orange-400"
                      >
                        Clear filters
                      </button>
                    ) : (
                      <Link
                        href="/payments/new"
                        className="mt-4 text-sm font-medium text-orange-500 hover:text-orange-400"
                      >
                        Make a split payment
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((tx) => (
                <Fragment key={tx.id}>
                  <tr
                    onClick={() => setExpanded((x) => (x === tx.id ? null : tx.id))}
                    className={cn(
                      "cursor-pointer border-b border-border-subtle transition-colors hover:bg-bg-card/50",
                    )}
                  >
                    <td className="max-w-[200px] px-4 py-3">
                      <span
                        className="block truncate font-mono text-xs text-text-secondary"
                        title={tx.transactionId ?? tx.id}
                      >
                        {tx.transactionId ?? tx.id}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-xs capitalize",
                          typeBadgeClass(tx.type),
                        )}
                      >
                        {typeLabel(tx.type)}
                      </span>
                    </td>
                    <td className={cn("px-4 py-3 text-right font-display font-bold", amountClass(tx))}>
                      {formatMoney(signedAmount(tx), { signed: true })}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-text-secondary">{formatDate(tx.date)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            tx.status === "completed"
                              ? "bg-emerald-400"
                              : tx.status === "failed"
                                ? "bg-red-400"
                                : "bg-amber-400",
                          )}
                        />
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-xs capitalize",
                            statusPill(tx.status),
                          )}
                        >
                          {tx.status}
                        </span>
                      </span>
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-text-secondary" title={tx.note}>
                      {tx.note ?? "—"}
                    </td>
                  </tr>
                  {expanded === tx.id ? (
                    <tr key={`${tx.id}-detail`} className="border-b border-border-subtle bg-bg-base">
                      <td colSpan={6} className="px-4 py-4">
                        <dl className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
                          <div>
                            <dt className="text-text-muted">Internal ID</dt>
                            <dd className="font-mono text-text-secondary">{tx.id}</dd>
                          </div>
                          <div>
                            <dt className="text-text-muted">Split code</dt>
                            <dd className="font-mono text-text-secondary">{tx.splitCode ?? "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-text-muted">Card 1 amount</dt>
                            <dd className="text-white">{tx.card1Amount ?? "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-text-muted">Card 2 amount</dt>
                            <dd className="text-white">{tx.card2Amount ?? "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-text-muted">Merchant ID</dt>
                            <dd className="break-all text-text-secondary">{tx.merchantId ?? "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-text-muted">Note</dt>
                            <dd className="text-text-secondary">{tx.note ?? "—"}</dd>
                          </div>
                        </dl>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && rows.length > 0 ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-text-muted">
            Showing{" "}
            <span className="text-white">
              {start}–{end}
            </span>{" "}
            of <span className="text-white">{total}</span> transactions
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => goPage(page - 1)}
              className="inline-flex h-9 items-center rounded-md border border-border-default px-3 text-sm text-white disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="flex items-center gap-2 text-sm text-text-secondary">
              Page
              <input
                type="text"
                inputMode="numeric"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={() => submitPageInput()}
                onKeyDown={(e) => e.key === "Enter" && submitPageInput()}
                className="h-9 w-12 rounded border border-border-default bg-bg-surface text-center text-sm text-white"
              />
              of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => goPage(page + 1)}
              className="inline-flex h-9 items-center rounded-md border border-border-default px-3 text-sm text-white disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
