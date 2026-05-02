"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, ChevronDown } from "lucide-react";

type NavItem = {
  id: string;
  label: string;
};

const navItems: NavItem[] = [
  { id: "authentication", label: "Authentication" },
  { id: "split-payments", label: "Split Payments" },
  { id: "users", label: "Users" },
  { id: "milestones", label: "Milestones" },
  { id: "transactions", label: "Transactions" },
  { id: "webhooks", label: "Webhooks" },
  { id: "errors", label: "Errors" },
];

const requestRows = [
  { name: "user_id", type: "string", required: "Yes", description: "Unique SplitPay user identifier" },
  { name: "amount", type: "number", required: "Yes", description: "Total payment amount to split" },
  { name: "card_1_amount", type: "number", required: "Yes", description: "Portion charged to card 1" },
  { name: "card_2_amount", type: "number", required: "Yes", description: "Portion charged to card 2" },
  { name: "currency", type: "string", required: "Yes", description: "ISO currency code (e.g. USD)" },
  { name: "split_code", type: "string", required: "Yes", description: "4-digit permanent split code" },
];

const errorRows = [
  { code: "400", message: "Validation error", description: "Missing required fields or invalid amounts" },
  { code: "401", message: "Unauthorized", description: "Bearer token missing or invalid" },
  { code: "409", message: "Split mismatch", description: "Card amounts do not sum to total amount" },
  { code: "500", message: "Internal error", description: "Unexpected processing error on SplitPay side" },
];

const responseTemplate = `{
  "id": "tx_9a10f4",
  "status": "success",
  "split_code": "4821",
  "amount": 500,
  "card_1_amount": 300,
  "card_2_amount": 200,
  "currency": "USD",
  "created_at": "2026-04-30T20:22:10.443Z"
}`;

function CodeBlock({
  children,
  copyText,
}: {
  children: React.ReactNode;
  copyText: string;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="relative rounded-lg border border-border-subtle bg-bg-elevated p-4">
      <button
        type="button"
        onClick={onCopy}
        className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md border border-border-strong px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
      >
        <Copy className="h-3.5 w-3.5" />
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="overflow-x-auto pr-14 text-sm leading-6 text-text-primary">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function MethodPill({ method }: { method: "POST" | "GET" | "DELETE" }) {
  const className =
    method === "POST"
      ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
      : method === "GET"
        ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
        : "bg-red-500/20 text-red-300 border-red-500/40";

  return <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${className}`}>{method}</span>;
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("split-payments");
  const [tryOpen, setTryOpen] = useState(false);
  const [typingResponse, setTypingResponse] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [form, setForm] = useState({
    user_id: "usr_123",
    amount: "500",
    card_1_amount: "300",
    card_2_amount: "200",
    currency: "USD",
    split_code: "4821",
  });
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;

    const sections = root.querySelectorAll("section[id]");
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0.2, 0.5, 0.9] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const curlExample = useMemo(
    () =>
      `curl -X POST https://api.splitpay.io/v1/split-payment \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{ "user_id": "${form.user_id}", "amount": ${form.amount}, "card_1_amount": ${form.card_1_amount}, "card_2_amount": ${form.card_2_amount}, "currency": "${form.currency}", "split_code": "${form.split_code}" }'`,
    [form],
  );

  const sendRequest = () => {
    setIsSending(true);
    setTypingResponse("");
    let index = 0;
    const timer = window.setInterval(() => {
      index += 2;
      setTypingResponse(responseTemplate.slice(0, index));
      if (index >= responseTemplate.length) {
        window.clearInterval(timer);
        setIsSending(false);
      }
    }, 20);
  };

  return (
    <div className="bg-bg-base text-text-primary">
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-6 px-4 py-8 lg:grid-cols-[240px_minmax(0,720px)_220px] lg:px-8">
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <p className="mb-3 text-xs uppercase tracking-wide text-text-muted">Endpoints</p>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={`block border-l-2 py-1.5 pl-3 text-sm transition-colors ${
                  activeSection === item.id
                    ? "border-orange-500 text-orange-400"
                    : "border-transparent text-text-secondary hover:text-text-primary"
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        <main ref={contentRef} className="space-y-10">
          <div className="rounded-lg border border-orange-500/20 bg-orange-500/10 p-4 text-sm">
            <p className="text-orange-300">API Version: v1.0</p>
            <p className="mt-1 text-text-secondary">Sandbox Base URL: https://sandbox.splitpay.io/v1</p>
          </div>

          <section id="authentication" className="space-y-3">
            <h1 className="font-display text-3xl text-text-primary">Authentication</h1>
            <p className="text-sm text-text-secondary">
              All SplitPay API calls require a bearer token. Include your API key in the Authorization header.
            </p>
            <CodeBlock copyText={`Authorization: Bearer sk_live_xxxxx`}>
              <span className="text-orange-400">Authorization</span>
              <span className="text-text-muted">: </span>
              <span className="text-green-400">Bearer sk_live_xxxxx</span>
            </CodeBlock>
          </section>

          <section id="split-payments" className="space-y-4">
            <div className="flex items-center gap-3">
              <MethodPill method="POST" />
              <h2 className="font-display text-2xl text-text-primary">/api/split-payment</h2>
            </div>
            <p className="text-sm text-text-secondary">
              Creates a single transaction split across two cards. Use this endpoint to power checkout, escrow funding,
              and milestone allocation in one request.
            </p>

            <div className="overflow-hidden rounded-lg border border-border-subtle">
              <table className="min-w-full text-sm">
                <thead className="bg-bg-surface text-left text-text-muted">
                  <tr>
                    <th className="sticky left-0 bg-bg-surface px-4 py-3 font-medium">Param</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Required</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {requestRows.map((row, index) => (
                    <tr key={row.name} className={index % 2 === 0 ? "bg-bg-card" : "bg-bg-surface"}>
                      <td className="sticky left-0 bg-bg-card px-4 py-3 font-mono text-orange-300">{row.name}</td>
                      <td className="px-4 py-3 text-text-secondary">{row.type}</td>
                      <td className="px-4 py-3 text-text-secondary">{row.required}</td>
                      <td className="px-4 py-3 text-text-secondary">{row.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <CodeBlock copyText={curlExample}>
              <span className="text-text-primary">curl -X POST https://api.splitpay.io/v1/split-payment \</span>
              {"\n"}
              <span className="text-text-primary">  -H </span>
              <span className="text-green-400">"Authorization: Bearer sk_live_..."</span>
              {" \\\n"}
              <span className="text-text-primary">  -H </span>
              <span className="text-green-400">"Content-Type: application/json"</span>
              {" \\\n"}
              <span className="text-text-primary">  -d </span>
              <span className="text-green-400">
                '{`{ "user_id": "usr_123", "amount": 500, "card_1_amount": 300, "card_2_amount": 200, ... }`}'
              </span>
            </CodeBlock>

            <CodeBlock copyText={responseTemplate}>
              <span className="text-text-muted">{"{"}</span>
              {"\n  "}
              <span className="text-orange-400">"id"</span>
              <span className="text-text-muted">: </span>
              <span className="text-green-400">"tx_9a10f4"</span>
              <span className="text-text-muted">,</span>
              {"\n  "}
              <span className="text-orange-400">"status"</span>
              <span className="text-text-muted">: </span>
              <span className="text-green-400">"success"</span>
              <span className="text-text-muted">,</span>
              {"\n  "}
              <span className="text-orange-400">"split_code"</span>
              <span className="text-text-muted">: </span>
              <span className="text-green-400">"4821"</span>
              <span className="text-text-muted">,</span>
              {"\n  "}
              <span className="text-orange-400">"amount"</span>
              <span className="text-text-muted">: 500</span>
              {"\n"}
              <span className="text-text-muted">{"}"}</span>
            </CodeBlock>

            <div className="overflow-hidden rounded-lg border border-border-subtle">
              <table className="min-w-full text-sm">
                <thead className="bg-bg-surface text-left text-text-muted">
                  <tr>
                    <th className="sticky left-0 bg-bg-surface px-4 py-3 font-medium">Code</th>
                    <th className="px-4 py-3 font-medium">Error</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {errorRows.map((row, index) => (
                    <tr key={row.code} className={index % 2 === 0 ? "bg-bg-card" : "bg-bg-surface"}>
                      <td className="sticky left-0 bg-bg-card px-4 py-3 text-orange-300">{row.code}</td>
                      <td className="px-4 py-3 text-text-secondary">{row.message}</td>
                      <td className="px-4 py-3 text-text-secondary">{row.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-border-subtle bg-bg-surface">
              <button
                type="button"
                onClick={() => setTryOpen((value) => !value)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <span className="text-sm font-semibold text-text-primary">Try it out</span>
                <ChevronDown
                  className={`h-4 w-4 text-text-secondary transition-transform ${tryOpen ? "rotate-180" : ""}`}
                />
              </button>

              {tryOpen && (
                <div className="space-y-4 border-t border-border-subtle p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {requestRows.map((row) => (
                      <label key={row.name} className="text-xs text-text-secondary">
                        {row.name}
                        <input
                          value={form[row.name as keyof typeof form]}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              [row.name]: event.target.value,
                            }))
                          }
                          className="mt-1 h-10 w-full rounded-md border border-border-default bg-bg-card px-3 text-sm text-text-primary outline-none focus:border-orange-500"
                        />
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={sendRequest}
                    disabled={isSending}
                    className="h-10 rounded-md border border-orange-600 bg-orange-500 px-4 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-80"
                  >
                    {isSending ? "Sending..." : "Send Request"}
                  </button>
                  <CodeBlock copyText={typingResponse || responseTemplate}>
                    <span className="text-green-400 whitespace-pre-wrap">
                      {typingResponse || '{ "status": "ready" }'}
                    </span>
                  </CodeBlock>
                </div>
              )}
            </div>
          </section>

          <section id="users" className="space-y-3">
            <h2 className="font-display text-2xl text-text-primary">Users</h2>
            <p className="text-sm text-text-secondary">Create and manage SplitPay identities and split codes.</p>
          </section>

          <section id="milestones" className="space-y-3">
            <h2 className="font-display text-2xl text-text-primary">Milestones</h2>
            <p className="text-sm text-text-secondary">Fund, track, and release project milestones via escrow flows.</p>
          </section>

          <section id="transactions" className="space-y-3">
            <h2 className="font-display text-2xl text-text-primary">Transactions</h2>
            <p className="text-sm text-text-secondary">Inspect split transaction history with filtering and status metadata.</p>
          </section>

          <section id="webhooks" className="space-y-3">
            <h2 className="font-display text-2xl text-text-primary">Webhooks</h2>
            <p className="text-sm text-text-secondary">Subscribe to payment, milestone, and escrow lifecycle events.</p>
          </section>

          <section id="errors" className="space-y-3">
            <h2 className="font-display text-2xl text-text-primary">Errors</h2>
            <p className="text-sm text-text-secondary">Standardized error envelopes and retry strategies for resilient clients.</p>
          </section>
        </main>

        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-lg border border-border-subtle bg-bg-surface p-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-text-muted">On This Page</p>
            <div className="space-y-1">
              {navItems.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`block text-sm transition-colors ${
                    activeSection === item.id ? "text-orange-400" : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
