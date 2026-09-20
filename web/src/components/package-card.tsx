"use client";

import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { ArrowRight, Coins, Package as PackageIcon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { TXN_LABEL, type ChainTrackState, type Package } from "@/lib/types";
import { txnForPackage, userById } from "@/lib/demo";
import { fmtAmount, fmtDate } from "@/lib/format";

export function PackageCard({
  state,
  pkg,
  showQr = false,
}: {
  state: ChainTrackState;
  pkg: Package;
  showQr?: boolean;
}) {
  const sender = userById(state, pkg.senderId);
  const receiver = userById(state, pkg.receiverId);
  const txn = txnForPackage(state, pkg.id);
  const trackUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/track?code=${pkg.qrHash}`
      : `/track?code=${pkg.qrHash}`;

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <PackageIcon className="h-4 w-4 text-muted-foreground" />
            <Link
              href={`/track?code=${pkg.qrHash}`}
              className="font-mono text-sm font-semibold hover:underline"
            >
              {pkg.qrHash}
            </Link>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Booked {fmtDate(pkg.createdAt)}</p>
        </div>
        <StatusBadge status={pkg.status} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <span>{sender?.name ?? "Sender"}</span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{receiver?.name ?? "Receiver"}</span>
          <span className="text-xs text-muted-foreground">
            · {pkg.weight}kg · {pkg.size}
          </span>
        </div>

        {txn && (
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
            <Coins className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{TXN_LABEL[txn.status]}</span>
            <span className="ml-auto font-mono text-xs">{fmtAmount(txn.amount, txn.currency)}</span>
          </div>
        )}

        {showQr && (
          <div className="flex justify-center rounded-md border bg-white p-3">
            <QRCodeSVG value={trackUrl} size={140} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}