"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Link2,
  LogIn,
  LogOut,
  Menu,
  RadioTower,
  ScanLine,
  Send,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { useChainTrack } from "@/lib/chain";
import { useAuth } from "@/lib/use-auth";
import { cn } from "cn";

const NAV = [
  { href: "/track", label: "Track", icon: ScanLine },
  { href: "/ship", label: "Ship", icon: Send },
  { href: "/checkpoint", label: "Checkpoint", icon: RadioTower },
  { href: "/admin", label: "Admin", icon: ShieldCheck },
];

function WalletButton() {
  const { wallet, connectWallet } = useChainTrack();
  return wallet ? (
    <Button variant="outline" className="font-mono">
      <Wallet /> {wallet.slice(0, 6)}…{wallet.slice(-4)}
    </Button>
  ) : (
    <Button
      onClick={connectWallet}
      className="bg-primary text-primary-foreground hover:bg-primary/90"
    >
      <Wallet /> Connect wallet
    </Button>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const { session, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  const NavLink = ({ href, label, icon: Icon }: (typeof NAV)[number]) => {
    const active = pathname.startsWith(href);
    return (
      <Link
        href={href}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm",
          active ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60"
        )}
      >
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
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
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm",
                  active ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60"
                )}
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
          <ThemeToggle />

          {session ? (
            <div className="hidden items-center gap-2 sm:flex">
              {session.type === "admin" ? (
                <Link href="/admin">
                  <Badge className="font-normal">
                    <ShieldCheck className="h-3.5 w-3.5" /> Admin
                  </Badge>
                </Link>
              ) : (
                <Link href={session.user.role === "AGENT" ? "/agent" : "/dashboard"}>
                  <Badge className="font-normal hover:bg-primary/90">
                    {session.user.name}
                    <span className="text-white/70">· {session.user.role}</span>
                  </Badge>
                </Link>
              )}
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut /> Sign out
              </Button>
            </div>
          ) : (
            <Link href="/login" className="hidden sm:inline-flex">
              <Button variant="outline" size="sm">
                <LogIn /> Sign in
              </Button>
            </Link>
          )}

          <WalletButton />

          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-md border sm:hidden"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div
          id="mobile-nav"
          className="border-t bg-background sm:hidden"
        >
          <nav className="mx-auto max-w-5xl space-y-1 px-4 py-3">
            {NAV.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
            <Separator className="my-2" />

            <div className="flex flex-col gap-1">
              {session ? (
                <>
                  <Link
                    href={session.type === "admin" ? "/admin" : session.user.role === "AGENT" ? "/agent" : "/dashboard"}
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-1 text-sm font-medium text-primary hover:underline"
                  >
                    {session.type === "admin"
                      ? "Admin console"
                      : `${session.user.name} · ${session.user.role}`}
                  </Link>
                  <button
                    type="button"
                    onClick={signOut}
                    className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted/60"
                >
                  <LogIn className="h-4 w-4" /> Sign in
                </Link>
              )}
              <Link
                href="/agent/login"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted/60"
              >
                <RadioTower className="h-4 w-4" /> Agent sign in
              </Link>
            </div>

            <Separator className="my-2" />
          </nav>
        </div>
      )}
    </header>
  );
}