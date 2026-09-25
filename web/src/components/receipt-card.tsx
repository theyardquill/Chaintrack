"use client";

import Link from "next/link";
import { CheckCircle2, FileCheck2, Printer, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChainTrack, useStoreState } from "@/lib/chain";
import { buildReceiptPayload, receiptPayloadHash, RECEIPT_LABEL, formatReceiptHash } from "@/lib/receipt";
import { STATUS_LABEL, TXN_LABEL } from "@/lib/types";
import { fmtAmount, fmtDate } from "@/lib/format";

interface ReceiptCardProps {
  /** QR code — demo data is resolved by code (demo and on-chain ids differ). */
  code: string;
  /** On-chain package id, for the receipt reference. */
  chainPackageId?: number;
  /** Canonical payload hash recomputed from on-chain facts at marking time. */
  chainHash?: string | null;
  /** Receipt hash stored on the contract, if any. */
  storedHash?: string | null;
}

export function ReceiptCard({
  code,
  chainPackageId,
  chainHash = null,
  storedHash = null,
}: ReceiptCardProps) {
  const { state } = useChainTrack();
  const { packageByCode, userById, txnForPackage, checkpointsForPackage } = useStoreState(state);

  const pkg = packageByCode(code);
  if (!pkg) return null;

  const sender = userById(pkg.senderId);
  const receiver = userById(pkg.receiverId);
  const txn = txnForPackage(pkg.id);
  const checkpoints = checkpointsForPackage(pkg.id);
  const payload = buildReceiptPayload({
    pkg,
    sender,
    receiver,
    txn,
    checkpoints: [...checkpoints].reverse(),
  });
  const hash = receiptPayloadHash(payload);
  const referenceHash = chainHash ?? hash;

  const verified = storedHash !== null && storedHash === referenceHash;
  const showChainState = chainHash !== null || storedHash !== null;

  return (
    <Card className="border-emerald-600/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileCheck2 className="h-4 w-4 text-emerald-600" /> {RECEIPT_LABEL}
        </CardTitle>
        <Link href={`/receipt/${pkg.id}`} className="print:hidden">
          <Button size="sm" variant="outline">
            <Printer className="mr-1.5 h-3.5 w-3.5" /> Print receipt
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
          {showChainState &&
            (verified ? (
              <Badge className="bg-emerald-600/15 text-emerald-700 hover:bg-emerald-600/15">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Verified on-chain · {formatReceiptHash(storedHash ?? "")}
              </Badge>
            ) : storedHash ? (
              <Badge variant="destructive">
                <ShieldAlert className="mr-1 h-3 w-3" />
                Hash mismatch
              </Badge>
            ) : (
              <Badge variant="outline">Not stored on-chain yet</Badge>
            ))}
          <span>
            receipt #{chainPackageId ?? pkg.id} · {pkg.qrHash} · payload{" "}
            {formatReceiptHash(referenceHash)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Sender</p>
            <p className="font-medium">{sender?.name ?? `User #${pkg.senderId}`}</p>
            <p className="text-xs text-muted-foreground">{sender?.phone}</p>
            <p className="mt-2 text-xs text-muted-foreground">Receiver</p>
            <p className="font-medium">{receiver?.name ?? `User #${pkg.receiverId}`}</p>
            <p className="text-xs text-muted-foreground">{receiver?.phone}</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Contents</p>
            <p className="font-medium">{pkg.contentHash}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {pkg.weight} kg · size {pkg.size}
            </p>
            {txn && (
              <>
                <p className="mt-2 text-xs text-muted-foreground">Escrow</p>
                <p className="font-medium">
                  {fmtAmount(txn.amount, txn.currency)} · {TXN_LABEL[txn.status]}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Delivery route</p>
          <div className="space-y-1.5">
            {checkpoints.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-1.5"
              >
                <span className="text-xs">{STATUS_LABEL[c.status]}</span>
                <span className="text-xs">{c.location}</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {fmtDate(c.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}