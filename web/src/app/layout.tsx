import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { ThemeSync } from "@/components/theme-sync";

// Chosen at build time; see src/proxy.ts. "clerk" mounts the Clerk provider,
// anything else keeps the localStorage demo auth.
const clerkEnabled = (process.env.NEXT_PUBLIC_AUTH_PROVIDER ?? "demo") === "clerk";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ChainTrack",
    template: "%s · ChainTrack",
  },
  description:
    "Blockchain-backed shipping tracking with smart-contract escrow, cross-border crypto payments, and AI-assisted logistics.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Nonce set by src/proxy.ts for the style-src/script-src CSP directive; the
  // theme bootstrap below is the only app-authored inline script.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const tree = (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("chaintrack-theme");var d=t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`,
          }}
        />
        <ThemeSync />
        <SiteHeader />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t py-6">
          <p className="mx-auto max-w-5xl px-4 text-center text-xs text-muted-foreground">
            ChainTrack — blockchain ledger · smart-contract escrow · cross-border crypto payments
          </p>
        </footer>
      </body>
    </html>
  );

  return clerkEnabled ? <ClerkProvider dynamic>{tree}</ClerkProvider> : tree;
}