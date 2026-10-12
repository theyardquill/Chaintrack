"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Loader2, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { linkWalletAddress, type LinkedWallet } from "@/lib/link-wallet";

interface MeResponse {
  user?: {
    _id: string;
    name: string;
    email?: string;
    phone: string;
    role: string;
    wallets: LinkedWallet[];
  };
  error?: string;
}

function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function WalletLinkCard() {
  const { isSignedIn } = useAuth();
  const [wallets, setWallets] = useState<LinkedWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const body = (await res.json().catch(() => ({}))) as MeResponse;
        if (!active) return;
        if (!res.ok) {
          setError(body.error ?? `failed to load profile (${res.status})`);
        } else {
          setWallets(body.user?.wallets ?? []);
          setError(null);
        }
      } catch {
        if (active) setError("network error");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [isSignedIn]);

  const connectWallet = useCallback(async () => {
    setError(null);
    setLinking(true);
    try {
      const { wallets: linked } = await linkWalletAddress();
      setWallets(linked);
    } catch (e) {
      setError(e instanceof Error ? e.message : "wallet linking failed");
    } finally {
      setLinking(false);
    }
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Linked wallets</CardTitle>
        <CardDescription>
          Link an Ethereum wallet to your account. Ownership is proven with a signed
          message (EIP-4361 / SIWE) — no private keys leave your wallet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : wallets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No wallets linked yet.</p>
        ) : (
          <ul className="space-y-2">
            {wallets.map((w) => (
              <li
                key={w.address}
                className="flex items-center gap-3 rounded-md border px-3 py-2"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm">{short(w.address)}</p>
                  <p className="text-xs text-muted-foreground">
                    chain {w.chainId} · linked{" "}
                    {new Date(w.verifiedAt).toLocaleDateString()}
                  </p>
                </div>
                {w.isPrimary && <Badge variant="outline">Primary</Badge>}
              </li>
            ))}
          </ul>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button onClick={connectWallet} disabled={linking}>
          {linking ? <Loader2 className="animate-spin" /> : <Wallet />} Link wallet
        </Button>
      </CardContent>
    </Card>
  );
}
