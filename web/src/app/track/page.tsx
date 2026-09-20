"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ScanSearch, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PackageCard } from "@/components/package-card";
import { TrackingTimeline } from "@/components/tracking-timeline";
import { useChainTrack, useStoreState } from "@/lib/chain";
import { TXN_LABEL } from "@/lib/types";
import { fmtAmount } from "@/lib/format";

function TrackContent() {
  const params = useSearchParams();
  const { state, confirm } = useChainTrack();
  const { packageByCode, checkpointsForPackage, userById, txnForPackage } = useStoreState(state);

  const [query, setQuery] = useState(params.get("code") ?? "");
  const [searched, setSearched] = useState(params.get("code") ?? "");
  const [code, setCode] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const pkg = packageByCode(searched);
  const sender = pkg ? userById(pkg.senderId) : undefined;
  const receiver = pkg ? userById(pkg.receiverId) : undefined;
  const txn = pkg ? txnForPackage(pkg.id) : undefined;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearched(query);
    setConfirmed(false);
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkg) return;
    confirm(pkg.id, code);
    setConfirmed(true);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Track a package</h1>
        <p className="text-sm text-muted-foreground">
          Enter the QR tracking code to see the on-chain journey and escrow status.
        </p>
      </div>

      <form onSubmit={submit} className="flex gap-2">
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

      {searched && !pkg && (
        <Alert variant="default">
          <AlertTitle>No package found</AlertTitle>
          <AlertDescription>
            Nothing matches “{searched}”. Check the code on the printed QR label.
          </AlertDescription>
        </Alert>
      )}

      {pkg && (
        <>
          <PackageCard state={state} pkg={pkg} showQr />
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Route & escrow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">From</span>
                <strong>{sender?.name}</strong>
                <span className="text-xs text-muted-foreground">{sender?.phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">To</span>
                <strong>{receiver?.name}</strong>
                <span className="text-xs text-muted-foreground">{receiver?.phone}</span>
              </div>
              {txn && (
                <div className="mt-2 flex items-center gap-2 rounded-md bg-muted px-3 py-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <span>{TXN_LABEL[txn.status]}</span>
                  <span className="font-mono text-xs">
                    {fmtAmount(txn.amount, txn.currency)}
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
              <TrackingTimeline checkpoints={checkpointsForPackage(pkg.id)} />
            </CardContent>
          </Card>

          {pkg.status === "OutForDelivery" && (
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
                  <Button type="submit" className="shrink-0">
                    Confirm
                  </Button>
                </form>
                {confirmed && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Delivery confirmed</AlertTitle>
                    <AlertDescription>
                      Escrow released to the sender. This event has been written to the ledger.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense>
      <TrackContent />
    </Suspense>
  );
}