import type { Metadata } from "next";
import { IBM_Plex_Mono, Public_Sans, Source_Serif_4 } from "next/font/google";
import { APPLY_SAVED_THEME_SCRIPT } from "@/components/theme";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "ClearCare",
  description: "ClearCare is an interactive web application that makes HIQA nursing home inspection reports easier to search, understand, track, and compare. It ingests publicly available HIQA inspection PDFs, extracts regulation-level compliance judgements, and presents each nursing home’s compliance history in a structured format.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sourceSerif.variable} ${publicSans.variable} ${plexMono.variable} h-full antialiased`}
      suppressHydrationWarning // the theme script sets data-theme before React hydrates
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPLY_SAVED_THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
