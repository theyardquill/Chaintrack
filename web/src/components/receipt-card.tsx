"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  Package as PackageIcon,
  Printer,
  Share2,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { TrackingTimeline } from "@/components/tracking-timeline";
import { CheckpointMap } from "@/components/checkpoint-map";
import { useChainTrack, useStoreState } from "@/lib/chain";
import {
  buildReceiptPayload,
  receiptPayloadHash,
  RECEIPT_LABEL,
  formatReceiptHash,
} from "@/lib/receipt";
import { TXN_LABEL, type Checkpoint, type Package, type Transaction, type User } from "@/lib/types";
import { fmtAmount, fmtDate } from "@/lib/format";
import { resolveCoords } from "@/lib/geo";

export interface ReceiptDetail {
  pkg: Package;
  sender?: User | null;
  receiver?: User | null;
  txn?: Transaction | null;
  checkpoints: Checkpoint[];
}

interface ReceiptCardProps {
  /** QR code — demo data is resolved by code (demo and on-chain ids differ). */
  code: string;
  /** Resolved account data (Clerk mode, where the demo store is empty). */
  detail?: ReceiptDetail | null;
  /** Canonical payload hash recomputed from on-chain facts at marking time. */
  chainHash?: string | null;
  /** Receipt hash stored on the contract, if any. */
  storedHash?: string | null;
}

export function ReceiptCard({
  code,
  detail,
  chainHash = null,
  storedHash = null,
}: ReceiptCardProps) {
  const { state } = useChainTrack();
  const { packageByCode, userById, txnForPackage, checkpointsForPackage } = useStoreState(state);

  const pkg = detail?.pkg ?? packageByCode(code);
  if (!pkg) return null;

  const sender = detail ? detail.sender ?? undefined : userById(pkg.senderId);
  const receiver = detail ? detail.receiver ?? undefined : userById(pkg.receiverId);
  const txn = detail ? detail.txn ?? undefined : txnForPackage(pkg.id);
  const checkpoints = detail ? detail.checkpoints : checkpointsForPackage(pkg.id);
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
  const hasMap = checkpoints.some((c) => resolveCoords(c));

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-emerald-600" />
              <Link
                href={`/track?code=${pkg.qrHash}`}
                className="font-mono text-sm font-semibold hover:underline"
              >
                {RECEIPT_LABEL} · {pkg.qrHash}
              </Link>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Issued {fmtDate(pkg.deliveredAt ?? pkg.createdAt)}
            </p>
            {showChainState && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {verified ? (
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
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={pkg.status} />
            <div className="flex items-center gap-2 print:hidden">
              <Link href={`/report/${pkg.qrHash}`}>
                <Button size="sm" variant="ghost">
                  <Share2 className="mr-1.5 h-3.5 w-3.5" /> Status report
                </Button>
              </Link>
              <Link href={`/receipt/${pkg.qrHash}`}>
                <Button size="sm" variant="outline">
                  <Printer className="mr-1.5 h-3.5 w-3.5" /> Print
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <PackageIcon className="h-4 w-4 text-muted-foreground" />
            <span>{sender?.name ?? "Unknown sender"}</span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{receiver?.name ?? "Unknown receiver"}</span>
            <span className="text-xs text-muted-foreground">
              · {pkg.weight}kg · {pkg.size}
            </span>
          </div>
          <div className="font-mono text-[11px] text-muted-foreground">
            receipt #{pkg.qrHash} · payload {formatReceiptHash(referenceHash)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Route &amp; escrow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">From</span>
            <strong>{sender?.name ?? "Unknown sender"}</strong>
            <span className="text-xs text-muted-foreground">{sender?.phone}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">To</span>
            <strong>{receiver?.name ?? "Unknown receiver"}</strong>
            <span className="text-xs text-muted-foreground">{receiver?.phone}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Contents</span>
            <strong>{pkg.contentHash}</strong>
            <span className="text-xs text-muted-foreground">
              · {pkg.weight} kg · size {pkg.size}
            </span>
          </div>
          {txn && (
            <div className="mt-2 flex items-center gap-2 rounded-md bg-muted px-3 py-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span>{TXN_LABEL[txn.status]}</span>
              <span className="ml-auto font-mono text-xs">
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
          <TrackingTimeline checkpoints={checkpoints} />
        </CardContent>
      </Card>

      {hasMap && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Journey map</CardTitle>
          </CardHeader>
          <CardContent>
            <CheckpointMap checkpoints={checkpoints} />
          </CardContent>
        </Card>
      )}
    </>
  );
}
