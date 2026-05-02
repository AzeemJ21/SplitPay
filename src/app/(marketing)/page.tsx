"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import {
  Check,
  Clock3,
  Code2,
  Copy,
  Cpu,
  CreditCard,
  Flag,
  Hash,
  Layers,
  Shield,
  UserPlus2,
  Wallet2,
} from "lucide-react";

const navLinks = [
  { label: "Docs", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "Features", href: "#features" },
];

const stats = [
  {
    icon: CreditCard,
    title: "2 Cards / 1 Transaction",
    description: "Split one checkout flow across two active payment methods.",
  },
  {
    icon: Cpu,
    title: "API-First Architecture",
    description: "Production-ready APIs built for fast, reliable integrations.",
  },
  {
    icon: Flag,
    title: "Escrow + Milestone Ready",
    description: "Designed for staged releases and trust-based payouts.",
  },
];

const featureCards = [
  {
    icon: CreditCard,
    title: "Two-Card Split",
    description: "Divide any amount across two cards in one API call",
  },
  {
    icon: Hash,
    title: "Permanent Split Code",
    description: "Each user gets a unique code that links all transactions",
  },
  {
    icon: Layers,
    title: "Milestone Funding",
    description: "Fund freelancer milestones using split payments",
  },
  {
    icon: Shield,
    title: "Escrow System",
    description: "Funds held securely until client approval",
  },
  {
    icon: Clock3,
    title: "Transaction History",
    description: "Full audit trail linked to each split code",
  },
  {
    icon: Code2,
    title: "API Integration",
    description: "Drop-in REST API with clear docs and sandbox mode",
  },
];

const steps = [
  {
    icon: UserPlus2,
    title: "Register & Get Split Code",
    description: "Create your account and receive a permanent split identifier.",
  },
  {
    icon: Wallet2,
    title: "Add Two Cards",
    description: "Attach two cards to the user profile and set split preferences.",
  },
  {
    icon: CreditCard,
    title: "Make Payment",
    description: "Send one payment request through SplitPay from your checkout.",
  },
  {
    icon: Flag,
    title: "Funds Split Instantly",
    description: "Funds route to each card and ledger instantly with full tracking.",
  },
];

const pricingPlans = [
  {
    name: "Starter",
    price: "Free",
    details: "100 API calls / mo",
    features: ["Up to 100 monthly API calls", "Sandbox environment", "Basic webhook logs"],
    cta: "Start Free",
    featured: false,
  },
  {
    name: "Growth",
    price: "$49/mo",
    details: "10k calls",
    features: [
      "Up to 10,000 monthly API calls",
      "Priority API throughput",
      "Escrow + milestone modules",
    ],
    cta: "Choose Growth",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    details: "Tailored scale",
    features: ["Unlimited volume pricing", "Dedicated success support", "Private deployment options"],
    cta: "Talk to Sales",
    featured: false,
  },
];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay, ease: "easeOut" as any },
  }),
};

export default function MarketingPage() {
  const [hasScrolled, setHasScrolled] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setHasScrolled(window.scrollY > 60);
    };

    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const copySnippet = async () => {
    const text = `POST /api/split-payment
{
  "splitCode": "SPT-A91K2",
  "amount": 12000,
  "currency": "USD",
  "cardA": { "token": "tok_card_a", "amount": 7200 },
  "cardB": { "token": "tok_card_b", "amount": 4800 }
}`;

    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="bg-bg-base text-text-primary">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72' viewBox='0 0 72 72'%3E%3Cg fill='none' stroke='%23F97316' stroke-opacity='0.5' stroke-width='0.7'%3E%3Cpath d='M0 0H72'/%3E%3Cpath d='M0 24H72'/%3E%3Cpath d='M0 48H72'/%3E%3Cpath d='M0 72H72'/%3E%3Cpath d='M0 0V72'/%3E%3Cpath d='M24 0V72'/%3E%3Cpath d='M48 0V72'/%3E%3Cpath d='M72 0V72'/%3E%3C/g%3E%3C/svg%3E\")",
            backgroundSize: "72px 72px",
          }}
        />
        <motion.div
          className="absolute left-1/2 top-[38%] h-[1200px] w-[1200px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
          animate={{ x: [0, 24, -18, 0], y: [0, -16, 12, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          style={{
            background:
              "radial-gradient(circle, rgba(234,88,12,0.08) 0 50%, rgba(234,88,12,0) 50%)",
          }}
        />
      </div>

      <header
        className={`sticky top-0 z-50 h-[60px] bg-bg-surface/80 backdrop-blur-md transition-colors ${
          hasScrolled ? "border-b border-border-subtle" : ""
        }`}
      >
        <nav className="mx-auto flex h-full w-full max-w-7xl items-center justify-between px-6 md:px-8">
          <a href="#" className="font-display text-[22px] font-bold tracking-tight">
            <span className="text-text-primary">Split</span>
            <span className="text-orange-500">Pay</span>
          </a>

          <div className="flex items-center gap-5 md:gap-7">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="hidden text-sm text-text-secondary transition-colors hover:text-text-primary sm:inline"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/login"
              className="hidden text-sm text-text-secondary transition-colors hover:text-text-primary sm:inline"
            >
              Login
            </Link>
            <a
              href="#pricing"
              className="border border-orange-500 px-3 py-2 text-sm font-medium text-orange-500 transition-colors hover:bg-orange-500 hover:text-bg-base"
            >
              Get API Access
            </a>
          </div>
        </nav>
      </header>

      <main className="relative z-10">
        <section className="flex min-h-[calc(100vh-60px)] items-center justify-center px-6 py-16 md:px-8">
          <div className="mx-auto w-full max-w-5xl">
            <motion.h1
              custom={0.1}
              initial="hidden"
              animate="show"
              variants={fadeUp}
              className="font-display text-[40px] font-extrabold leading-[1.05] tracking-tight md:text-[72px]"
            >
              <span className="block text-text-primary">Split Any Payment.</span>
              <span className="block text-orange-500">Across Two Cards.</span>
            </motion.h1>

            <motion.p
              custom={0.2}
              initial="hidden"
              animate="show"
              variants={fadeUp}
              className="mt-8 max-w-[520px] font-body text-[18px] leading-relaxed text-text-secondary"
            >
              SplitPay lets users divide a single transaction across two payment
              cards - via API. Integrate in minutes. Scale without limits.
            </motion.p>

            <motion.div
              custom={0.3}
              initial="hidden"
              animate="show"
              variants={fadeUp}
              className="mt-10 flex flex-wrap items-center gap-3"
            >
              <a
                href="#pricing"
                className="border border-orange-600 bg-orange-500 px-5 py-2.5 font-body text-sm font-semibold text-bg-base transition-colors hover:bg-orange-400"
              >
                Get API Access
              </a>
              <a
                href="#how-it-works"
                className="border border-border-strong bg-transparent px-5 py-2.5 font-body text-sm font-semibold text-text-primary transition-colors hover:border-orange-600 hover:text-orange-400"
              >
                View Docs
              </a>
            </motion.div>
          </div>
        </section>

        <section className="border-y border-border-subtle bg-bg-surface">
          <div className="mx-auto grid w-full max-w-7xl gap-0 md:grid-cols-3">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.title}
                  className={`px-6 py-6 md:px-8 ${
                    index < stats.length - 1 ? "md:border-r md:border-border-subtle" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-orange-500" />
                    <p className="font-body text-sm font-semibold text-text-primary">
                      {stat.title}
                    </p>
                  </div>
                  <p className="mt-2 max-w-sm font-body text-sm text-text-muted">
                    {stat.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="features" className="mx-auto w-full max-w-7xl px-6 py-20 md:px-8">
          <h2 className="font-display text-[32px] font-bold leading-tight text-text-primary md:text-[40px]">
            Everything you need to split payments
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {featureCards.map((card) => {
              const Icon = card.icon;
              return (
                <article
                  key={card.title}
                  className="group border border-border-subtle bg-bg-card p-6 transition-colors hover:border-orange-500/40"
                >
                  <div className="inline-flex border border-border-subtle bg-bg-elevated p-2">
                    <Icon className="h-5 w-5 text-orange-500 transition-transform duration-200 group-hover:scale-110" />
                  </div>
                  <h3 className="mt-4 font-body text-lg font-semibold text-text-primary">
                    {card.title}
                  </h3>
                  <p className="mt-2 font-body text-sm text-text-secondary">
                    {card.description}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="how-it-works" className="mx-auto w-full max-w-7xl px-6 py-20 md:px-8">
          <h2 className="font-display text-[32px] font-bold text-text-primary md:text-[40px]">
            How it works
          </h2>
          <div className="mt-12 grid gap-6 lg:grid-cols-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="relative border border-border-subtle bg-bg-card p-5">
                  <span className="pointer-events-none absolute right-4 top-2 font-display text-[64px] font-bold leading-none text-orange-500/10">
                    {index + 1}
                  </span>
                  <Icon className="relative z-10 h-5 w-5 text-orange-500" />
                  <h3 className="relative z-10 mt-4 font-body text-base font-semibold text-text-primary">
                    {step.title}
                  </h3>
                  <p className="relative z-10 mt-2 text-sm text-text-secondary">
                    {step.description}
                  </p>
                  {index < steps.length - 1 && (
                    <div className="absolute -right-3 top-1/2 hidden h-px w-6 -translate-y-1/2 bg-orange-500/30 lg:block" />
                  )}
                </div>
              );
            })}
          </div>

          <div className="relative mt-14 border border-border-subtle bg-bg-card p-6 md:p-8">
            <button
              type="button"
              onClick={copySnippet}
              className="absolute right-4 top-4 inline-flex items-center gap-2 border border-border-strong px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-orange-600 hover:text-text-primary"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </button>
            <pre className="overflow-x-auto font-mono text-sm leading-7">
              <code>
                <span className="text-text-muted">POST /api/split-payment</span>
                {"\n"}
                <span className="text-text-muted">{"{"}</span>
                {"\n  "}
                <span className="text-orange-500">"splitCode"</span>
                <span className="text-text-muted">: </span>
                <span className="text-green-400">"SPT-A91K2"</span>
                <span className="text-text-muted">,</span>
                {"\n  "}
                <span className="text-orange-500">"amount"</span>
                <span className="text-text-muted">: 12000,</span>
                {"\n  "}
                <span className="text-orange-500">"currency"</span>
                <span className="text-text-muted">: </span>
                <span className="text-green-400">"USD"</span>
                <span className="text-text-muted">,</span>
                {"\n  "}
                <span className="text-orange-500">"cardA"</span>
                <span className="text-text-muted">: {"{"} </span>
                <span className="text-orange-500">"token"</span>
                <span className="text-text-muted">: </span>
                <span className="text-green-400">"tok_card_a"</span>
                <span className="text-text-muted">, </span>
                <span className="text-orange-500">"amount"</span>
                <span className="text-text-muted">: 7200 {"}"},</span>
                {"\n  "}
                <span className="text-orange-500">"cardB"</span>
                <span className="text-text-muted">: {"{"} </span>
                <span className="text-orange-500">"token"</span>
                <span className="text-text-muted">: </span>
                <span className="text-green-400">"tok_card_b"</span>
                <span className="text-text-muted">, </span>
                <span className="text-orange-500">"amount"</span>
                <span className="text-text-muted">: 4800 {"}"}</span>
                {"\n"}
                <span className="text-text-muted">{"}"}</span>
              </code>
            </pre>
          </div>
        </section>

        <section id="pricing" className="mx-auto w-full max-w-7xl px-6 py-20 md:px-8">
          <h2 className="font-display text-[32px] font-bold text-text-primary md:text-[40px]">
            Pricing
          </h2>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {pricingPlans.map((plan) => (
              <article
                key={plan.name}
                className={`relative border bg-bg-card p-6 ${
                  plan.featured
                    ? "border-orange-500 shadow-[0_0_0_1px_rgba(249,115,22,0.2)]"
                    : "border-border-subtle"
                }`}
              >
                {plan.featured && (
                  <span className="absolute -top-3 left-6 border border-orange-500 bg-bg-base px-2 py-1 text-xs font-semibold text-orange-400">
                    Most Popular
                  </span>
                )}
                <h3 className="font-body text-lg font-semibold">{plan.name}</h3>
                <p className="mt-3 font-display text-4xl font-bold text-text-primary">{plan.price}</p>
                <p className="mt-1 text-sm text-text-secondary">{plan.details}</p>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-text-secondary">
                      <Check className="mt-0.5 h-4 w-4 text-orange-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`mt-8 w-full border px-4 py-2 text-sm font-semibold transition-colors ${
                    plan.featured
                      ? "border-orange-600 bg-orange-500 text-bg-base hover:bg-orange-400"
                      : "border-border-strong text-text-primary hover:border-orange-600 hover:text-orange-400"
                  }`}
                >
                  {plan.cta}
                </button>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border-subtle bg-bg-surface">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-14 md:grid-cols-4 md:px-8">
          <div>
            <p className="font-display text-[22px] font-bold tracking-tight">
              <span className="text-text-primary">Split</span>
              <span className="text-orange-500">Pay</span>
            </p>
            <p className="mt-3 text-sm text-text-secondary">
              API-native payment splitting infrastructure for modern fintech products.
            </p>
          </div>
          <div>
            <p className="font-body text-sm font-semibold text-text-primary">Product</p>
            <ul className="mt-3 space-y-2 text-sm text-text-secondary">
              <li>
                <a href="#features" className="hover:text-text-primary">
                  Features
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-text-primary">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-text-primary">
                  Pricing
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-body text-sm font-semibold text-text-primary">Company</p>
            <ul className="mt-3 space-y-2 text-sm text-text-secondary">
              <li>
                <a href="#" className="hover:text-text-primary">
                  About
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-text-primary">
                  Security
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-text-primary">
                  Careers
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-body text-sm font-semibold text-text-primary">Contact</p>
            <ul className="mt-3 space-y-2 text-sm text-text-secondary">
              <li>support@splitpay.dev</li>
              <li>sales@splitpay.dev</li>
              <li>+1 (415) 555-0192</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border-subtle">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-6 py-4 text-xs text-text-muted md:flex-row md:items-center md:justify-between md:px-8">
            <span>Copyright © {new Date().getFullYear()} SplitPay</span>
            <span>Built for modern payment infrastructure</span>
          </div>
        </div>
      </footer>

      {copied && (
        <div className="toast-success">
          API snippet copied
        </div>
      )}
    </div>
  );
}
