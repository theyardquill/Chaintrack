"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FileCheck2, Printer, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChainStatus } from "@/components/chain-status";
import { ReceiptCard } from "@/components/receipt-card";
import { useChainTrack } from "@/lib/chain";
import { useChainContract } from "@/lib/use-chain-contract";
import { onChainReceipt } from "@/lib/chain-receipt";
import { chainGetPackageByCode, chainGetReceiptHash } from "@/lib/web3";
import { formatReceiptHash } from "@/lib/receipt";

export default function ReceiptPage() {
  const params = useParams<{ id: string }>();
  const packageId = Number(params.id);
  const { state } = useChainTrack();
  const chain = useChainContract();
  const [hash, setHash] = useState<string | null>(null);
  const [storedHash, setStoredHash] = useState<string | null>(null);
  const [lookupDone, setLookupDone] = useState(false);

  const pkg = state.packages.find((p) => p.id === packageId);
  const qrHash = pkg?.qrHash;

  useEffect(() => {
    if (!qrHash) return;
    let active = true;
    (async () => {
      await Promise.resolve();
      if (!active) return;
      if (chain.status !== "ready") {
        setLookupDone(true);
        return;
      }
      try {
        const found = await chainGetPackageByCode(qrHash);
        if (!active) return;
        if (!found) {
          setLookupDone(true);
          return;
        }
        const receipt = await onChainReceipt(found);
        const stored = await chainGetReceiptHash(found.id);
        if (!active) return;
        setHash(receipt.hash);
        setStoredHash(stored);
      } catch {
        if (!active) return;
      } finally {
        if (active) setLookupDone(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [chain.status, qrHash]);

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
            Receipt <span className="font-mono">#{packageId}</span> · escrowed on the ChainTrack
            ledger
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

      {!pkg && lookupDone && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receipt not found</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No demo package #{packageId} exists. Connect a wallet to verify an on-chain-only
            receipt, or track a package to generate one.
          </CardContent>
        </Card>
      )}

      {pkg && (
        <ReceiptCard code={pkg.qrHash} chainHash={chain.status === "ready" ? hash : null} storedHash={chain.status === "ready" ? storedHash : null} />
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