"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, Clipboard, FileText, Printer, ShieldCheck, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChainStatus } from "@/components/chain-status";
import { StatusBadge, TxnBadge } from "@/components/status-badge";
import { useChainTrack, useStoreState } from "@/lib/chain";
import { useChainContract } from "@/lib/use-chain-contract";
import { onChainReceipt } from "@/lib/chain-receipt";
import {
  chainGetCheckpoints,
  chainGetPackageByCode,
  chainGetReceiptHash,
  chainGetTransaction,
} from "@/lib/web3";
import { STATUS_LABEL, type Checkpoint, type Package, type Transaction } from "@/lib/types";
import { fmtAmount, fmtDate } from "@/lib/format";

const TXN_PLAIN: Record<Transaction["status"], string> = {
  Pending: "Payment is pending.",
  InEscrow: "Payment is held safely in escrow until delivery is confirmed.",
  Paid: "Payment was released to the sender after delivery was confirmed.",
  Refunded: "Payment was returned to the sender.",
  Cancelled: "This payment was voided.",
};

interface ChainFacts {
  pkg: Package;
  txn: Transaction | null;
  checkpoints: Checkpoint[];
  receiptHash: string | null;
  verified: boolean | null;
}

function summary(pkg: Package, txn: Transaction | null, receiverName?: string): string {
  const who = receiverName ? ` to ${receiverName}` : "";
  switch (pkg.status) {
    case "Delivered":
      return `Delivered${who} on ${fmtDate(pkg.deliveredAt ?? pkg.createdAt)}. ${txn ? TXN_PLAIN[txn.status] : ""}`;
    case "OutForDelivery":
      return `Out for delivery${who}. ${txn ? TXN_PLAIN[txn.status] : ""}`;
    case "InTransit":
      return `On its way${who}. ${txn ? TXN_PLAIN[txn.status] : ""}`;
    case "Registered":
      return `Registered and ready to ship. ${txn ? TXN_PLAIN[txn.status] : ""}`;
    case "Cancelled":
      return `Cancelled before shipping. ${txn ? TXN_PLAIN[txn.status] : ""}`;
    case "Failed":
      return `Delivery did not complete (${STATUS_LABEL[pkg.status]}). ${txn ? TXN_PLAIN[txn.status] : ""}`;
  }
}

export default function ReportPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").trim().toUpperCase();
  const chain = useChainContract();
  const { state } = useChainTrack();
  const { packageByCode, userById, txnForPackage, checkpointsForPackage } = useStoreState(state);

  const pkg = packageByCode(code);
  const sender = pkg ? userById(pkg.senderId) : undefined;
  const receiver = pkg ? userById(pkg.receiverId) : undefined;
  const txn = pkg ? txnForPackage(pkg.id) : undefined;
  const checkpoints = pkg ? checkpointsForPackage(pkg.id) : [];

  const [chainFacts, setChainFacts] = useState<ChainFacts | null>(null);
  const [lookupDone, setLookupDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const generatedAt = new Date().toLocaleString(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  });

  useEffect(() => {
    if (chain.status !== "ready" || lookupDone) return;
    let active = true;
    (async () => {
      await Promise.resolve();
      try {
        const found = await chainGetPackageByCode(code);
        if (!active || !found) return;
        const [tx, cps, storedHash] = await Promise.all([
          chainGetTransaction(found.id).catch(() => null),
          chainGetCheckpoints(found.id).catch(() => [] as Checkpoint[]),
          chainGetReceiptHash(found.id),
        ]);
        let verified: boolean | null = null;
        if (storedHash) {
          try {
            const receipt = await onChainReceipt(found);
            verified = receipt.hash === storedHash;
          } catch {
            verified = null;
          }
        }
        if (active) {
          setChainFacts({ pkg: found, txn: tx, checkpoints: cps, receiptHash: storedHash, verified });
        }
      } catch {
        // ledger read failed — stay offline
      } finally {
        if (active) setLookupDone(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [chain.status, code, lookupDone]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this share link:", shareUrl);
    }
  };

  const reportPkg = chainFacts?.pkg ?? pkg;
  const reportTxn = chainFacts?.txn ?? txn ?? null;
  const journey = chainFacts ? [...chainFacts.checkpoints].reverse() : checkpoints;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <style>{`
        @media print {
          header, footer { display: none !important; }
          main { padding: 0 !important; max-width: none !important; }
        }
      `}</style>

      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-semibold">Delivery status report</h1>
          <p className="text-sm text-muted-foreground">
            Share this plain-language summary with anyone — no account needed to view it on this
            device.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyLink}>
            {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Clipboard className="mr-1.5 h-3.5 w-3.5" />}
            {copied ? "Link copied" : "Copy share link"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Print / Save PDF
          </Button>
        </div>
      </div>

      {(pkg || chainFacts) && (
        <Card className="border-emerald-600/40">
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-wrap items-center gap-3">
              {reportPkg && <StatusBadge status={reportPkg.status} />}
              <span className="font-mono text-lg font-semibold tracking-tight">
                {pkg?.qrHash ?? code}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                Report generated {generatedAt}
              </span>
            </div>
            {reportPkg && (
              <p className="text-base text-muted-foreground">
                {summary(reportPkg, reportTxn, receiver?.name)}
              </p>
            )}

            <div className="flex items-center gap-4">
              {shareUrl && <QRCodeSVG value={shareUrl} size={96} className="print:hidden" />}
              <div className="text-xs text-muted-foreground">
                <Share2 className="mb-1 h-4 w-4" />
                <p>
                  Scan this code or use the copy button to share this live report. It updates with
                  the latest status.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {reportPkg && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">About this package</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">From (sender)</p>
              <p className="font-medium">{sender?.name ?? `Sender #${reportPkg.senderId}`}</p>
              <p className="text-xs text-muted-foreground">{sender?.phone}</p>
              <p className="mt-2 text-xs text-muted-foreground">To (receiver)</p>
              <p className="font-medium">{receiver?.name ?? `Receiver #${reportPkg.receiverId}`}</p>
              <p className="text-xs text-muted-foreground">{receiver?.phone}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Contents</p>
              <p className="font-medium">{reportPkg.contentHash}</p>
              <p className="text-xs text-muted-foreground">
                {reportPkg.weight} kg · size {reportPkg.size}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Shipped</p>
              <p className="font-medium">{fmtDate(reportPkg.createdAt)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {reportTxn && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2 text-sm">
            <TxnBadge status={reportTxn.status} />
            <span className="font-mono">{fmtAmount(reportTxn.amount, reportTxn.currency)}</span>
            <p className="w-full text-sm text-muted-foreground">{TXN_PLAIN[reportTxn.status]}</p>
          </CardContent>
        </Card>
      )}

      {journey.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Journey so far</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {journey.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm"
              >
                <StatusBadge status={c.status} />
                <span className="text-muted-foreground">{c.location}</span>
                <span className="text-xs text-muted-foreground">{fmtDate(c.timestamp)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {chainFacts && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> On the ChainTrack ledger
            </CardTitle>
            <CardDescription>
              A tamper-evident fingerprint of this report is stored on the blockchain.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                className={
                  chainFacts.verified === true
                    ? "bg-emerald-600/15 text-emerald-700 hover:bg-emerald-600/15"
                    : chainFacts.verified === false
                      ? "bg-destructive/10 text-destructive hover:bg-destructive/10"
                      : ""
                }
              >
                {chainFacts.verified === null
                  ? chainFacts.receiptHash
                    ? "Checking ledger…"
                    : "No receipt fingerprint stored yet"
                  : chainFacts.verified
                    ? "Blockchain record verified"
                    : "Ledger record does not match this report"}
              </Badge>
              {chainFacts.txn && <TxnBadge status={chainFacts.txn.status} />}
            </div>
            <p className="text-xs text-muted-foreground">
              Anyone can confirm this report on the public ChainTrack contract. For the full
              cryptographic proof, open the technical receipt.
            </p>
            <Link href={`/receipt/${chainFacts.pkg.id}`} className="print:hidden">
              <Button variant="outline" size="sm">
                <FileText className="mr-1.5 h-3.5 w-3.5" /> View technical proof
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {!pkg && chain.status !== "ready" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connect to view the ledger report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ChainStatus chain={chain} />
            <p className="text-xs text-muted-foreground">
              This package exists on-chain. Connect a wallet to fetch its status report from the
              ChainTrack contract.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2 pt-2 print:hidden">
        <Link href={pkg ? `/track?code=${pkg.qrHash}` : "/track"}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to tracking
          </Button>
        </Link>
      </div>
    </div>
  );
}