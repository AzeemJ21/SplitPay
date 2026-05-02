import { DM_Sans, Syne } from "next/font/google";

/** Syne: disable preload to avoid duplicate font preload warnings with DM Sans (both were link-preloaded). */
export const displayFont = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  preload: false,
});

export const bodyFont = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});
