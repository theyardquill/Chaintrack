"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ScanSearch, Share2, Wallet } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatusBadge } from "@/components/status-badge";
import { TrackingTimeline } from "@/components/tracking-timeline";
import { CheckpointMap } from "@/components/checkpoint-map";
import { useChainContract } from "@/lib/use-chain-contract";
import { onChainReceipt } from "@/lib/chain-receipt";
import { resolveCoords } from "@/lib/geo";
import { TXN_LABEL, type Checkpoint, type PackageStatus, type Role, type TxnStatus } from "@/lib/types";
import { fmtAmount } from "@/lib/format";

interface ApiPackage {
  _id: number;
  qrHash: string;
  contentHash: string;
  weight: number;
  size: string;
  senderId: number;
  receiverId: number;
  activeAgentId: number | null;
  status: PackageStatus;
  createdAt: number;
  deliveredAt: number | null;
  chain?: { chainId: string; contract: string; onChainId: number; txHash?: string };
}

interface ApiDetail {
  package: ApiPackage;
  transaction: { _id: number; status: TxnStatus; amount: number; currency: string } | null;
  checkpoints: {
    _id: number;
    packageId: number;
    agentId: number;
    location: string;
    timestamp: number;
    status: PackageStatus;
    lat?: number;
    lng?: number;
  }[];
  people: { id: number; name: string; role: Role }[];
}

export function AccountTrack() {
  const params = useSearchParams();
  const { isSignedIn } = useAuth();
  const chain = useChainContract();

  const [query, setQuery] = useState(params.get("code") ?? "");
  const [searched, setSearched] = useState(params.get("code") ?? "");
  const [detail, setDetail] = useState<ApiDetail | null>(null);
  const [meId, setMeId] = useState<number | null>(null);
  const [myWallet, setMyWallet] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const body = (await res.json().catch(() => ({}))) as {
          user?: { appUserId: number | null; wallets: { address: string; isPrimary: boolean }[] };
        };
        if (!active || !body.user) return;
        setMeId(body.user.appUserId);
        setMyWallet(
          body.user.wallets.find((w) => w.isPrimary)?.address ?? body.user.wallets[0]?.address ?? null,
        );
      } catch {
        // best-effort
      }
    })();
    return () => {
      active = false;
    };
  }, [isSignedIn]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const value = searched.trim();
      if (!value) {
        if (active) setDetail(null);
        return;
      }
      try {
        const res = await fetch(`/api/packages/${encodeURIComponent(value)}`, { cache: "no-store" });
        if (!active) return;
        if (res.status === 404) {
          setDetail(null);
          return;
        }
        const body = (await res.json().catch(() => ({}))) as ApiDetail & { error?: string };
        if (!res.ok) {
          setError(body.error ?? "lookup failed");
          return;
        }
        setError(null);
        setConfirmed(false);
        setDetail(body);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "lookup failed");
      }
    })();
    return () => {
      active = false;
    };
  }, [searched]);

  const pkg = detail?.package;
  const nameOf = (id: number) => detail?.people.find((p) => p.id === id)?.name ?? "—";
  const cps: Checkpoint[] =
    detail?.checkpoints.map((c) => ({
      id: c._id,
      packageId: c.packageId,
      agentId: c.agentId,
      location: c.location,
      timestamp: c.timestamp,
      status: c.status,
      lat: c.lat,
      lng: c.lng,
    })) ?? [];

  const isReceiver = pkg != null && meId != null && pkg.receiverId === meId;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkg) return;
    setError(null);
    setBusy(true);
    try {
      let chainMeta: ApiPackage["chain"];
      if (pkg.chain?.onChainId) {
        if (!myWallet) throw new Error("link a wallet on your account page to confirm on-chain");
        if (!chain.connection) throw new Error("connect your wallet first");
        if ((chain.wallet ?? "").toLowerCase() !== myWallet.toLowerCase()) {
          throw new Error("connect the wallet linked to your account");
        }
        const onChain = await chain.getByCode(pkg.qrHash);
        if (!onChain) throw new Error("this package was not booked on-chain");
        const { hash } = await onChainReceipt(onChain);
        const txHash = await chain.confirmDelivery({
          packageId: pkg.chain.onChainId,
          deliveryCode: code,
          receiptHash: hash,
        });
        chainMeta = { ...pkg.chain, txHash };
      }

      const res = await fetch(`/api/packages/${encodeURIComponent(pkg.qrHash)}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deliveryCode: code, chain: chainMeta }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "confirmation failed");

      setConfirmed(true);
      setCode("");
      setDetail((d) =>
        d ? { ...d, package: { ...d.package, status: "Delivered", deliveredAt: Date.now() } } : d,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Track a package</h1>
        <p className="text-sm text-muted-foreground">
          Enter the QR tracking code to see the journey and escrow status.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearched(query);
        }}
        className="flex gap-2"
      >
        <Input
          placeholder="e.g. CTK-0001"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="font-mono"
        />
        <Button type="submit" className="shrink-0">
          <ScanSearch /> Track
        </Button>
      </form>

      {error && (
        <Alert variant="default">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {searched && !pkg && !error && (
        <Alert variant="default">
          <AlertTitle>No package found</AlertTitle>
          <AlertDescription>Nothing matches “{searched}”.</AlertDescription>
        </Alert>
      )}

      {pkg && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span className="font-mono">{pkg.qrHash}</span>
                <StatusBadge status={pkg.status} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">{pkg.contentHash}</p>
              <p className="text-xs text-muted-foreground">
                {pkg.weight} kg · {pkg.size}
              </p>
            </CardContent>
          </Card>

          <div className="flex items-center gap-2 print:hidden">
            <Link href={`/report/${pkg.qrHash}`}>
              <Button variant="outline" size="sm">
                <Share2 className="mr-1.5 h-3.5 w-3.5" /> Share status report
              </Button>
            </Link>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Route &amp; escrow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">From</span>
                <strong>{nameOf(pkg.senderId)}</strong>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">To</span>
                <strong>{nameOf(pkg.receiverId)}</strong>
              </div>
              {detail?.transaction && (
                <div className="mt-2 flex items-center gap-2 rounded-md bg-muted px-3 py-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <span>{TXN_LABEL[detail.transaction.status]}</span>
                  <span className="font-mono text-xs">
                    {fmtAmount(detail.transaction.amount, detail.transaction.currency)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Checkpoint history</CardTitle>
            </CardHeader>
            <CardContent>
              <TrackingTimeline checkpoints={cps} />
            </CardContent>
          </Card>

          {cps.some((c) => resolveCoords(c)) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Journey map</CardTitle>
              </CardHeader>
              <CardContent>
                <CheckpointMap checkpoints={cps} />
              </CardContent>
            </Card>
          )}

          {pkg.status !== "Delivered" && isReceiver && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Confirm delivery</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <form onSubmit={handleConfirm} className="flex gap-2">
                  <Input
                    placeholder="Delivery code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="font-mono"
                  />
                  <Button type="submit" className="shrink-0" disabled={busy}>
                    {busy ? "Confirming…" : "Confirm"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {confirmed && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Delivery confirmed</AlertTitle>
              <AlertDescription>
                Escrow released{pkg.chain ? " on-chain" : ""} and recorded in your account.
              </AlertDescription>
            </Alert>
          )}

          {!isSignedIn && (
            <p className="text-sm text-muted-foreground">
              <Link href="/sign-in" className="text-primary hover:underline">
                Sign in
              </Link>{" "}
              as the receiver to confirm delivery.
            </p>
          )}
        </>
      )}
    </div>
  );
}
