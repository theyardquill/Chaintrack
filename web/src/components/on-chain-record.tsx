"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Link2, Radio, ShieldCheck, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TrackingTimeline } from "@/components/tracking-timeline";
import { useChainContract } from "@/lib/use-chain-contract";
import {
  chainConfirmDelivery,
  chainGetCheckpoints,
  chainGetPackageByCode,
  chainGetTransaction,
} from "@/lib/web3";
import type { Checkpoint, Package, Transaction } from "@/lib/types";

interface OnChainRecordProps {
  code: string;
}

export function OnChainRecord({ code }: OnChainRecordProps) {
  const chain = useChainContract();
  const [pkg, setPkg] = useState<Package | null>(null);
  const [txn, setTxn] = useState<Transaction | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [lookupDone, setLookupDone] = useState(false);
  const [confirmCode, setConfirmCode] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (chain.status !== "ready" || !code.trim()) return;
    let active = true;
    (async () => {
      await Promise.resolve();
      setLoading(true);
      setLookupDone(false);
      setTxHash(null);
      setActionError(null);
      try {
        const found = await chainGetPackageByCode(code.trim());
        if (!active) return;
        if (!found) {
          setPkg(null);
          setTxn(null);
          setCheckpoints([]);
          return;
        }
        const [chainTxn, chainPoints] = await Promise.all([
          chainGetTransaction(found.id).catch(() => null),
          chainGetCheckpoints(found.id),
        ]);
        if (!active) return;
        setPkg(found);
        setTxn(chainTxn);
        setCheckpoints(chainPoints);
      } catch {
        if (!active) return;
        setPkg(null);
        setTxn(null);
        setCheckpoints([]);
      } finally {
        if (active) {
          setLoading(false);
          setLookupDone(true);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [chain.status, code]);

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkg) return;
    setConfirming(true);
    setActionError(null);
    try {
      const hash = await chainConfirmDelivery({ packageId: pkg.id, deliveryCode: confirmCode });
      setTxHash(hash);
      setConfirmCode("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setConfirming(false);
    }
  };

  const shortAddress = (a: string | null) =>
    a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";

  if (chain.status !== "ready") return null;

  const escrowAmount =
    txn && txn.currency === "ETH"
      ? chain.connection?.web3.utils.fromWei(String(txn.amount), "ether") ?? txn.amount
      : txn?.amount ?? 0;

  return (
    <Card className="border-primary/30">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4 text-primary" /> On-chain record
        </CardTitle>
        <Badge variant="outline" className="font-mono text-xs">
          <Radio className="mr-1 h-3 w-3" />
          chain {chain.connection?.chainId} · {shortAddress(chain.connection?.address ?? null)}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {loading && <p className="text-muted-foreground">Reading from the contract…</p>}

        {!loading && lookupDone && !pkg && (
          <Alert variant="default">
            <AlertTitle>Not booked on-chain</AlertTitle>
            <AlertDescription>
              This package exists in demo data but was not recorded on the contract.
            </AlertDescription>
          </Alert>
        )}

        {pkg && (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Badge>
                <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                {pkg.status}
              </Badge>
              {txn && (
                <Badge variant="outline">
                  <Wallet className="mr-1 h-3.5 w-3.5" />
                  {txn.status} · {escrowAmount} {txn.currency}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                package #{pkg.id} · sender #{pkg.senderId} → receiver #{pkg.receiverId}
              </span>
            </div>

            <TrackingTimeline checkpoints={checkpoints} />

            {pkg.status === "OutForDelivery" && (
              <form onSubmit={confirm} className="flex gap-2">
                <Input
                  placeholder="Delivery code"
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                  className="font-mono"
                />
                <Button type="submit" disabled={confirming} className="shrink-0">
                  {confirming ? "Confirming…" : "Confirm on-chain"}
                </Button>
              </form>
            )}

            {txHash && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Transaction confirmed</AlertTitle>
                <AlertDescription className="font-mono break-all">
                  Escrow released on-chain · tx {txHash}
                </AlertDescription>
              </Alert>
            )}

            {actionError && (
              <Alert variant="default">
                <AlertTitle>Transaction failed</AlertTitle>
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}