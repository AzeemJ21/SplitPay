"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Key,
  Link2,
  RefreshCw,
  Store,
} from "lucide-react";

const FALLBACK_BASE = "https://your-domain.com";

function buildCodeExamples(base: string) {
  const b = base || FALLBACK_BASE;
  return {
    curl: `curl -X POST ${b}/api/split-payment \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "splitCode": "4821",
    "totalAmount": 199.99,
    "card1": {
      "number": "4242424242424242",
      "expiry": "12/28",
      "cvv": "123",
      "amount": 100.00
    },
    "card2": {
      "number": "5555555555554444",
      "expiry": "09/27",
      "cvv": "456",
      "amount": 99.99
    },
    "merchantId": "store_order_123"
  }'`,
    javascript: `const res = await fetch("${b}/api/split-payment", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    splitCode: "4821",
    totalAmount: 199.99,
    card1: {
      number: "4242424242424242",
      expiry: "12/28",
      cvv: "123",
      amount: 100.0,
    },
    card2: {
      number: "5555555555554444",
      expiry: "09/27",
      cvv: "456",
      amount: 99.99,
    },
    merchantId: "store_order_123",
  }),
});

const data = await res.json();`,
    python: `import requests

r = requests.post(
    "${b}/api/split-payment",
    headers={
        "Authorization": "Bearer YOUR_API_KEY",
        "Content-Type": "application/json",
    },
    json={
        "splitCode": "4821",
        "totalAmount": 199.99,
        "card1": {
            "number": "4242424242424242",
            "expiry": "12/28",
            "cvv": "123",
            "amount": 100.00,
        },
        "card2": {
            "number": "5555555555554444",
            "expiry": "09/27",
            "cvv": "456",
            "amount": 99.99,
        },
        "merchantId": "store_order_123",
    },
)

print(r.json())`,
  };
}

type Tab = "curl" | "javascript" | "python";

function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative rounded-lg border border-border-subtle bg-bg-base">
      <button
        type="button"
        onClick={() => void copy()}
        className="absolute right-3 top-3 inline-flex items-center gap-1 rounded border border-border-default bg-bg-card px-2 py-1 text-xs text-text-secondary transition-colors hover:border-orange-500/40 hover:text-text-primary"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
      <pre
        className="max-h-[420px] overflow-auto p-4 pt-12 font-mono text-xs leading-relaxed text-text-primary"
        aria-label={label}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

function ApiKeyPanel() {
  const [maskedKey, setMaskedKey] = useState<string>("—");
  const [calls, setCalls] = useState(0);
  const [limit, setLimit] = useState(10000);
  const [loading, setLoading] = useState(true);
  const [regenOpen, setRegenOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [plainKeyOnce, setPlainKeyOnce] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/api-key");
      const j = (await res.json()) as {
        data?: { maskedKey: string; callsThisMonth: number; limit: number };
      };
      if (j.data) {
        setMaskedKey(j.data.maskedKey);
        setCalls(j.data.callsThisMonth);
        setLimit(j.data.limit);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const copyMasked = async () => {
    await navigator.clipboard.writeText(maskedKey);
  };

  const regenerate = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/api-key", { method: "POST" });
      const j = (await res.json()) as { data?: { key?: string } };
      if (res.ok && j.data?.key) {
        setPlainKeyOnce(j.data.key);
        await load();
      }
    } finally {
      setBusy(false);
      setRegenOpen(false);
    }
  };

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface p-6">
      <div className="flex items-center gap-2 text-text-primary">
        <Key className="h-5 w-5 text-orange-500" />
        <h2 className="font-display text-lg font-semibold">API key</h2>
      </div>
      <p className="mt-1 text-xs text-text-muted">Use in Authorization header for server-side calls.</p>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-border-subtle bg-bg-base px-3 py-2 font-mono text-sm text-text-primary">
        <span className="min-w-0 flex-1 truncate">{loading ? "Loading…" : maskedKey}</span>
        <button
          type="button"
          onClick={() => void copyMasked()}
          className="shrink-0 rounded border border-border-default p-1.5 text-text-secondary hover:text-text-primary"
          aria-label="Copy masked key"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setRegenOpen(true)}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md border border-orange-600/50 bg-orange-500/10 px-3 py-2 text-sm font-medium text-orange-400 hover:bg-orange-500/20 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
          Regenerate
        </button>
      </div>

      <div className="mt-6 rounded-lg border border-border-subtle bg-bg-card px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-text-muted">Usage this month</p>
        <p className="mt-1 font-display text-2xl text-text-primary">
          {calls.toLocaleString()} <span className="text-base font-normal text-text-muted">/ {limit.toLocaleString()}</span>
        </p>
      </div>

      {plainKeyOnce ? (
        <div
          className="mt-4 rounded-lg border border-orange-500/40 bg-orange-500/10 p-4 text-sm text-orange-100"
          role="status"
        >
          <p className="font-semibold">New key (copy now)</p>
          <p className="mt-2 break-all font-mono text-xs">{plainKeyOnce}</p>
          <button
            type="button"
            className="mt-3 text-xs underline"
            onClick={() => {
              void navigator.clipboard.writeText(plainKeyOnce);
            }}
          >
            Copy to clipboard
          </button>
        </div>
      ) : null}

      {regenOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-border-subtle bg-bg-card p-6 shadow-xl">
            <p className="font-display text-lg text-text-primary">Regenerate API key?</p>
            <p className="mt-2 text-sm text-text-secondary">
              Your current key stops working immediately. Update any integrations using the old key.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRegenOpen(false)}
                className="rounded-md border border-border-default px-4 py-2 text-sm text-text-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void regenerate()}
                className="rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-black"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function DashboardApiPage() {
  const [tab, setTab] = useState<Tab>("curl");
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(typeof window !== "undefined" ? window.location.origin : "");
  }, []);
  const examples = useMemo(() => buildCodeExamples(origin), [origin]);

  return (
    <div className="space-y-12">
      <header>
        <h1 className="font-display text-3xl font-bold text-text-primary">SplitPay API Integration</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">
          Let your customers split any payment across two cards at checkout
        </p>
        {origin ? (
          <p className="mt-2 max-w-2xl text-xs text-text-muted">
            Examples use this dashboard origin:{" "}
            <span className="font-mono text-text-secondary">{origin}</span>. Discovery:{" "}
            <a
              href={`${origin}/api/integration`}
              className="text-orange-400 underline hover:text-orange-300"
              target="_blank"
              rel="noopener noreferrer"
            >
              GET /api/integration
            </a>{" "}
            (JSON for your store env).
          </p>
        ) : null}
      </header>

      <section className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <div className="space-y-6">
          <article className="rounded-xl border border-border-subtle bg-bg-surface p-6">
            <h2 className="font-display text-lg font-semibold text-text-primary">How It Works</h2>
            <ol className="mt-5 space-y-4">
              <li className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500/15 font-display text-sm font-bold text-orange-500">
                  1
                </span>
                <div className="flex gap-3">
                  <Store className="mt-0.5 h-5 w-5 shrink-0 text-orange-500/80" />
                  <div>
                    <p className="font-medium text-text-primary">Customer selects SplitPay at checkout</p>
                    <p className="text-sm text-text-muted">Your storefront offers SplitPay as a payment method.</p>
                  </div>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500/15 font-display text-sm font-bold text-orange-500">
                  2
                </span>
                <div className="flex gap-3">
                  <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-orange-500/80" />
                  <div>
                    <p className="font-medium text-text-primary">Enters their unique SplitPay code</p>
                    <p className="text-sm text-text-muted">The customer&apos;s 4-digit SplitPay identity.</p>
                  </div>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500/15 font-display text-sm font-bold text-orange-500">
                  3
                </span>
                <div className="flex gap-3">
                  <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-orange-500/80" />
                  <div>
                    <p className="font-medium text-text-primary">Enters Card 1 + Card 2 details and amounts</p>
                    <p className="text-sm text-text-muted">Amounts must add up to the order total.</p>
                  </div>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500/15 font-display text-sm font-bold text-orange-500">
                  4
                </span>
                <div className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-orange-500/80" />
                  <div>
                    <p className="font-medium text-text-primary">SplitPay charges both cards and transfers funds</p>
                    <p className="text-sm text-text-muted">Funds route to your merchant settlement flow.</p>
                  </div>
                </div>
              </li>
            </ol>
          </article>

          <article className="rounded-xl border border-border-subtle bg-bg-surface p-6">
            <h2 className="font-display text-lg font-semibold text-text-primary">Validation Rules</h2>
            <ul className="mt-4 space-y-3 text-sm text-text-secondary">
              {[
                "Card 1 amount + Card 2 amount must equal checkout total exactly",
                "Both cards must be charged successfully",
                "Failed charge triggers automatic refund of successful card",
                "No partial payments allowed",
              ].map((rule) => (
                <li key={rule} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>

        <ApiKeyPanel />
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold text-text-primary">Code integration examples</h2>
        <p className="mt-1 text-sm text-text-muted">
          POST /api/split-payment — replace YOUR_API_KEY. Domain updates automatically when this page is opened on your
          live dashboard.
        </p>

        <div className="mt-4 flex flex-wrap gap-2 border-b border-border-subtle pb-2">
          {(
            [
              ["curl", "cURL"] as const,
              ["javascript", "JavaScript"] as const,
              ["python", "Python"] as const,
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id as Tab)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === id
                  ? "bg-orange-500 text-black"
                  : "text-text-secondary hover:bg-bg-card hover:text-text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {tab === "curl" ? <CodeBlock code={examples.curl} label="cURL example" /> : null}
          {tab === "javascript" ? <CodeBlock code={examples.javascript} label="JavaScript example" /> : null}
          {tab === "python" ? <CodeBlock code={examples.python} label="Python example" /> : null}
        </div>
      </section>
    </div>
  );
}
