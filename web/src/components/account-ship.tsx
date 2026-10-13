"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy, Send } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ChainStatus } from "@/components/chain-status";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useChainContract } from "@/lib/use-chain-contract";
import { chainGetUserByAddress } from "@/lib/web3";
import type { Role } from "@/lib/types";

const SIZES = ["S", "M", "L", "XL"];

interface MeResponse {
  user?: { appUserId: number | null; name: string; role: Role; wallets: { address: string; isPrimary: boolean }[] };
  error?: string;
}

interface DirectoryEntry {
  id: number;
  name: string;
  role: Role;
  wallet?: string;
  onChainUserId: number | null;
}

function genCode(): string {
  return `CTK-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function hasInjectedWallet(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean((window as unknown as { ethereum?: unknown }).ethereum)
  );
}

export function AccountShip() {
  const { isLoaded, isSignedIn } = useAuth();
  const chain = useChainContract();

  const [me, setMe] = useState<MeResponse["user"] | null>(null);
  const [receivers, setReceivers] = useState<DirectoryEntry[]>([]);
  const [receiverId, setReceiverId] = useState("");
  const [content, setContent] = useState("");
  const [weight, setWeight] = useState("1");
  const [size, setSize] = useState("M");
  const [amount, setAmount] = useState("0.1");
  const [deliveryCode, setDeliveryCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [booked, setBooked] = useState<{ qrHash: string; txHash?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [recordOnChain, setRecordOnChain] = useState(false);

  const qrHash = useMemo(() => genCode(), []);

  useEffect(() => {
    if (!isSignedIn) return;
    let active = true;
    void (async () => {
      try {
        const [meRes, dirRes] = await Promise.all([
          fetch("/api/auth/me", { cache: "no-store" }),
          fetch("/api/users?role=RECEIVER", { cache: "no-store" }),
        ]);
        const meBody = (await meRes.json().catch(() => ({}))) as MeResponse;
        const dirBody = (await dirRes.json().catch(() => ({}))) as { users?: DirectoryEntry[] };
        if (!active) return;
        const user = meBody.user ?? null;
        setMe(user);
        // Only default to on-chain escrow when the account already has a wallet;
        // otherwise book off-chain so the demo works without MetaMask.
        const linkedWallet =
          user?.wallets.find((w) => w.isPrimary)?.address ?? user?.wallets[0]?.address;
        setRecordOnChain(Boolean(linkedWallet) && hasInjectedWallet());
        setReceivers(dirBody.users ?? []);
        if (dirBody.users?.[0]) setReceiverId(String(dirBody.users[0].id));
      } catch {
        if (active) setError("could not load sender/receiver data");
      }
    })();
    return () => {
      active = false;
    };
  }, [isSignedIn]);

  if (!isLoaded) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!isSignedIn) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Please sign in.</div>;
  }
  if (me && me.role !== "SENDER") {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-20 text-center text-sm text-muted-foreground">
        <p>Only senders can book shipments. Set your role on the account page.</p>
        <Link href="/account" className="text-primary hover:underline">
          Go to account
        </Link>
      </div>
    );
  }

  const primaryWallet = me?.wallets.find((w) => w.isPrimary)?.address ?? me?.wallets[0]?.address;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setProgress(null);
    setBusy(true);
    try {
      if (!me || me.appUserId == null) throw new Error("your account is not ready yet");
      if (me.role !== "SENDER") throw new Error("set your role to sender first");
      const receiver = receivers.find((r) => r.id === Number(receiverId));
      if (!receiver) throw new Error("pick a receiver");
      if (!content.trim()) throw new Error("describe the package contents");
      if (deliveryCode.trim().length < 4) throw new Error("delivery code must be at least 4 characters");
      if (Number(amount) <= 0) throw new Error("escrow amount must be greater than zero");
      if (recordOnChain && !receiver.wallet) {
        throw new Error("that receiver has not linked a wallet yet");
      }

      let chainMeta:
        | { chainId: string; contract: string; onChainId: number; txHash?: string }
        | undefined;

      if (recordOnChain) {
        if (!primaryWallet) throw new Error("link a wallet on the account page first");
        // Connect the wallet and resolve the contract as part of booking.
        setProgress("Connecting wallet…");
        const { connection, wallet: account } = await chain.ensureConnection();
        if (account.toLowerCase() !== primaryWallet.toLowerCase()) {
          throw new Error(
            `Connect the wallet linked to your account (${shortAddress(primaryWallet)}).`,
          );
        }

        setProgress("Locking escrow on-chain…");
        const onChainId =
          receiver.onChainUserId ?? (await chainGetUserByAddress(receiver.wallet!)).id;

        const { packageId, txHash } = await chain.bookShipment(
          {
            qrHash,
            contentHash: content,
            weight: Number(weight),
            size,
            receiverId: onChainId,
            deliveryCode,
            currency: "ETH",
          },
          amount,
        );
        chainMeta = {
          chainId: connection.chainId,
          contract: connection.address,
          onChainId: packageId,
          txHash,
        };
      }

      setProgress("Saving to your account…");
      const res = await fetch("/api/packages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          qrHash,
          contentHash: content,
          weight: Number(weight),
          size,
          receiverId: receiver.id,
          amount: Number(amount),
          currency: "ETH",
          deliveryCode,
          ...(chainMeta ? { chain: chainMeta } : {}),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "could not save the shipment");

      setBooked({ qrHash, txHash: chainMeta?.txHash });
      setContent("");
      setDeliveryCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}/track?code=${booked?.qrHash}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Book a shipment</h1>
        <p className="text-sm text-muted-foreground">
          {recordOnChain
            ? "Funds are locked in on-chain escrow and released when the recipient confirms delivery. Your booking is recorded on the contract and mirrored to your account."
            : "The escrow amount is recorded in your account and released when the recipient confirms delivery."}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>Receiver</Label>
          <Select
            value={receiverId}
            items={receivers.map((r) => ({
              value: String(r.id),
              label: `${r.name || "Unnamed user"}${r.wallet ? "" : " (no wallet)"}`,
            }))}
            onValueChange={(v) => setReceiverId(v ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select receiver" />
            </SelectTrigger>
            <SelectContent>
              {receivers.map((r) => (
                <SelectItem key={r.id} value={String(r.id)}>
                  {r.name || "Unnamed user"}
                  {r.wallet ? "" : " (no wallet)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Package contents (confidential)</Label>
          <Input
            placeholder="e.g. electronics, documents…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Weight (kg)</Label>
            <Input type="number" min="0" step="0.5" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Size</Label>
            <Select value={size} onValueChange={(v) => setSize(v ?? "M")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIZES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tracking code</Label>
            <Input value={qrHash} readOnly className="font-mono" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Escrow amount (ETH)</Label>
            <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Recipient delivery code</Label>
            <Input
              placeholder="MFA code for confirmation"
              value={deliveryCode}
              onChange={(e) => setDeliveryCode(e.target.value)}
              className="font-mono"
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Wallet &amp; contract</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ChainStatus chain={chain} />
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <Input
                type="checkbox"
                checked={recordOnChain}
                onChange={(e) => setRecordOnChain(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                Lock escrow on-chain (requires a connected wallet).
                <span className="block text-xs text-muted-foreground">
                  Uncheck to record the booking off-chain in your account only — useful for demos
                  without a wallet.
                </span>
              </span>
            </label>
            {primaryWallet ? (
              <p className="text-xs text-muted-foreground">
                Linked wallet <span className="font-mono">{primaryWallet}</span>
              </p>
            ) : (
              <p className="text-xs text-amber-600">
                No linked wallet.{" "}
                <Link href="/account" className="underline">
                  Link one on your account
                </Link>{" "}
                to escrow on-chain, or book off-chain without one.
              </p>
            )}
          </CardContent>
        </Card>

        {error && (
          <Alert variant="default">
            <AlertTitle>Cannot book</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          <Send />{" "}
          {busy
            ? (progress ?? (recordOnChain ? "Booking & locking escrow…" : "Booking…"))
            : recordOnChain
              ? "Book shipment & lock escrow"
              : "Book shipment"}
        </Button>
      </form>

      {booked && (
        <Alert>
          <AlertTitle>Shipment booked</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              {booked.qrHash}{" "}
              {booked.txHash
                ? `registered on-chain and in your account · tx ${booked.txHash}`
                : "recorded in your account"}
              . Send this link to your recipient:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md bg-muted px-2 py-1 text-xs">
                {`${typeof window !== "undefined" ? window.location.origin : ""}/track?code=${booked.qrHash}`}
              </code>
              <Button type="button" size="sm" variant="outline" onClick={copyLink}>
                <Copy /> {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {receivers.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No receivers registered yet. A receiver needs to sign up, set their role and link a wallet
          before you can send to them.
        </p>
      )}
    </div>
  );
}
