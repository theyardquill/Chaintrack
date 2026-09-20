"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Link2, RadioTower, ScanLine, Send, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useChainTrack } from "@/lib/chain";

const NAV = [
  { href: "/track", label: "Track", icon: ScanLine },
  { href: "/ship", label: "Ship", icon: Send },
  { href: "/checkpoint", label: "Checkpoint", icon: RadioTower },
  { href: "/admin", label: "Admin", icon: ShieldCheck },
];

export function SiteHeader({ onWalletClick }: { onWalletClick?: () => void }) {
  const pathname = usePathname();
  const { wallet, connectWallet } = useChainTrack();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Link2 className="h-4 w-4" />
          </span>
          ChainTrack
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {NAV.map(({ href, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  active ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className="hidden md:inline-flex">
            Demo mode
          </Badge>
          {wallet ? (
            <Badge className="font-mono">{wallet.slice(0, 6)}…{wallet.slice(-4)}</Badge>
          ) : (
            <button
              onClick={onWalletClick ?? connectWallet}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted/60"
            >
              Connect wallet
            </button>
          )}
        </div>
      </div>
    </header>
  );
}