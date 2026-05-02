import { DM_Sans, Syne } from "next/font/google";

export const displayFont = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
});

export const bodyFont = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});
