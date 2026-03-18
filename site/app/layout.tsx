import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const sans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "Ora — Speech Interface Runtime",
  description:
    "Lightweight TypeScript runtime for tokenization, timing estimation, and playback tracking. The coordination layer for speech interfaces.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "Ora — Speech Interface Runtime",
    description:
      "Lightweight TypeScript runtime for tokenization, timing estimation, and playback tracking.",
    type: "website",
    url: siteUrl,
    siteName: "Ora",
    images: [{ url: "/og.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ora — Speech Interface Runtime",
    description:
      "Lightweight TypeScript runtime for tokenization, timing estimation, and playback tracking.",
    images: ["/og.png"],
  },
  other: {
    "theme-color": "#0a0e14",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${display.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
