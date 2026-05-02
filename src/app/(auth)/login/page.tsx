"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/dashboard",
    });

    setIsSubmitting(false);

    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }

    window.location.href = "/dashboard";
  };

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
          “SplitPay gave us the fastest path to launch two-card checkout with full milestone
          control and escrow logic.”
          <footer className="mt-3 text-text-primary">- Payment Ops, Nova Contractor Cloud</footer>
        </blockquote>
      </aside>

      <section className="w-full md:w-1/2 flex items-center justify-center p-6 bg-bg-base">
        <div className="w-full max-w-md">
          <h2 className="font-display text-3xl font-bold text-text-primary">Welcome back</h2>
          <p className="mt-2 text-sm text-text-secondary">Sign in to your SplitPay workspace</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
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
                className="h-11 w-full rounded-md border border-border-default bg-bg-card px-3 text-sm outline-none transition-colors focus:border-orange-500"
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
                className="h-11 w-full rounded-md border border-border-default bg-bg-card px-3 text-sm outline-none transition-colors focus:border-orange-500"
              />
            </div>

            <div className="flex justify-end">
              <Link href="#" className="text-sm text-text-secondary hover:text-text-primary">
                Forgot password?
              </Link>
            </div>

            {error ? <p className="text-sm text-orange-400">{error}</p> : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="h-11 w-full rounded-md bg-orange-500 text-sm font-semibold text-black transition-colors hover:bg-orange-600 disabled:opacity-70"
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="mt-8 text-sm text-text-secondary">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-orange-400 hover:text-orange-300">
              Register
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
