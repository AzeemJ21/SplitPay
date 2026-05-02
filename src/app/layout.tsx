import type { Metadata } from "next";
import { bodyFont, displayFont } from "@/lib/fonts";
import { PageTransition } from "@/components/ui/page-transition";
import { AuthSessionProvider } from "@/components/providers/AuthSessionProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "SplitPay",
  description: "Multi-card payment splitting and milestone funding platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${bodyFont.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-bg-base font-body text-text-primary antialiased">
        <AuthSessionProvider>
          <ThemeProvider>
            <PageTransition>{children}</PageTransition>
            <div className="fixed bottom-20 right-4 z-[90] md:bottom-4">
              <ThemeToggle />
            </div>
          </ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
