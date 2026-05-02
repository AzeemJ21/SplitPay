"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

function formatRegisterApiError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const o = error as { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> };
    const parts: string[] = [];
    if (Array.isArray(o.formErrors)) parts.push(...o.formErrors.filter(Boolean));
    if (o.fieldErrors && typeof o.fieldErrors === "object") {
      for (const [field, msgs] of Object.entries(o.fieldErrors)) {
        if (msgs?.length) parts.push(`${field}: ${msgs.join(", ")}`);
      }
    }
    if (parts.length) return parts.join(" ");
  }
  return "Failed to register.";
}

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [splitCode, setSplitCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const splitCodePreview = useMemo(() => splitCode.padEnd(4, "X"), [splitCode]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!/^\d{4}$/.test(splitCode)) {
      setError("Split code must be exactly 4 digits.");
      return;
    }

    if (!agreedToTerms) {
      setError("Please agree to the Terms & Policies to continue.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName,
          email,
          password,
          splitCode,
        }),
      });

      const data = (await response.json()) as {
        error?: string | { formErrors: string[]; fieldErrors: Record<string, string[] | undefined> };
      };

      if (!response.ok) {
        setError(formatRegisterApiError(data.error));
        return;
      }

      setIsSubmitting(false);
      setIsSigningIn(true);

      const signResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (signResult?.error) {
        setIsSigningIn(false);
        setError("Account created but sign-in failed. Please log in manually.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Unable to create your account right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const busy = isSubmitting || isSigningIn;

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden">
      <aside className="hidden md:flex md:w-1/2 flex-col justify-between p-10 bg-bg-surface border-r border-border-subtle relative overflow-hidden text-text-primary">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-tight">
            <span className="text-text-primary">Split</span>
            <span className="text-orange-500">Pay</span>
          </h1>
        </div>
        <div className="absolute inset-0 flex items-center justify-center text-[120px] font-black text-white/5 select-none pointer-events-none leading-none">
          SplitPay
        </div>
        <blockquote className="relative z-10 max-w-md text-sm text-text-secondary">
          “The split code system gave our merchants permanent transaction identity and clean
          auditing across every milestone.”
          <footer className="mt-3 text-text-primary">- Platform Lead, Arc Payment Studio</footer>
        </blockquote>
      </aside>

      <section className="w-full md:w-1/2 flex items-center justify-center p-6 bg-bg-base">
        <div className="w-full max-w-md">
          <h2 className="font-display text-3xl font-bold text-text-primary">Create your account</h2>
          <p className="mt-2 text-sm text-text-secondary">Set up your SplitPay access in minutes</p>

          <form onSubmit={onSubmit} className="mt-7 space-y-4">
            <div>
              <label htmlFor="fullName" className="mb-2 block text-sm text-text-secondary">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                disabled={busy}
                className="h-11 w-full rounded-md border border-border-default bg-bg-card px-3 text-sm outline-none transition-colors focus:border-orange-500 disabled:opacity-60"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-2 block text-sm text-text-secondary">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy}
                className="h-11 w-full rounded-md border border-border-default bg-bg-card px-3 text-sm outline-none transition-colors focus:border-orange-500 disabled:opacity-60"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm text-text-secondary">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy}
                className="h-11 w-full rounded-md border border-border-default bg-bg-card px-3 text-sm outline-none transition-colors focus:border-orange-500 disabled:opacity-60"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="mb-2 block text-sm text-text-secondary">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={busy}
                className="h-11 w-full rounded-md border border-border-default bg-bg-card px-3 text-sm outline-none transition-colors focus:border-orange-500 disabled:opacity-60"
              />
            </div>

            <div className="rounded-md border border-border-subtle bg-bg-surface p-4">
              <label htmlFor="splitCode" className="mb-2 block text-sm font-medium text-text-primary">
                SplitPay Code
              </label>
              <input
                id="splitCode"
                type="text"
                inputMode="numeric"
                maxLength={4}
                required
                value={splitCode}
                onChange={(event) =>
                  setSplitCode(event.target.value.replace(/\D/g, "").slice(0, 4))
                }
                disabled={busy}
                className="h-14 w-full rounded-md border border-border-default bg-bg-card px-3 text-center font-mono text-[28px] tracking-[0.3em] outline-none transition-colors focus:border-orange-500 disabled:opacity-60"
              />
              <p className="mt-2 text-xs text-text-secondary">
                This permanent code links all your transactions. Choose wisely.
              </p>
              <p className="mt-3 font-mono text-sm text-orange-400">
                Your split code: #{splitCodePreview}
              </p>
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="terms"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                disabled={busy}
                className="mt-1 h-4 w-4 cursor-pointer accent-orange-500"
              />
              <label htmlFor="terms" className="cursor-pointer text-sm leading-relaxed text-[#A1A1A1]">
                I agree to the{" "}
                <a href="/terms" target="_blank" rel="noreferrer" className="text-orange-500 hover:underline">
                  Terms &amp; Policies
                </a>{" "}
                of SplitPay. I understand this is a simulated platform for educational purposes.
              </label>
            </div>

            {error ? <p className="text-sm text-orange-400">{error}</p> : null}

            {isSigningIn ? (
              <div className="flex items-center gap-2 text-sm text-orange-400">
                <Loader2 className="h-5 w-5 animate-spin text-orange-500" aria-hidden />
                <span>Setting up your account...</span>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={busy || !agreedToTerms}
              title={!agreedToTerms ? "Please agree to Terms & Policies to continue" : undefined}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-orange-500 text-sm font-semibold text-black transition-all duration-150 hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.97]"
            >
              {isSubmitting && !isSigningIn ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : isSigningIn ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Setting up your account...
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <p className="mt-8 text-sm text-text-secondary">
            Already have an account?{" "}
            <Link href="/login" className="text-orange-400 hover:text-orange-300">
              Log in
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
