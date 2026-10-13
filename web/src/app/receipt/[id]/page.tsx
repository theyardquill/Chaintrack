"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FileCheck2, Printer, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChainStatus } from "@/components/chain-status";
import { ReceiptCard, type ReceiptDetail } from "@/components/receipt-card";
import { useChainTrack } from "@/lib/chain";
import { useChainContract } from "@/lib/use-chain-contract";
import { onChainReceipt } from "@/lib/chain-receipt";
import { chainGetPackageByCode, chainGetReceiptHash } from "@/lib/web3";
import { formatReceiptHash } from "@/lib/receipt";
import type { PackageDetail } from "@/lib/db/repo";
import type { Checkpoint, Package, Transaction, User } from "@/lib/types";

function toDetail(d: PackageDetail): ReceiptDetail {
  const pkg: Package = {
    id: d.pkg._id,
    qrHash: d.pkg.qrHash,
    contentHash: d.pkg.contentHash,
    weight: d.pkg.weight,
    size: d.pkg.size,
    senderId: d.pkg.senderId,
    receiverId: d.pkg.receiverId,
    activeAgentId: d.pkg.activeAgentId,
    status: d.pkg.status,
    createdAt: d.pkg.createdAt,
    deliveredAt: d.pkg.deliveredAt,
  };
  const person = (id: number): User | undefined => {
    const p = d.people.find((x) => x.id === id);
    return p ? { id: p.id, name: p.name, phone: p.phone, role: p.role } : undefined;
  };
  const txn: Transaction | null = d.txn
    ? {
        id: d.txn._id,
        packageId: d.txn.packageId,
        senderId: d.txn.senderId,
        receiverId: d.txn.receiverId,
        amount: d.txn.amount,
        currency: d.txn.currency,
        status: d.txn.status,
        createdAt: d.txn.createdAt,
        settledAt: d.txn.settledAt,
      }
    : null;
  const checkpoints: Checkpoint[] = d.checkpoints.map((c) => ({
    id: c._id,
    packageId: c.packageId,
    agentId: c.agentId,
    location: c.location,
    timestamp: c.timestamp,
    status: c.status,
    lat: c.lat,
    lng: c.lng,
  }));
  return {
    pkg,
    sender: person(pkg.senderId),
    receiver: person(pkg.receiverId),
    txn,
    checkpoints,
  };
}

export default function ReceiptPage() {
  const params = useParams<{ id: string }>();
  const raw = decodeURIComponent(params.id ?? "").trim();
  const { state } = useChainTrack();
  const chain = useChainContract();
  const clerkEnabled = (process.env.NEXT_PUBLIC_AUTH_PROVIDER ?? "demo") === "clerk";

  const [hash, setHash] = useState<string | null>(null);
  const [storedHash, setStoredHash] = useState<string | null>(null);
  const [apiDetail, setApiDetail] = useState<PackageDetail | null>(null);
  const [apiDone, setApiDone] = useState(false);

  // Demo store lookup — accepts the numeric id (legacy links) or a tracking code.
  const demoPkg = /^\d+$/.test(raw)
    ? state.packages.find((p) => p.id === Number(raw))
    : state.packages.find((p) => p.qrHash.toLowerCase() === raw.toLowerCase());

  // Clerk mode: resolve the receipt from Mongo via the public tracking lookup.
  useEffect(() => {
    if (!clerkEnabled || !raw) return;
    let active = true;
    void (async () => {
      try {
        const res = await fetch(`/api/packages/${encodeURIComponent(raw)}`, {
          cache: "no-store",
        });
        const data = res.ok ? ((await res.json()) as PackageDetail) : null;
        if (active) setApiDetail(data);
      } catch {
        if (active) setApiDetail(null);
      } finally {
        if (active) setApiDone(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [clerkEnabled, raw]);

  const detail = clerkEnabled && apiDetail ? toDetail(apiDetail) : null;
  const pkg = clerkEnabled ? detail?.pkg : demoPkg;
  const qrHash = pkg?.qrHash;
  const notFound = clerkEnabled ? apiDone && !detail : !demoPkg;

  useEffect(() => {
    if (!qrHash) return;
    let active = true;
    (async () => {
      await Promise.resolve();
      if (!active || chain.status !== "ready") return;
      try {
        const found = await chainGetPackageByCode(qrHash);
        if (!active || !found) return;
        const receipt = await onChainReceipt(found);
        const stored = await chainGetReceiptHash(found.id);
        if (!active) return;
        setHash(receipt.hash);
        setStoredHash(stored);
      } catch {
        // ledger read failed — leave the receipt unverified
      }
    })();
    return () => {
      active = false;
    };
  }, [chain.status, qrHash]);

  const reference = pkg?.id ?? raw;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <style>{`
        @media print {
          header, footer { display: none !important; }
          main { padding: 0 !important; max-width: none !important; }
        }
      `}</style>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Proof of delivery</h1>
          <p className="text-sm text-muted-foreground">
            Receipt <span className="font-mono">{pkg?.qrHash ?? raw}</span> · escrowed on the
            ChainTrack ledger
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Print / Save PDF
          </Button>
          <Link href={pkg ? `/track?code=${pkg.qrHash}` : "/track"}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back to tracking
            </Button>
          </Link>
        </div>
      </div>

      {notFound && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receipt not found</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No receipt #{reference} exists. Connect a wallet to verify an on-chain-only receipt, or
            track a package to generate one.
          </CardContent>
        </Card>
      )}

      {pkg && (
        <ReceiptCard
          code={pkg.qrHash}
          detail={detail}
          chainHash={chain.status === "ready" ? hash : null}
          storedHash={chain.status === "ready" ? storedHash : null}
        />
      )}

      {chain.status !== "ready" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verify on-chain</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ChainStatus chain={chain} />
            <p className="text-xs text-muted-foreground">
              Connect a wallet to verify this receipt against the receipt hash stored on the
              ChainTrack contract.
            </p>
          </CardContent>
        </Card>
      )}

      {chain.status === "ready" && hash && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> On-chain verification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Badge
                className={
                  storedHash === hash
                    ? "bg-emerald-600/15 text-emerald-700 hover:bg-emerald-600/15"
                    : storedHash
                      ? "bg-destructive/10 text-destructive hover:bg-destructive/10"
                      : ""
                }
              >
                <FileCheck2 className="mr-1 h-3 w-3" />
                {storedHash === null
                  ? "Not stored on-chain yet"
                  : storedHash === hash
                    ? "Verified — on-chain hash matches this document"
                    : "Hash mismatch — receipt does not match the stored value"}
              </Badge>
            </div>
            <dl className="space-y-1 font-mono text-xs text-muted-foreground">
              <div className="flex justify-between gap-4">
                <dt>Computed from ledger facts</dt>
                <dd>{formatReceiptHash(hash)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Stored on the contract</dt>
                <dd>{storedHash ? formatReceiptHash(storedHash) : "—"}</dd>
              </div>
              {storedHash && (
                <div className="flex justify-between gap-4">
                  <dt>Full stored hash</dt>
                  <dd className="break-all">{storedHash}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
