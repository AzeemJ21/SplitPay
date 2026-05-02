import Link from "next/link";

const SECTIONS = [
  {
    title: "1. Overview",
    body: `SplitPay is a Final Year Project prototype. This platform simulates fintech payment infrastructure for demonstration purposes only. No real money is processed.`,
  },
  {
    title: "2. Payment Simulation",
    body: `All payment processing on SplitPay is simulated. Card numbers entered are not charged. Virtual card balances are fictional. No real banking transactions occur.`,
  },
  {
    title: "3. Escrow Rules",
    body: `Funds displayed in escrow are simulated balances. The escrow workflow (fund → submit → approve → release) demonstrates how a real escrow system would operate.`,
  },
  {
    title: "4. Milestone & Payment Holding",
    body: `Milestone funds are held in simulated escrow for the duration of project work. Auto-release occurs 5 days after work submission if the client does not manually approve.`,
  },
  {
    title: "5. Dispute Handling",
    body: `Users may raise disputes for project disagreements. Disputes are reviewed using AI-assisted analysis of project chat history and submitted evidence. All dispute resolutions are final within the platform.`,
  },
  {
    title: "6. Data & Privacy",
    body: `User data is stored securely in a MongoDB database. Passwords are hashed using bcrypt. No payment card data is stored — all card inputs are used only for simulation.`,
  },
  {
    title: "7. Contact",
    body: `This is an academic project. For queries: fyp-splitpay@university.edu (replace with your university email).`,
  },
] as const;

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <div className="mx-auto max-w-[720px] px-4 py-10 md:px-6 md:py-14">
        <Link
          href="/"
          className="text-sm text-orange-500 transition-colors duration-150 hover:text-orange-400 active:scale-[0.97]"
        >
          ← Back to home
        </Link>
        <header className="mt-8 border-b border-border-subtle pb-8">
          <h1 className="font-display text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
            Terms &amp; Policies
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">
            Last updated for the SplitPay academic prototype. Please read these terms before using the platform.
          </p>
        </header>
        <article className="prose prose-invert mt-10 max-w-none">
          {SECTIONS.map((s) => (
            <section key={s.title} className="mb-10 last:mb-0">
              <h2 className="font-display text-xl font-bold tracking-tight text-text-primary">{s.title}</h2>
              <p className="mt-3 text-base leading-[1.7] text-text-secondary">{s.body}</p>
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
