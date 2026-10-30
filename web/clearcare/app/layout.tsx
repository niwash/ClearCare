import type { Metadata } from "next";
import { IBM_Plex_Mono, Public_Sans, Source_Serif_4 } from "next/font/google";
import { LeavingSiteDialog } from "@/components/layout/leaving-site-dialog";
import { SLIDE_UP_SCRIPT } from "@/components/home/slide-up-script";
import { APPLY_SAVED_THEME_SCRIPT } from "@/components/theme/theme";
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
      suppressHydrationWarning // the head's scripts set data-theme, data-design and data-slide-up before React hydrates
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPLY_SAVED_THEME_SCRIPT }} />
        {/* After the theme script, which it reads for the design. */}
        <script dangerouslySetInnerHTML={{ __html: SLIDE_UP_SCRIPT }} />
      </head>
      {/* overflow-x-clip: a full-width band (100vw) includes the scrollbar on Windows, which would
          otherwise let the page scroll sideways. Clip, not hidden, so sticky positioning still works. */}
      <body className="flex min-h-full flex-col overflow-x-clip font-sans">
        {children}
        <LeavingSiteDialog />
      </body>
    </html>
  );
}
