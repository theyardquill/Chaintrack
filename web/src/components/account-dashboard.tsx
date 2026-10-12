"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Boxes, Loader2, MapPin, PackageCheck, Send, Timer, TrendingUp } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
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
import { fmtAmount, fmtDate } from "@/lib/format";
import type { PackageStatus, Role, TxnStatus } from "@/lib/types";

interface PackageRow {
  _id: number;
  qrHash: string;
  contentHash: string;
  senderId: number;
  receiverId: number;
  activeAgentId: number | null;
  status: PackageStatus;
  createdAt: number;
  deliveredAt: number | null;
}

interface TxnRow {
  _id: number;
  packageId: number;
  senderId: number;
  receiverId: number;
  amount: number;
  currency: string;
  status: TxnStatus;
  createdAt: number;
  settledAt: number | null;
}

interface CheckpointRow {
  _id: number;
  packageId: number;
  agentId: number;
  location: string;
  timestamp: number;
  status: PackageStatus;
}

interface Overview {
  user: { _id: string; appUserId: number | null; name: string; role: Role };
  packages: PackageRow[];
  transactions: TxnRow[];
  checkpoints: CheckpointRow[];
  people: { id: number; name: string; role: Role }[];
}

export function AccountDashboard() {
  const { isLoaded, isSignedIn } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSignedIn) return;
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/account/overview", { cache: "no-store" });
        const body = (await res.json().catch(() => ({}))) as Overview & { error?: string };
        if (!active) return;
        if (!res.ok) setError(body.error ?? `failed to load (${res.status})`);
        else setData(body);
      } catch {
        if (active) setError("network error");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [isSignedIn]);

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your dashboard…
      </div>
    );
  }
  if (!isSignedIn) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Please sign in.</div>;
  }
  if (error || !data) {
    return <div className="py-20 text-center text-sm text-destructive">{error ?? "no data"}</div>;
  }

  const role = data.user.role;
  const meId = data.user.appUserId;
  const people = new Map(data.people.map((p) => [p.id, p.name]));
  const nameOf = (id: number | null) => (id == null ? "—" : people.get(id) ?? "—");

  if (role !== "SENDER" && role !== "RECEIVER") {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-semibold">Welcome{data.user.name ? `, ${data.user.name}` : ""}</h1>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Choose how you&apos;ll use ChainTrack</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Set your role to a <strong>sender</strong> (book shipments) or a{" "}
              <strong>receiver</strong> (confirm deliveries) to see your packages, escrows and
              activity here.
            </p>
            <Link href="/account">
              <Button>Set my role</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSender = role === "SENDER";
  const myPackages = data.packages.filter((p) =>
    isSender ? p.senderId === meId : p.receiverId === meId
  );
  const inTransit = myPackages.filter((p) =>
    ["Registered", "InTransit", "OutForDelivery"].includes(p.status)
  ).length;
  const delivered = myPackages.filter((p) => p.status === "Delivered").length;
  const escrows = data.transactions.filter((t) =>
    isSender ? t.senderId === meId : t.receiverId === meId
  );
  const escrowActive = escrows.filter((t) => t.status === "InEscrow").length;

  const activity = myPackages
    .flatMap((pkg) =>
      data.checkpoints
        .filter((c) => c.packageId === pkg._id)
        .map((c) => ({ pkg, c }))
    )
    .sort((a, b) => b.c.timestamp - a.c.timestamp)
    .slice(0, 6);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {isSender ? "Sender dashboard" : "Receiver dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.user.name || "—"} ·{" "}
            {isSender ? "Send shipments and watch escrows" : "Receive packages and confirm delivery"}.
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
            {delivered}{" "}
            <span className="text-sm font-normal text-muted-foreground">/ {escrowActive}</span>
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
                  <TableRow key={p._id}>
                    <TableCell className="font-mono text-xs">{p.qrHash}</TableCell>
                    <TableCell className="max-w-[140px] truncate">{p.contentHash}</TableCell>
                    <TableCell className="max-w-[120px] truncate text-xs text-muted-foreground">
                      {nameOf(isSender ? p.receiverId : p.senderId)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/track?code=${p.qrHash}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                      >
                        View
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
          <CardTitle className="text-base">Escrow &amp; payments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {escrows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No escrow transactions yet. Funds are released once delivery is confirmed.
            </p>
          )}
          {escrows.map((t) => {
            const pkg = data.packages.find((p) => p._id === t.packageId);
            return (
              <div key={t._id} className="flex items-center gap-3 rounded-md border px-3 py-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {pkg?.qrHash ?? "Unknown code"} · {fmtAmount(t.amount, t.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ↔ {nameOf(t.senderId)} → {nameOf(t.receiverId)} ·{" "}
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
          {activity.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
          {activity.map(({ pkg, c }) => (
            <div key={c._id} className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {pkg.qrHash} — {c.location}
                </p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <StatusBadge status={c.status} />
                  {fmtDate(c.timestamp)}
                </p>
              </div>
              <span className="ml-auto hidden text-xs text-muted-foreground sm:block">
                by {nameOf(c.agentId)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Link
          href="/account"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <Boxes className="h-4 w-4" /> Manage account &amp; wallets
        </Link>
      </div>
    </div>
  );
}
