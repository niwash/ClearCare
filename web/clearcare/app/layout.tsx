import type { Metadata } from "next";
import { IBM_Plex_Mono, Public_Sans, Source_Serif_4 } from "next/font/google";
import { LeavingSiteDialog } from "@/components/layout/leaving-site-dialog";
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

// The social preview (CCARE-185): the logo with its tagline on the header's blue.
const SHARE_IMAGE = { url: "/logos/og-image.png", width: 1200, height: 630, alt: "ClearCare: Nursing home inspections made clear" };

export const metadata: Metadata = {
  // The live site, so the social preview image gets the absolute URL it needs.
  metadataBase: new URL("https://clearcare.ie"),
  title: "ClearCare",
  icons: {
    icon: [
      { url: "/logos/favicon.svg", type: "image/svg+xml" },
      { url: "/logos/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/logos/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/logos/apple-touch-icon.png",
  },
  // Only what every page shares: no title or description here, as nested fields aren't merged with
  // a page's, so these would replace every page's own in a shared link. Each page's title and
  // description are used instead.
  openGraph: {
    type: "website",
    siteName: "ClearCare",
    images: [SHARE_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    images: [SHARE_IMAGE],
  },
  description: "ClearCare is an interactive web application that makes HIQA nursing home inspection reports easier to search, understand, track, and compare. It ingests publicly available HIQA inspection PDFs, extracts regulation-level compliance judgements, and presents each nursing home’s compliance history in a structured format.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sourceSerif.variable} ${publicSans.variable} ${plexMono.variable} h-full antialiased`}
      suppressHydrationWarning // the theme script sets data-theme and data-design before React hydrates
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPLY_SAVED_THEME_SCRIPT }} />
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
