"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Boxes,
  MapPin,
  PackageCheck,
  Send,
  Timer,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge, TxnBadge } from "@/components/status-badge";
import { useChainTrack, useStoreState } from "@/lib/chain";
import { loadSession } from "@/lib/auth";
import { fmtAmount, fmtDate } from "@/lib/format";

export default function UserDashboardPage() {
  const router = useRouter();
  const [me] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      const s = loadSession();
      return s?.type === "user" ? s.user : null;
    } catch {
      return null;
    }
  });
  const meId = me?.id ?? null;
  const role = me?.role ?? null;
  const allowed = role === "SENDER" || role === "RECEIVER";

  useEffect(() => {
    if (allowed) return;
    const s = loadSession();
    if (s?.type === "admin") router.replace("/admin");
    else if (s?.type === "user" && s.user.role === "AGENT") router.replace("/agent");
    else router.replace("/login");
  }, [allowed, router]);

  const { state } = useChainTrack();
  const { userById, checkpointsForPackage } = useStoreState(state);

  if (!allowed || !role || meId === null) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        Checking your session…
      </div>
    );
  }

  const isSender = role === "SENDER";
  const myPackages = state.packages.filter((p) =>
    isSender ? p.senderId === meId : p.receiverId === meId
  );
  const inTransit = myPackages.filter((p) =>
    ["Registered", "InTransit", "OutForDelivery"].includes(p.status)
  ).length;
  const delivered = myPackages.filter((p) => p.status === "Delivered").length;
  const escrows = state.transactions.filter((t) =>
    isSender ? t.senderId === meId : t.receiverId === meId
  );
  const escrowActive = escrows.filter((t) => t.status === "InEscrow").length;

  const starter = (id: number | null) => userById(id ?? -1)?.name ?? "—";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {isSender ? "Sender dashboard" : "Receiver dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {starter(meId)} · {isSender ? "Send shipments and watch escrows" : "Receive packages and confirm delivery"}.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/track">
            <Button variant="outline">
              <PackageCheck /> Track a package
            </Button>
          </Link>
          {isSender && (
            <Link href="/ship">
              <Button>
                <Send /> Book a shipment
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isSender ? "Shipments sent" : "Packages for you"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{myPackages.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">In transit</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{inTransit}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <span className="mr-2 inline-flex items-center">
                <Timer className="h-4 w-4 text-muted-foreground" />
              </span>
              Delivered / escrow active
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {delivered} <span className="text-sm font-normal text-muted-foreground">/ {escrowActive}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My packages</CardTitle>
        </CardHeader>
        <CardContent>
          {myPackages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isSender
                ? "No shipments yet — book your first one and the escrow will hold funds until delivery."
                : "No packages are being sent to you yet. When a sender books a shipment for you, it appears here."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Contents</TableHead>
                  <TableHead>{isSender ? "To" : "From"}</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {myPackages.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.qrHash}</TableCell>
                    <TableCell className="max-w-[140px] truncate">{p.contentHash}</TableCell>
                    <TableCell className="max-w-[120px] truncate text-xs text-muted-foreground">
                      {starter(isSender ? p.receiverId : p.senderId)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/track?code=${p.qrHash}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                      >
                        View <ArrowRight className="h-4 w-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Escrow & payments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {escrows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No escrow transactions yet. Funds are released to the {isSender ? "sender" : "receiver"} once
              delivery is confirmed.
            </p>
          )}
          {escrows.map((t) => {
            const pkg = state.packages.find((p) => p.id === t.packageId);
            return (
              <div key={t.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {pkg?.qrHash ?? `#${t.packageId}`} · {fmtAmount(t.amount, t.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ↔ {starter(t.senderId)} → {starter(t.receiverId)} ·{" "}
                    {t.settledAt ? fmtDate(t.settledAt) : "created " + fmtDate(t.createdAt)}
                  </p>
                </div>
                <TxnBadge status={t.status} />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {myPackages.length === 0 && (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          )}
          {myPackages.map((p) => ({ pkg: p, cps: checkpointsForPackage(p.id) }))
            .flatMap(({ pkg, cps }) =>
              cps.map((c) => ({
                pkg,
                loc: c.location,
                ts: c.timestamp,
                status: c.status,
                by: starter(c.agentId),
              }))
            )
            .sort((a, b) => b.ts - a.ts)
            .slice(0, 6)
            .map((e, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {e.pkg.qrHash} — {e.loc}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <StatusBadge status={e.status} />
                    {fmtDate(e.ts)}
                  </p>
                </div>
                <span className="ml-auto hidden text-xs text-muted-foreground sm:block">
                  by {e.by}
                </span>
              </div>
            ))}
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Link
          href="/agent/login"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <Boxes className="h-4 w-4" /> Not you? Sign in differently
        </Link>
      </div>
    </div>
  );
}